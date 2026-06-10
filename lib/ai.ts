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
  undone: { title: string; delayDays: number; slipReason?: string | null }[];
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
  /** việc đã chấm cảm xúc ~14 ngày gần nhất — "reference class" để hiệu chỉnh độ khó (mục 11) */
  recentDone: { title: string; emotion: string | null }[];
  /** gợi ý chủ đề khó/dễ suy từ lịch sử cảm xúc (mục 11) */
  difficultyHints: {
    hardTopics: string[];
    easyTopics: string[];
    samples: number;
  };
  /** check-in Personal OS hôm nay (mục 11) — null nếu chưa nhập */
  todayCheckin: {
    energy: number | null;
    mood: number | null;
    stress: number | null;
    sleepHours: number | null;
  } | null;
  /** sức/ngày suy động 0..100 (mục 11) — null nếu không có check-in */
  capacityScore: number | null;
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
   Nếu việc dở có "slipReason": "too_hard" → CHIA NHỎ (subtasks); "no_time"/"tired" → giảm tải, đặt việc
   nhẹ hơn; "unclear" → đề xuất bước đầu tiên là làm rõ/chia việc; "deprioritized" → có thể hạ ưu tiên.
5. ƯU TIÊN 80/20 (Pareto): "priority" phản ánh GIÁ TRỊ trên CÔNG SỨC (impact ÷ effort), không chỉ
   độ gấp. Việc tạo nhiều kết quả nhất với công sức hợp lý → priority "high". Đảm bảo CÓ một việc
   "high" rõ ràng để làm "việc chính" trong ngày (câu hỏi: nếu chỉ làm 1 việc, việc nào đáng nhất?).
   Xếp việc high lên đầu, việc nhẹ lấp khoảng nghỉ.
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
10. HIỆU CHỈNH ĐỘ KHÓ THEO LỊCH SỬ (reference class, chống "lạc quan kế hoạch"): dùng "recentDone"
   và "difficultyHints" để ước lượng việc nào sẽ nặng. Nếu một việc/chủ đề thuộc "hardTopics" hoặc
   đã trượt nhiều ngày → ĐỪNG lặp lại nguyên si; thay vào đó CHIA NHỎ thành 2–4 bước cụ thể, mỗi
   bước làm được trong một lần ngồi, bỏ vào trường "subtasks" của item đó (title item là việc gốc/lớn).
   Việc thuộc "easyTopics" có thể giữ nguyên, xếp nối tiếp để tận dụng đà. Chỉ chia nhỏ khi thực sự
   cần (việc lớn/hay trượt/khó) — KHÔNG chia vụn việc đã nhỏ.
11. GIỌNG VĂN TỬ TẾ (self-compassion): "capacity_note" nói tích cực, hướng tới trước. Nếu hôm nay
   trượt nhiều, framing kiểu "vẫn giữ được phần lớn tiến độ, mai bắt đầu nhẹ nhàng" — KHÔNG trách
   móc, KHÔNG đếm tội. Đề cao việc bắt đầu lại hơn là đuổi cho kịp.
12. GỢI Ý "KHI NÀO/Ở ĐÂU" (implementation intention — đòn tâm lý mạnh): với 1–2 việc QUAN TRỌNG nhất,
   thêm trường "cue" dạng cụ thể "khi <mốc thời gian/sự kiện>, ở <nơi chốn>" (vd "sau bữa sáng, ở bàn làm").
   Chỉ gợi ý khi hợp lý; việc khác để "cue" trống. KHÔNG bịa nơi chốn nếu không suy được từ ngữ cảnh.
13. SỨC/NGÀY (capacity, Personal OS): nếu có "capacityScore"/"todayCheckin", điều chỉnh TẢI theo sức.
   capacityScore thấp (< 40) hoặc căng thẳng cao/ngủ ít → GIẢM số việc và độ khó, ưu tiên việc nhẹ;
   nếu rất thấp hoặc gần đây nhiều việc "hard"/trượt liên tục → đặt "recovery_day": true và CHỈ đề xuất
   2–3 việc rất nhẹ, phục hồi (nghỉ ngơi, dọn dẹp nhẹ, đi bộ), giọng chăm sóc bản thân. capacityScore
   cao (> 75) → có thể thêm một việc. Không có dữ liệu capacity → dựa vào tốc độ thật như cũ,
   "recovery_day": false.
