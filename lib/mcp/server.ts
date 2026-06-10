import { createMcpHandler } from "mcp-handler";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { computeStreaks } from "@/lib/streak";
import { todayLocal } from "@/lib/mcp/tz";
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

/**
 * MCP server (mục 15) — chạy trong app Next, dùng chung Prisma + lib helper.
 * Tool/prompt/resource KHÔNG chứa logic AI; chỉ CRUD + cung cấp ngữ cảnh để Claude lập kế hoạch.
 */

/** Bọc kết quả thành CallToolResult JSON. */
function ok(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data) }] };
}

export const mcpHandler = createMcpHandler(
  (server) => {
    // ---------------- health ----------------
    server.tool(
      "ping",
      "Kiểm tra kết nối MCP server còn sống. Trả về { ok, time }.",
      {},
      async () => ok({ ok: true, time: new Date().toISOString() }),
    );

    // ---------------- CRUD ----------------
    server.tool(
      "create_task",
      "Tạo MỘT việc. `scheduledFor` = lúc DỰ ĐỊNH làm (ISO 8601, dùng để xếp lịch theo giờ), " +
        "KHÁC `dueDate` = hạn chót (ràng buộc). `estimatedMinutes` để tính tải. `deepWork=true` " +
        "cho việc cần tập trung sâu (app ưu tiên xếp khe sáng). `priority` (LOW/MEDIUM/HIGH/URGENT). " +
        "Nếu tạo nhiều việc cùng lúc, hãy dùng `bulk_create_tasks`.",
      taskCreateSchema.shape,
      async (args) => ok(await createTask(args)),
    );

    server.tool(
      "update_task",
      "Sửa một việc theo `id` (partial — chỉ gửi field cần đổi). Dùng để DỜI LỊCH " +
        "(đổi `scheduledFor`/`date`), đổi ưu tiên, gắn project, v.v.",
      { id: z.string(), ...taskUpdateSchema.shape },
      async ({ id, ...patch }) => ok(await updateTask(id, patch)),
    );

    server.tool(
      "complete_task",
      "Đánh dấu một việc đã XONG (done + status=DONE).",
      { id: z.string() },
      async ({ id }) => ok(await completeTask(id)),
    );

    server.tool(
      "delete_task",
      "Xoá hẳn một việc theo `id` (hard delete). Dùng khi việc không còn cần.",
      { id: z.string() },
      async ({ id }) => ok(await deleteTask(id)),
    );

    server.tool(
      "get_task",
      "Lấy chi tiết một việc theo `id` (kèm tags, project, delayDays).",
      { id: z.string() },
      async ({ id }) => ok(await getTask(id)),
    );

    // ---------------- truy vấn ngữ cảnh ----------------
    server.tool(
      "list_tasks",
      "Liệt kê việc theo bộ lọc: status, priority, projectId, tag, khoảng ngày (`from`/`to` " +
        "dạng YYYY-MM-DD, lọc theo `date`), search (trong title), includeDone. Mặc định 100 việc.",
      listFilterSchema.shape,
      async (args) => ok(await listTasks(args)),
    );

    server.tool(
      "get_schedule",
      "Xem lịch một khoảng ngày (`from`..`to`, YYYY-MM-DD): mỗi ngày gồm `blocks` (lịch cứng " +
        "học/làm + sự kiện, đã lọc kỳ học & tuần chẵn/lẻ), `softBlocks` (khung giờ tập trung " +
        "dời được — KHÔNG chiếm quỹ rảnh cứng nhưng nên tôn trọng), và `tasks`. GỌI TOOL NÀY " +
        "TRƯỚC khi xếp việc mới để tránh chồng lịch cứng.",
      rangeSchema.shape,
      async (args) => ok(await getScheduleRange(args)),
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
      async (args) => ok(await getWorkloadSummary(args)),
    );

    // ---------------- lập kế hoạch hàng loạt ----------------
    server.tool(
      "bulk_create_tasks",
      "Tạo NHIỀU việc trong MỘT transaction (cho cả tuần/giai đoạn). Trước khi gọi, nên gọi " +
        "`get_workload_summary` để dàn đều tải. Mỗi việc cùng schema với `create_task`. Tối đa 100.",
      { tasks: z.array(taskCreateSchema) },
      async ({ tasks }) => ok(await bulkCreateTasks(tasks)),
    );

    server.tool(
      "create_project",
      "Tạo một 'kế hoạch giai đoạn' (Project) với mốc thời gian. Sau đó tạo các task gắn " +
        "`projectId` này (qua create_task/bulk_create_tasks) để gom nhóm theo dự án.",
      projectCreateSchema.shape,
      async (args) => ok(await createProject(args)),
    );

    server.tool(
      "get_project",
      "Lấy một project kèm TOÀN BỘ task con + tiến độ (progressPct). Dùng để review giai đoạn.",
      { id: z.string() },
      async ({ id }) => ok(await getProject(id)),
    );

    server.tool(
      "list_projects",
      "Liệt kê project (lọc `status`: active|done|archived) kèm tiến độ gọn.",
      { status: z.enum(["active", "done", "archived"]).optional() },
      async (args) => ok(await listProjects(args)),
    );

    // ---------------- Habits (mục 11 — KHÔNG điểm, streak chỉ là thông tin) ----------------
    server.tool(
      "list_habits",
      "Liệt kê thói quen đang bật + trạng thái hôm nay: dueToday (có đến hạn hôm nay?), " +
        "doneToday (đã tick chưa?), streak (số ngày-đến-hạn liên tiếp — THÔNG TIN, không phải " +
        "điểm). Habit TÁCH BIỆT khỏi task: không tính vào streak/thống kê việc.",
      {},
      async () => ok(await listHabits()),
    );

    server.tool(
      "check_habit",
      "Đánh dấu (hoặc bỏ đánh dấu) một thói quen cho một ngày. `id` bắt buộc; `date` mặc định " +
        "hôm nay (YYYY-MM-DD); `checked` mặc định true. Idempotent — gọi lại không tạo trùng.",
      habitCheckSchema.shape,
      async (args) => ok(await setHabitCheck(args)),
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
      "Nhận mục tiêu lớn + deadline → tạo project và phân rã thành task trải theo tuần.",
      async () => ({
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `Tôi có một mục tiêu lớn cần hoàn thành trước một deadline. ${SAFE}\n` +
                `Hỏi tôi mục tiêu + deadline, tạo create_project, rồi phân rã thành các task có ` +
                `scheduledFor/dueDate trải hợp lý theo các tuần (xem get_workload_summary để dàn tải).`,
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
