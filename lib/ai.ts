import type {
  DecomposeResult,
  Intensity,
  MilestoneDraft,
  PlanSuggestionItem,
  Priority,
  SuggestionItem,
  SuggestionResult,
} from "@/lib/types";

/** Một kế hoạch đang chạy, kèm tiến độ động, gửi cho model để rót việc kế tiếp */
export interface ActivePlanContext {
  id: string;
  title: string;
  goal: string;
  /** cột mốc đang làm (chưa done, order nhỏ nhất) — null nếu xong hết */
  currentMilestone: { id: string; title: string } | null;
  progressPct: number;
  behindDays: number;
  totalMilestones: number;
  doneMilestones: number;
}

/** Ngữ cảnh server tự lắp từ DB để gửi cho model */
export interface SuggestContext {
  today: string;
  tomorrow: string;
  doneToday: { title: string; emotion: string | null }[];
  undone: { title: string; delayDays: number }[];
  todayRate: { done: number; total: number };
  /** trung bình ~7 ngày gần nhất, null nếu chưa đủ dữ liệu */
  weeklyAvg: {
    avgDonePerDay: number;
    avgPercent: number;
    daysWithData: number;
  } | null;
  note: string | null;
  /** kế hoạch đang chạy (mục 10) — rỗng nếu không có */
  activePlans: ActivePlanContext[];
}

const SYSTEM_PROMPT = `Bạn là trợ lý lập kế hoạch cá nhân. Nhiệm vụ: từ dữ liệu thật của người dùng
(việc đã xong kèm cảm xúc, việc còn dở kèm số ngày trì hoãn, tốc độ hoàn thành, ghi chú cuối ngày),
đề xuất todo list KHẢ THI cho ngày mai.

Nguyên tắc bắt buộc:
1. HIỆU CHỈNH THEO TỐC ĐỘ THỰC TẾ, không theo mong muốn. Nếu gần đây người dùng thường xong ~N việc/ngày,
   tổng số việc đề xuất (carry_over + suggested_tasks) nên khoảng N (±1). KHÔNG nhồi nhiều rồi để bỏ dở.
2. GIỮ LẠI việc dở quan trọng trong "carry_over". Việc trì hoãn càng nhiều ngày thì ưu tiên càng cao.
   Nếu một việc có vẻ quá lớn (trì hoãn lâu), gợi ý phiên bản chia nhỏ trong suggested_tasks thay vì lặp lại nguyên si.
   Title trong carry_over phải GIỮ NGUYÊN VĂN title của việc còn dở trong input (để hệ thống đối chiếu).
3. TẬN DỤNG ĐÀ: việc mới nên nối tiếp việc vừa hoàn thành, đặc biệt việc có emotion "love" (làm thấy dễ/thích).
4. HẠ RÀO CẢN cho việc hay bị trượt: đề xuất phiên bản nhỏ hơn, cụ thể hơn, dễ bắt đầu để giữ chuỗi.
5. Xếp việc nặng (priority high) lên đầu danh sách, việc nhẹ để lấp khoảng nghỉ.
6. TUYỆT ĐỐI KHÔNG bịa task không liên quan tới dữ liệu input. Mỗi "reason" phải ngắn (≤ 20 từ)
   và truy ngược được về một dữ kiện cụ thể trong input (việc nào, cảm xúc nào, trì hoãn bao lâu, ghi chú gì).
7. Nếu input gần như trống (chưa có lịch sử), trả carry_over rỗng và suggested_tasks rỗng,
   capacity_note giải thích rằng cần thêm dữ liệu — KHÔNG bịa.
8. KẾ HOẠCH (activePlans): với mỗi kế hoạch đang chạy, rót 1 việc CỤ THỂ, vừa sức cho ngày mai
   nhằm tiến tới "currentMilestone" của kế hoạch đó, bỏ vào "plan_tasks". Mỗi việc PHẢI gắn đúng
   "planId" (và "milestoneId" của currentMilestone nếu có) lấy từ input. CHIA ĐỀU giữa các kế hoạch —
   KHÔNG dồn hết vào một kế hoạch. Nếu một kế hoạch đang chậm (behindDays > 0), ưu tiên cao hơn và
   việc nhỏ hơn cho dễ bắt kịp. reason truy về tên kế hoạch + cột mốc. Không có activePlans → plan_tasks rỗng.
9. TỔNG số việc (carry_over + suggested_tasks + plan_tasks) vẫn phải ≈ avgDonePerDay (±1) —
   kế hoạch KHÔNG phải lý do để nhồi việc.
10. Viết toàn bộ bằng tiếng Việt.

Chỉ trả về đúng JSON theo schema đã cho, không kèm văn bản hay markdown nào khác.`;

