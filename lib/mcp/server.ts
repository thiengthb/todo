import { createMcpHandler } from "mcp-handler";
import { z, ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { computeStreaks } from "@/lib/streak";
import { defaultTz, todayLocal } from "@/lib/mcp/tz";
import {
  bulkCreateTasks,
  completeTask,
  createProject,
  createTask,
  deleteTask,
  getProject,
  getScheduleRange,
  getTask,
  getWorkloadSummary,
  habitCheckSchema,
  listFilterSchema,
  listHabits,
  listProjects,
  listTasks,
  projectCreateSchema,
  rangeSchema,
  setHabitCheck,
  taskCreateSchema,
  taskUpdateSchema,
  updateTask,
} from "@/lib/mcp/repository";
import {
  addMilestones,
  addMilestonesSchema,
  checkMilestone,
  createPlan,
  getPlan,
  listPlans,
  milestoneCheckSchema,
  planCreateSchema,
  planListSchema,
  planUpdateSchema,
  updatePlan,
} from "@/lib/mcp/plan-repository";

/**
 * MCP server (mục 15) — chạy trong app Next, dùng chung Prisma + lib helper.
 * Tool/prompt/resource KHÔNG chứa logic AI; chỉ CRUD + cung cấp ngữ cảnh để Claude lập kế hoạch.
 */

/** Bọc kết quả thành CallToolResult JSON. */
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

/** Lỗi MCP "mềm" — trả về client dưới dạng isError, KHÔNG ném (tránh -32603 thô). */
function mcpError(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    isError: true as const,
  };
}

/**
 * Bọc MỌI handler tool: log thời lượng/stderr + dịch lỗi thường gặp thành thông báo
 * dễ hiểu cho Claude (P2025 record-not-found, ZodError tham số sai) thay vì stack thô.
 */
function guard<Args extends unknown[], R>(
  name: string,
  fn: (...args: Args) => Promise<R>,
) {
  return async (...args: Args) => {
    const start = Date.now();
    try {
      const res = await fn(...args);
      console.error(`[mcp] tool=${name} ms=${Date.now() - start}`);
      return res;
    } catch (e) {
      console.error(`[mcp] tool=${name} error`, e);
      if (e instanceof ZodError) {
        const lines = e.issues
          .map((i) => `- ${i.path.join(".") || "(gốc)"}: ${i.message}`)
          .join("\n");
        return mcpError(`Tham số không hợp lệ:\n${lines}`);
      }
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2025"
      ) {
        return mcpError(
          "Không tìm thấy bản ghi với id đã cho — kiểm tra lại bằng list_tasks / list_plans / list_projects.",
        );
      }
      return mcpError(e instanceof Error ? e.message : String(e));
    }
  };
}

