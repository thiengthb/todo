import type { Priority, SuggestionItem, SuggestionResult } from "@/lib/types";

/** Ngữ cảnh server tự lắp từ DB để gửi cho model */
export interface SuggestContext {
  today: string;
  tomorrow: string;
  doneToday: { title: string; emotion: string | null }[];
  undone: { title: string; delayDays: number }[];
  todayRate: { done: number; total: number };
  /** trung bình ~7 ngày gần nhất, null nếu chưa đủ dữ liệu */
  weeklyAvg: { avgDonePerDay: number; avgPercent: number; daysWithData: number } | null;
  note: string | null;
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
8. Viết toàn bộ bằng tiếng Việt.

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

const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    capacity_note: { type: "STRING" },
    carry_over: { type: "ARRAY", items: ITEM_SCHEMA },
    suggested_tasks: { type: "ARRAY", items: ITEM_SCHEMA },
  },
  required: ["capacity_note", "carry_over", "suggested_tasks"],
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
  const parseItems = (key: "carry_over" | "suggested_tasks"): SuggestionItem[] => {
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
  return {
    capacity_note: obj.capacity_note,
    carry_over: parseItems("carry_over"),
    suggested_tasks: parseItems("suggested_tasks"),
  };
}

/** Gọi Gemini (REST, JSON mode) và trả về kết quả đã validate */
export async function suggestTomorrow(ctx: SuggestContext): Promise<SuggestionResult> {
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
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            role: "user",
            parts: [{ text: `Dữ liệu của người dùng:\n${JSON.stringify(ctx, null, 2)}` }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      }),
    }
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

  return parseResult(text);
}