const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    priority: { type: "STRING", enum: ["high", "medium", "low"] },
    reason: { type: "STRING" },
  },
  required: ["title", "priority", "reason"],
} as const;

const PLAN_ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    priority: { type: "STRING", enum: ["high", "medium", "low"] },
    reason: { type: "STRING" },
    planId: { type: "STRING" },
    milestoneId: { type: "STRING", nullable: true },
  },
  required: ["title", "priority", "reason", "planId"],
} as const;

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    capacity_note: { type: "STRING" },
    carry_over: { type: "ARRAY", items: ITEM_SCHEMA },
    suggested_tasks: { type: "ARRAY", items: ITEM_SCHEMA },
    plan_tasks: { type: "ARRAY", items: PLAN_ITEM_SCHEMA },
  },
  required: ["capacity_note", "carry_over", "suggested_tasks", "plan_tasks"],
} as const;

/** Bỏ ```json fences nếu model lỡ thêm */
function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "");
}

const PRIORITIES: readonly Priority[] = ["high", "medium", "low"];

/** Validate thủ công shape JSON từ model — sai chỗ nào báo chỗ đó */
function parseResult(raw: string): SuggestionResult {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    throw new Error("Model trả về không phải JSON hợp lệ");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj?.capacity_note !== "string") {
    throw new Error("JSON thiếu trường capacity_note");
  }
  const parseItems = (
    key: "carry_over" | "suggested_tasks",
  ): SuggestionItem[] => {
    const arr = obj[key];
    if (!Array.isArray(arr)) throw new Error(`JSON thiếu mảng ${key}`);
    return arr.map((it, i) => {
      const item = it as Record<string, unknown>;
      if (typeof item?.title !== "string" || typeof item?.reason !== "string") {
        throw new Error(`${key}[${i}] thiếu title/reason`);
      }
      const priority = PRIORITIES.includes(item.priority as Priority)
        ? (item.priority as Priority)
        : "medium";
      return { title: item.title, priority, reason: item.reason };
    });
  };
  // plan_tasks: như item thường nhưng kèm planId (bắt buộc) + milestoneId (optional)
  const parsePlanItems = (): PlanSuggestionItem[] => {
    const arr = obj.plan_tasks;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it): PlanSuggestionItem | null => {
        const item = it as Record<string, unknown>;
        if (
          typeof item?.title !== "string" ||
          typeof item?.reason !== "string" ||
          typeof item?.planId !== "string"
        ) {
          return null; // thiếu liên kết thì bỏ, không làm hỏng cả response
        }
        const priority = PRIORITIES.includes(item.priority as Priority)
          ? (item.priority as Priority)
          : "medium";
        return {
          title: item.title,
          priority,
          reason: item.reason,
          planId: item.planId,
          milestoneId:
            typeof item.milestoneId === "string" ? item.milestoneId : null,
        };
      })
      .filter((x): x is PlanSuggestionItem => x !== null);
  };

  return {
    capacity_note: obj.capacity_note,
    carry_over: parseItems("carry_over"),
    suggested_tasks: parseItems("suggested_tasks"),
    plan_tasks: parsePlanItems(),
    plan_alerts: [], // server điền sau (số liệu động, không để model bịa)
  };
}

/**
 * Gọi Gemini (REST, JSON mode) với một response schema và trả về text JSON thô.
 * Dùng chung cho cả đề xuất ngày mai lẫn decompose plan.
 */
async function callGeminiJson(
  systemPrompt: string,
  userText: string,
  responseSchema: object,
  temperature: number,
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error("Chưa cấu hình AI_API_KEY trong .env (xem .env.example)");
  }
  const model = process.env.AI_MODEL || "gemini-2.5-flash";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userText }] }],
        generationConfig: {
          temperature,
          responseMimeType: "application/json",
          responseSchema,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemini lỗi ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts
    ?.map((p) => p.text ?? "")
    .join("");
  if (!text) throw new Error("Gemini không trả về nội dung nào");
  return text;
}