export const mcpHandler = createMcpHandler(
  (server) => {
    // ---------------- health ----------------
    server.tool(
      "ping",
      "Kiểm tra kết nối MCP còn sống + build đang chạy. Trả { ok, time, tz, version } — `version` " +
        "= git-SHA của image (so khớp khi nghi ngờ vừa deploy giữa chừng).",
      {},
      guard("ping", async () =>
        ok({
          ok: true,
          time: new Date().toISOString(),
          tz: defaultTz(),
          version: process.env.BUILD_SHA ?? "dev",
        }),
      ),
    );

    // ---------------- CRUD ----------------
    server.tool(
      "create_task",
      "Tạo MỘT việc. `scheduledFor` = lúc DỰ ĐỊNH làm (ISO 8601, dùng để xếp lịch theo giờ), " +
        "KHÁC `dueDate` = hạn chót (ràng buộc). `estimatedMinutes` để tính tải. `deepWork=true` " +
        "cho việc cần tập trung sâu (app ưu tiên xếp khe sáng). `priority` (LOW/MEDIUM/HIGH/URGENT). " +
        "Nếu tạo nhiều việc cùng lúc, hãy dùng `bulk_create_tasks`.",
      taskCreateSchema.shape,
      guard("create_task", async (args) => ok(await createTask(args))),
    );

    server.tool(
      "update_task",
      "Sửa một việc theo `id` (partial — chỉ gửi field cần đổi). Dùng để DỜI LỊCH " +
        "(đổi `scheduledFor`/`date`), đổi ưu tiên, gắn project, v.v.",
      { id: z.string(), ...taskUpdateSchema.shape },
      guard("update_task", async ({ id, ...patch }) =>
        ok(await updateTask(id, patch)),
      ),
    );

    server.tool(
      "complete_task",
      "Đánh dấu một việc đã XONG (done + status=DONE).",
      { id: z.string() },
      guard("complete_task", async ({ id }) => ok(await completeTask(id))),
    );

    server.tool(
      "delete_task",
      "Xoá hẳn một việc theo `id` (hard delete). Dùng khi việc không còn cần.",
      { id: z.string() },
      guard("delete_task", async ({ id }) => ok(await deleteTask(id))),
    );

    server.tool(
      "get_task",
      "Lấy chi tiết một việc theo `id` (kèm tags, project, delayDays).",
      { id: z.string() },
      guard("get_task", async ({ id }) => {
        const t = await getTask(id);
        return t ? ok(t) : mcpError(`Không tìm thấy việc id=${id}.`);
      }),
    );

    // ---------------- truy vấn ngữ cảnh ----------------
    server.tool(
      "list_tasks",
      "Liệt kê việc theo bộ lọc: status, priority, projectId, tag, khoảng ngày (`from`/`to` " +
        "dạng YYYY-MM-DD, lọc theo `date`), search (trong title), includeDone. Mặc định 100 việc.",
      listFilterSchema.shape,
      guard("list_tasks", async (args) => ok(await listTasks(args))),
    );

    server.tool(
      "get_schedule",
      "Xem lịch một khoảng ngày (`from`..`to`, YYYY-MM-DD): mỗi ngày gồm `blocks` (lịch cứng " +
        "học/làm + sự kiện, đã lọc kỳ học & tuần chẵn/lẻ), `softBlocks` (khung giờ tập trung " +
        "dời được — KHÔNG chiếm quỹ rảnh cứng nhưng nên tôn trọng), và `tasks`. GỌI TOOL NÀY " +
        "TRƯỚC khi xếp việc mới để tránh chồng lịch cứng.",
      rangeSchema.shape,
      guard("get_schedule", async (args) => ok(await getScheduleRange(args))),
    );

    server.tool(
      "get_workload_summary",
      "Tổng quan TẢI theo ngày (`from`..`to`): mỗi ngày có taskCount, totalEstimatedMinutes, " +
        "committedMinutes (lịch cứng), freeMinutes (quỹ rảnh THẬT theo giờ thức/buffer của người " +
        "dùng), softLoadMinutes (đã dành cho khung mềm), suggestedFreeMinutes (= freeMinutes − " +
        "softLoad: quỹ NÊN dùng để xếp việc mới), và freeSlots (danh sách khe trống {start,end," +
        "durationMin} để gắn scheduledFor). GỌI TRƯỚC `bulk_create_tasks` để dàn đều, đừng vượt " +
        "suggestedFreeMinutes của ngày đó.",
      rangeSchema.shape,
      guard("get_workload_summary", async (args) =>
        ok(await getWorkloadSummary(args)),
      ),
    );

    // ---------------- lập kế hoạch hàng loạt ----------------
    server.tool(
      "bulk_create_tasks",
      "Tạo NHIỀU việc trong MỘT transaction (cho cả tuần/giai đoạn). Trước khi gọi, nên gọi " +
        "`get_workload_summary` để dàn đều tải. Mỗi việc cùng schema với `create_task`. Tối đa 100.",
      { tasks: z.array(taskCreateSchema) },
      guard("bulk_create_tasks", async ({ tasks }) =>
        ok(await bulkCreateTasks(tasks)),
      ),
    );

    server.tool(
      "create_project",
      "Tạo một 'kế hoạch giai đoạn' (Project) với mốc thời gian. Sau đó tạo các task gắn " +
        "`projectId` này (qua create_task/bulk_create_tasks) để gom nhóm theo dự án.",
      projectCreateSchema.shape,
      guard("create_project", async (args) => ok(await createProject(args))),
    );

    server.tool(
      "get_project",
      "Lấy một project kèm TOÀN BỘ task con + tiến độ (progressPct). Dùng để review giai đoạn.",
      { id: z.string() },
      guard("get_project", async ({ id }) => {
        const p = await getProject(id);
        return p ? ok(p) : mcpError(`Không tìm thấy project id=${id}.`);
      }),
    );

    server.tool(
      "list_projects",
      "Liệt kê project (lọc `status`: active|done|archived) kèm tiến độ gọn.",
      { status: z.enum(["active", "done", "archived"]).optional() },
      guard("list_projects", async (args) => ok(await listProjects(args))),
    );

    // ---------------- Habits (mục 11 — KHÔNG điểm, streak chỉ là thông tin) ----------------
    server.tool(
      "list_habits",
      "Liệt kê thói quen đang bật + trạng thái hôm nay: dueToday (có đến hạn hôm nay?), " +
        "doneToday (đã tick chưa?), streak (số ngày-đến-hạn liên tiếp — THÔNG TIN, không phải " +
        "điểm). Habit TÁCH BIỆT khỏi task: không tính vào streak/thống kê việc.",
      {},
      guard("list_habits", async () => ok(await listHabits())),
    );

    server.tool(
      "check_habit",
      "Đánh dấu (hoặc bỏ đánh dấu) một thói quen cho một ngày. `id` bắt buộc; `date` mặc định " +
        "hôm nay (YYYY-MM-DD); `checked` mặc định true. Idempotent — gọi lại không tạo trùng.",
      habitCheckSchema.shape,
      guard("check_habit", async (args) => ok(await setHabitCheck(args))),
    );

    // ---------------- Plan + Milestone (mục 10 — roadmap dài hạn cuốn chiếu) ----------------
    server.tool(
      "create_plan",
      "Tạo một KẾ HOẠCH dài hạn (Plan) — mục tiêu + roadmap cột mốc, hiện trong trang /plans và " +
        "được app 'Đề xuất ngày mai' rót task. KHÁC `create_project` (gom nhóm generic): dùng Plan " +
        "cho mục tiêu có tiến trình (vd 'Luyện thi N2 trong 6 tháng'). `goal` = định nghĩa 'xong' + " +
        "bối cảnh. `startDate`/`endDate` = YYYY-MM-DD. Kèm `milestones` (kết quả KIỂM CHỨNG được, vd " +
        "'Thuộc bảng Hiragana' — KHÔNG mơ hồ) để tạo roadmap luôn. `intensity` (nhẹ|vừa|dồn) là gợi ý mềm.",
      planCreateSchema.shape,
      guard("create_plan", async (args) => ok(await createPlan(args))),
    );

    server.tool(
      "add_milestones",
      "Thêm cột mốc vào một plan đã có (`planId`). `order` tự nối tiếp nếu bỏ trống. Mỗi milestone " +
        "nên là kết quả kiểm chứng được, có `targetDate` (YYYY-MM-DD) nếu hợp lý.",
      addMilestonesSchema.shape,
      guard("add_milestones", async (args) => ok(await addMilestones(args))),
    );

    server.tool(
      "update_plan",
      "Sửa một plan theo `id` (partial): đổi `title`/`goal`/`startDate`/`endDate`/`intensity` hoặc " +
        "`status` (active|paused|done|archived). Dùng khi GIÃN DEADLINE hay tạm dừng — nhưng chỉ khi " +
        "người dùng đồng ý (minh bạch, không tự co giãn ngầm).",
      { id: z.string(), ...planUpdateSchema.shape },
      guard("update_plan", async ({ id, ...patch }) =>
        ok(await updatePlan(id, patch)),
      ),
    );

    server.tool(
      "list_plans",
      "Liệt kê plan (lọc `status`) kèm tiến độ ĐỘNG: progressPct, behindDays (>0 = đang chậm), " +
        "currentMilestone, daysLeft, và danh sách milestones.",
      planListSchema.shape,
      guard("list_plans", async (args) => ok(await listPlans(args))),
    );

    server.tool(
      "get_plan",
      "Lấy một plan theo `id`: roadmap milestones + tiến độ động + TẤT CẢ task gắn plan. Dùng để " +
        "review trước khi rót task ngày mai (gắn `planId`/`milestoneId` khi create_task).",
      { id: z.string() },
      guard("get_plan", async ({ id }) => {
        const p = await getPlan(id);
        return p ? ok(p) : mcpError(`Không tìm thấy plan id=${id}.`);
      }),
    );

    server.tool(
      "check_milestone",
      "Đánh dấu (hoặc bỏ) một milestone là đã đạt. `id` bắt buộc, `done` mặc định true. LƯU Ý: chỉ " +
        "gọi khi NGƯỜI DÙNG xác nhận đã đạt mốc — AI KHÔNG tự tick (mục 10.8).",
      milestoneCheckSchema.shape,
      guard("check_milestone", async (args) => ok(await checkMilestone(args))),
    );

    // ---------------- Resources ----------------
    server.resource(
      "today_overview",
      "todo://today-overview",
      {
        description:
          "Tóm tắt hôm nay: việc, tải, quỹ rảnh, khe trống, thói quen, streak.",
        mimeType: "application/json",
      },
      async (uri) => {
        const today = todayLocal();
        const [tasks, workload, habits, activeRows] = await Promise.all([
          listTasks({ from: today, to: today }),
          getWorkloadSummary({ from: today, to: today }),
          listHabits(),
          prisma.task.findMany({
            where: { done: true },
            select: { date: true },
            distinct: ["date"],
          }),
        ]);
        const streak = computeStreaks(
          activeRows.map((r) => r.date),
          today,
        );
        return {
          contents: [
            {
              uri: uri.href,
              mimeType: "application/json",
              text: JSON.stringify({
                today,
                tasks,
                workload: workload.days[0] ?? null,
                habits,
                streak: {
                  current: streak.current,
                  atRisk: streak.atRisk,
                  longest: streak.longest,
                },
              }),
            },
          ],
        };
      },
    );

    server.resource(
      "active_projects",
      "todo://active-projects",
      {
        description: "Project đang chạy + % hoàn thành.",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await listProjects({ status: "active" })),
          },
        ],
      }),
    );

    server.resource(
      "active_plans",
      "todo://active-plans",
      {
        description:
          "Kế hoạch dài hạn đang chạy + tiến độ động (behindDays, currentMilestone).",
        mimeType: "application/json",
      },
      async (uri) => ({
        contents: [
          {
            uri: uri.href,
            mimeType: "application/json",
            text: JSON.stringify(await listPlans({ status: "active" })),
          },
        ],
      }),
    );

    // ---------------- Prompts (ép quy trình an toàn) ----------------
    const SAFE =
      `QUY TRÌNH BẮT BUỘC: (1) đọc ngữ cảnh thật trước (get_schedule + get_workload_summary, ` +
      `và resource today_overview nếu cần); (2) TRÌNH BÀY kế hoạch đề xuất cho người dùng và CHỜ họ ` +
      `đồng ý; (3) chỉ khi được duyệt mới ghi (bulk_create_tasks/create_task). Tôn trọng ` +
      `suggestedFreeMinutes mỗi ngày — không nhồi vượt quỹ rảnh; gắn scheduledFor vào freeSlots ` +
      `thật, KHÔNG đè lịch cứng. scheduledFor = lúc làm, dueDate = hạn chót.`;

    server.prompt(
      "plan_my_day",
      "Lập kế hoạch cho HÔM NAY theo giờ, dựa trên lịch & tải thật.",
      async () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Hãy giúp tôi lập kế hoạch cho hôm nay. ${SAFE}\n` +
                `Gọi get_schedule và get_workload_summary cho hôm nay, hỏi mục tiêu nếu cần, ` +
                `rồi đề xuất lịch theo giờ (gắn scheduledFor) trong các khe trống.`,
            },
          },
        ],
      }),
    );

    server.prompt(
      "plan_week",
      "Lập kế hoạch 7 ngày tới, dàn đều tải.",
      async () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Hãy giúp tôi lập kế hoạch 7 ngày tới, dàn đều việc tránh quá tải. ${SAFE}\n` +
                `Gọi get_workload_summary cho cả tuần trước khi đề xuất.`,
            },
          },
        ],
      }),
    );

    server.prompt(
      "plan_project",
      "Nhận mục tiêu lớn + deadline → tạo kế hoạch (Plan) với roadmap milestone, rồi rót task.",
      async () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Tôi có một mục tiêu lớn cần hoàn thành trước một deadline. ${SAFE}\n` +
                `Hỏi tôi mục tiêu + deadline + cường độ, rồi tạo create_plan KÈM milestones (mỗi mốc là ` +
                `kết quả KIỂM CHỨNG được, không mơ hồ) — đây là roadmap để app theo dõi tiến độ. CHỜ tôi ` +
                `duyệt roadmap. Sau đó rót vài task kế tiếp gắn planId/milestoneId vào các ngày sắp tới ` +
                `(xem get_workload_summary để dàn tải; ĐỪNG đẻ sẵn cả 30 ngày — rót cuốn chiếu). ` +
                `KHÔNG tự tick milestone — chỉ tôi xác nhận.`,
            },
          },
        ],
      }),
    );

    server.prompt(
      "review_and_reschedule",
      "Xem việc quá hạn/chưa xong và đề xuất dời lịch.",
      async () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Hãy rà soát việc quá hạn/chưa xong và đề xuất dời lịch hợp lý. ${SAFE}\n` +
                `Gọi list_tasks (includeDone=false) + get_workload_summary, đề xuất scheduledFor mới ` +
                `cho từng việc, chờ tôi duyệt rồi mới update_task.`,
            },
          },
        ],
      }),
    );
  },
  { serverInfo: { name: "smart-todo-mcp", version: "0.1.0" } },
  { basePath: "/api", disableSse: true },
);