14. Viết toàn bộ bằng tiếng Việt.

Chỉ trả về đúng JSON theo schema đã cho, không kèm văn bản hay markdown nào khác.`;

// các bước chia nhỏ (mục 11) — mảng tiêu đề ngắn, optional
const SUBTASKS_SCHEMA = { type: "ARRAY", items: { type: "STRING" } } as const;

const ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    priority: { type: "STRING", enum: ["high", "medium", "low"] },
    reason: { type: "STRING" },
    subtasks: SUBTASKS_SCHEMA,
    cue: { type: "STRING", nullable: true },
  },
  required: ["title", "priority", "reason"],
} as const;

const PLAN_ITEM_SCHEMA = {
  type: "OBJECT",
  properties: {
    title: { type: "STRING" },
    priority: { type: "STRING", enum: ["high", "medium", "low"] },
    reason: { type: "STRING" },
    subtasks: SUBTASKS_SCHEMA,
    cue: { type: "STRING", nullable: true },
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
    recovery_day: { type: "BOOLEAN" },
  },
  required: [
    "capacity_note",
    "carry_over",
    "suggested_tasks",
    "plan_tasks",
    "recovery_day",
  ],
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
  // mảng bước chia nhỏ: chỉ giữ string không rỗng, bỏ nếu rỗng
  const parseSubtasks = (raw: unknown): string[] | undefined => {
    if (!Array.isArray(raw)) return undefined;
    const steps = raw
      .filter((s): s is string => typeof s === "string" && s.trim().length > 0)
      .map((s) => s.trim());
    return steps.length > 0 ? steps : undefined;
  };
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
      return {
        title: item.title,
        priority,
        reason: item.reason,
        subtasks: parseSubtasks(item.subtasks),
        cue:
          typeof item.cue === "string" && item.cue.trim()
            ? item.cue.trim()
            : undefined,
      };
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
          subtasks: parseSubtasks(item.subtasks),
          cue:
            typeof item.cue === "string" && item.cue.trim()
              ? item.cue.trim()
              : undefined,
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
    recovery_day: obj.recovery_day === true,
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

// ---- Thông báo Discord: AI viết "giọng văn", dữ kiện do code cung cấp (mục 13) ----

/** Dữ kiện THẬT (code lắp từ DB) để AI bám vào, KHÔNG tự bịa số liệu */
export interface NotificationFacts {
  kind: "morning" | "streak_guard" | "random_nudge" | "evening";
  /** chuỗi giữ lửa hiện tại (ngày) */
  streakCurrent: number;
  /** chuỗi đang nguy hiểm (hôm nay chưa làm việc nào) */
  streakAtRisk: boolean;
  doneCount: number;
  totalCount: number;
  undoneCount: number;
  /** "việc chính" gợi ý hôm nay/đang dở — null nếu không có */
  mitTitle: string | null;
  /** vài việc đang dở (tối đa ~3) để cú hích bám vào */
  sampleUndone: string[];
  /** tên kế hoạch đang chậm tiến độ */
  behindPlans: string[];
  /** sức/ngày 0..100 nếu có check-in, null nếu không */
  capacityScore: number | null;
}

export interface ComposeNotificationInput {
  facts: NotificationFacts;
  include: { motivation: boolean; quote: boolean; tip: boolean };
  /** nội dung đã gửi gần đây — để AI KHÔNG lặp lại câu nói/tip */
  recentMessages: string[];
}

export interface NotificationVoice {
  /** 1–3 câu ngắn, giọng nâng đỡ, hợp loại thông báo */
  message: string;
  /** câu nói hay (kèm tác giả nếu biết), null nếu không bật/không hợp */
  quote: string | null;
  /** một mẹo cụ thể, làm được ngay, null nếu không bật */
  tip: string | null;
}

const NOTIFY_PROMPT = `Bạn là người bạn đồng hành điềm tĩnh, tử tế trong một app quản lý công việc cá nhân.
Nhiệm vụ: viết phần "giọng văn" cho một thông báo ngắn gửi lên Discord, DỰA TRÊN dữ kiện thật được cung cấp.