/** Gọi Gemini đề xuất ngày mai và trả về kết quả đã validate */
export async function suggestTomorrow(
  ctx: SuggestContext,
): Promise<SuggestionResult> {
  const text = await callGeminiJson(
    SYSTEM_PROMPT,
    `Dữ liệu của người dùng:\n${JSON.stringify(ctx, null, 2)}`,
    RESPONSE_SCHEMA,
    0.4,
  );
  return parseResult(text);
}

// ---- Decompose plan: mục tiêu dài hạn → roadmap milestone (mục 10.7) ----

const DECOMPOSE_PROMPT = `Bạn là chuyên gia thiết kế lộ trình học/làm việc cá nhân. Nhiệm vụ: từ một
MỤC TIÊU dài hạn, chia thành các CỘT MỐC (milestone) hợp lý xếp theo thứ tự, trải đều trong khoảng
thời gian cho trước.

Nguyên tắc bắt buộc:
1. Mỗi milestone là một KẾT QUẢ KIỂM CHỨNG ĐƯỢC ("Thuộc bảng Hiragana", "Chạy liền 5km"),
   KHÔNG phải hoạt động mơ hồ ("Học chăm chỉ", "Cố gắng hơn").
2. Số lượng milestone vừa sức theo "intensity": "nhẹ" → ít mốc, mỗi mốc nhỏ; "dồn" → nhiều mốc,
   dày hơn; "vừa" → ở giữa. Thông thường 3–8 milestone cho một mục tiêu một tháng.
3. Xếp milestone theo "order" tăng dần (bắt đầu từ 1), từ nền tảng đến nâng cao.
4. "targetDate" là ngày dự kiến HOÀN THÀNH mốc đó, dạng "YYYY-MM-DD", nằm trong [startDate, endDate],
   tăng dần theo order, mốc cuối ≈ endDate. Nếu không chắc, để null.
5. ĐƯỢC dùng kiến thức chung về lĩnh vực (giáo trình, lộ trình chuẩn mực) để chia mốc cho hợp lý —
   đây KHÔNG phải bịa, mà là tri thức nền giúp lộ trình khả thi.
6. Viết toàn bộ bằng tiếng Việt, ngắn gọn.

Chỉ trả về đúng JSON theo schema đã cho, không kèm văn bản hay markdown nào khác.`;

const DECOMPOSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    milestones: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          order: { type: "INTEGER" },
          targetDate: { type: "STRING", nullable: true },
        },
        required: ["title", "order"],
      },
    },
  },
  required: ["milestones"],
} as const;

/** Validate thủ công shape JSON decompose */
function parseDecompose(raw: string): DecomposeResult {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    throw new Error("Model trả về không phải JSON hợp lệ");
  }
  const arr = (data as Record<string, unknown>)?.milestones;
  if (!Array.isArray(arr)) throw new Error("JSON thiếu mảng milestones");
  const milestones: MilestoneDraft[] = arr.map((it, i) => {
    const m = it as Record<string, unknown>;
    if (typeof m?.title !== "string" || !m.title.trim()) {
      throw new Error(`milestones[${i}] thiếu title`);
    }
    const order = typeof m.order === "number" ? m.order : i + 1;
    const targetDate = typeof m.targetDate === "string" ? m.targetDate : null;
    return { title: m.title.trim(), order, targetDate };
  });
  // chuẩn hoá order liên tục 1..n theo thứ tự model trả về
  milestones
    .sort((a, b) => a.order - b.order)
    .forEach((m, i) => (m.order = i + 1));
  return { milestones };
}

/** Tham số decompose lắp từ form tạo plan */
export interface DecomposeInput {
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  intensity: Intensity;
}

/** Gọi Gemini chia mục tiêu thành roadmap milestone */
export async function decomposePlan(
  input: DecomposeInput,
): Promise<DecomposeResult> {
  const text = await callGeminiJson(
    DECOMPOSE_PROMPT,
    `Thông tin kế hoạch:\n${JSON.stringify(input, null, 2)}`,
    DECOMPOSE_SCHEMA,
    0.5,
  );
  return parseDecompose(text);
}