Triết lý BẮT BUỘC (đây là điều quan trọng nhất):
- App KHÔNG tối ưu số task hoàn thành, mà tối ưu việc người dùng DUY TRÌ được lâu dài, không kiệt sức.
- TUYỆT ĐỐI KHÔNG gây lo âu, KHÔNG hối thúc, KHÔNG trách móc, KHÔNG đếm tội, KHÔNG doạ mất chuỗi theo kiểu áp lực.
- Giọng tử tế, nâng đỡ (self-compassion). Khi trượt: nhấn mạnh "bắt đầu lại nhẹ nhàng", không phạt.
- Đề cao HÀNH ĐỘNG NHỎ: "chỉ một việc nhỏ thôi cũng đủ". Hạ rào cản, không nhồi.

Quy tắc nội dung:
1. CHỈ dùng số liệu trong dữ kiện được cho. KHÔNG bịa số, KHÔNG bịa tên việc/kế hoạch không có trong input.
2. Theo "kind":
   - "morning": chào ngày mới, nêu nhẹ tình hình (việc hôm nay / việc chính nếu có), khích lệ bắt đầu.
   - "streak_guard": nhắc DỊU DÀNG rằng làm 1 việc nhỏ là giữ được chuỗi N ngày. Khung tích cực ("giữ thành quả"),
     KHÔNG doạ ("sắp mất hết!"). Nếu streakCurrent nhỏ/0 thì khích lệ bắt đầu chuỗi mới.
   - "random_nudge": một cú hích NHẸ, thân thiện, gợi ý thử bắt tay vào một việc đang dở (dùng sampleUndone/mitTitle).
     Nếu không còn việc dở, khen ngợi và bảo cứ nghỉ ngơi.
   - "evening": đúc kết dịu dàng những gì làm được hôm nay, gợi ý ghi chú lại, không phán xét phần chưa xong.
3. "message" ngắn (≤ 3 câu), tiếng Việt tự nhiên, ấm áp, có thể dùng 0–1 emoji nhẹ nhàng (không lạm dụng).
4. "quote": nếu include.quote = true, cho MỘT câu nói hay/danh ngôn ngắn phù hợp tinh thần (kèm tác giả nếu có).
   Nếu false → null. KHÔNG trùng với các câu trong "recentMessages".
5. "tip": nếu include.tip = true, cho MỘT mẹo NĂNG SUẤT/THÓI QUEN cụ thể, làm được ngay (vd chia nhỏ việc,
   quy tắc 2 phút, if-then). Nếu false → null. KHÔNG trùng "recentMessages".
6. Nếu include.motivation = false, giữ "message" thuần thông tin, bớt phần khích lệ.
7. Viết toàn bộ bằng tiếng Việt.

Chỉ trả về đúng JSON theo schema, không kèm văn bản hay markdown nào khác.`;

const NOTIFY_SCHEMA = {
  type: "OBJECT",
  properties: {
    message: { type: "STRING" },
    quote: { type: "STRING", nullable: true },
    tip: { type: "STRING", nullable: true },
  },
  required: ["message"],
} as const;

/** Gọi Gemini viết giọng văn thông báo; ném lỗi nếu thất bại để caller fallback tĩnh */
export async function composeNotificationVoice(
  input: ComposeNotificationInput,
): Promise<NotificationVoice> {
  const text = await callGeminiJson(
    NOTIFY_PROMPT,
    `Dữ kiện & yêu cầu:\n${JSON.stringify(input, null, 2)}`,
    NOTIFY_SCHEMA,
    0.8, // cao hơn chút để câu chữ đa dạng, đỡ lặp
  );
  let data: unknown;
  try {
    data = JSON.parse(stripFences(text));
  } catch {
    throw new Error("Model trả về không phải JSON hợp lệ");
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj?.message !== "string" || !obj.message.trim()) {
    throw new Error("JSON thiếu trường message");
  }
  return {
    message: obj.message.trim(),
    quote:
      typeof obj.quote === "string" && obj.quote.trim() ? obj.quote.trim() : null,
    tip: typeof obj.tip === "string" && obj.tip.trim() ? obj.tip.trim() : null,
  };
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
