import { isValidHm } from '@/lib/notify/time';
import type {
  DecomposeResult,
  FreeSlot,
  Intensity,
  MilestoneDraft,
  PlanSuggestionItem,
  Priority,
  QueuePullItem,
  SuggestionItem,
  SuggestionResult,
} from '@/lib/types';

/** A running plan, with dynamic progress, sent to the model to feed the next task */
export interface ActivePlanContext {
  id: string;
  title: string;
  goal: string;
  /** milestone in progress (not done, smallest order) — null if all done */
  currentMilestone: { id: string; title: string } | null;
  progressPct: number;
  behindDays: number;
  totalMilestones: number;
  doneMilestones: number;
}

/** Context the server assembles from the DB to send to the model */
export interface SuggestContext {
  today: string;
  tomorrow: string;
  doneToday: { title: string; emotion: string | null }[];
  undone: { title: string; delayDays: number; slipReason?: string | null }[];
  todayRate: { done: number; total: number };
  /** average over the last ~7 days, null if not enough data */
  weeklyAvg: {
    avgDonePerDay: number;
    avgPercent: number;
    daysWithData: number;
  } | null;
  note: string | null;
  /** running plans (section 10) — empty if none */
  activePlans: ActivePlanContext[];
  /** tasks rated with emotion over the last ~14 days — the "reference class" to calibrate difficulty (section 11) */
  recentDone: { title: string; emotion: string | null }[];
  /** hard/easy/slow/fast topic hints inferred from emotion + duration history (sections 11/14) */
  difficultyHints: {
    hardTopics: string[];
    easyTopics: string[];
    slowTopics: string[];
    fastTopics: string[];
    samples: number;
  };
  /** today's Personal OS check-in (section 11) — null if not entered */
  todayCheckin: {
    energy: number | null;
    mood: number | null;
    stress: number | null;
    sleepHours: number | null;
  } | null;
  /** dynamically inferred energy/day 0..100 (section 11) — null if no check-in */
  capacityScore: number | null;
  /** tomorrow's hard schedule (section 14) — to calibrate workload against the real time budget */
  tomorrowSchedule: {
    title: string;
    startTime: string | null;
    endTime: string | null;
    kind: string;
  }[];
  /** FREE minutes tomorrow = waking hours − hard schedule (section 14) */
  freeMinutesTomorrow: number;
  /** list of FREE SLOTS tomorrow (section 14) — for the AI to pin a task to a specific time */
  freeSlotsTomorrow: FreeSlot[];
  /** suggestion budget = free budget − soft blocks already set (section 14); the AI follows this number for total load */
  suggestedCapacityMin: number;
  /** focus windows (soft blocks) tomorrow — the AI should prefer placing tasks here */
  preferredWindowsTomorrow: {
    title: string;
    startTime: string | null;
    endTime: string | null;
  }[];
  /** today's habits (section 11) — informational, NOT counted in task load */
  habitsToday?: { title: string; doneToday: boolean }[];
  /**
   * Goals in "Incubating" (section 17) — the uncommitted queue, sorted by fit to time budget/energy.
   * The AI only suggests pulling one out to DO when there is real spare time after carry_over/suggested/plan. Empty = no suggestion.
   */
  incubatingGoals: { id: string; title: string; note: string | null; ageDays: number }[];
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
14. LỊCH TRÌNH (mục 14, RẤT QUAN TRỌNG cho tính khả thi): dùng "tomorrowSchedule" (lịch cứng ngày mai:
   học/làm) và "freeMinutesTomorrow" (số phút RẢNH thật sau khi trừ lịch cứng). TỔNG khối lượng việc
   phải VỪA quỹ giờ rảnh này, KHÔNG chỉ dựa vào avgDonePerDay. Nếu freeMinutesTomorrow thấp (< 120 phút)
   → giảm mạnh số việc và độ khó, chỉ giữ 1 việc chính; rất thấp (< 60) → chỉ 1 việc nhỏ hoặc ngày nghỉ.
   Khi đặt "cue", nhắm vào KHE TRỐNG quanh lịch cứng (vd lịch làm 8–17h → cue "buổi tối, sau 18h").
   KHÔNG gán việc vào khung giờ đã có lịch cứng. Không có lịch (mảng rỗng) → bỏ qua, dựa tốc độ thật như cũ.
15. XẾP VÀO KHE GIỜ (mục 14): mỗi việc đề xuất NÊN kèm "estimatedMinutes" (ước lượng thời lượng) và
   "slotStart" (giờ bắt đầu "HH:MM") rơi vào MỘT khe trong "freeSlotsTomorrow" đủ dài chứa việc đó.
   Việc "deepWork": true → xếp vào khe SỚM nhất trong ngày (năng lượng cao buổi sáng). Ưu tiên đặt việc
   vào "preferredWindowsTomorrow" (khung tập trung người dùng đã chọn) nếu phù hợp. TUYỆT ĐỐI không đặt
   "slotStart" trùng giờ lịch cứng. TỔNG "estimatedMinutes" của mọi việc ≤ "suggestedCapacityMin".
   Dùng "slowTopics"/"fastTopics" để ước lượng thời lượng sát hơn (chủ đề hay chậm → cộng giờ). Nếu
   không chắc giờ phù hợp, để "slotStart" trống (null) — KHÔNG đoán bừa.
17. ẤP Ủ (mục 17 — "incubatingGoals": hàng đợi mục tiêu CHƯA cam kết): CHỈ gợi lấy ra làm khi NGÀY MAI
   THẬT SỰ CÒN DƯ quỹ giờ/sức sau khi đã xếp carry_over + suggested_tasks + plan_tasks (tổng các nhóm đó
   vẫn ≈ avgDonePerDay và ≤ suggestedCapacityMin). Nếu ngày mai đã đầy/đang chậm/sức thấp/recovery_day →
   trả "queue_pulls" RỖNG (đừng nhồi — ấp ủ là việc thêm khi rảnh, không phải nghĩa vụ). Khi có dư: chọn
   1–2 mục HỢP NHẤT với quỹ giờ rảnh còn lại (việc lớn cho khe dài + sức tốt; việc nhỏ cho khe ngắn/mệt),
   lấy "goalId" + "title" NGUYÊN VĂN từ incubatingGoals. "suggestApproach" = gợi ý CỠ: "task" nếu làm gọn
   trong một buổi, "plan" nếu là mục tiêu nhiều bước/dài hạn (nên lập lộ trình). NẾU thấy ≥2 mục cùng CHỦ ĐỀ,
   có thể gộp gợi ý thành một "plan" và nói rõ trong reason. reason ngắn, truy về quỹ giờ rảnh + (nếu có)
   chủ đề. TUYỆT ĐỐI không bịa goalId ngoài danh sách. Không có incubatingGoals → "queue_pulls" rỗng.
18. Viết toàn bộ bằng tiếng Việt.

Chỉ trả về đúng JSON theo schema đã cho, không kèm văn bản hay markdown nào khác.`;

// breakdown steps (section 11) — array of short titles, optional
const SUBTASKS_SCHEMA = { type: 'ARRAY', items: { type: 'STRING' } } as const;

// time-slotting fields (section 14) — shared by both ordinary items & plan items
const SLOT_PROPS = {
  slotStart: { type: 'STRING', nullable: true },
  estimatedMinutes: { type: 'INTEGER', nullable: true },
  deepWork: { type: 'BOOLEAN', nullable: true },
} as const;

const ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    priority: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    reason: { type: 'STRING' },
    subtasks: SUBTASKS_SCHEMA,
    cue: { type: 'STRING', nullable: true },
    ...SLOT_PROPS,
  },
  required: ['title', 'priority', 'reason'],
} as const;

const PLAN_ITEM_SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    priority: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    reason: { type: 'STRING' },
    subtasks: SUBTASKS_SCHEMA,
    cue: { type: 'STRING', nullable: true },
    ...SLOT_PROPS,
    planId: { type: 'STRING' },
    milestoneId: { type: 'STRING', nullable: true },
  },
  required: ['title', 'priority', 'reason', 'planId'],
} as const;

// suggestion to pull an "Incubating" goal out to act on (section 17) — with a task/plan size hint
const QUEUE_PULL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    goalId: { type: 'STRING' },
    title: { type: 'STRING' },
    suggestApproach: { type: 'STRING', enum: ['task', 'plan'] },
    reason: { type: 'STRING' },
  },
  required: ['goalId', 'title', 'suggestApproach', 'reason'],
} as const;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    capacity_note: { type: 'STRING' },
    carry_over: { type: 'ARRAY', items: ITEM_SCHEMA },
    suggested_tasks: { type: 'ARRAY', items: ITEM_SCHEMA },
    plan_tasks: { type: 'ARRAY', items: PLAN_ITEM_SCHEMA },
    queue_pulls: { type: 'ARRAY', items: QUEUE_PULL_SCHEMA },
    recovery_day: { type: 'BOOLEAN' },
  },
  required: [
    'capacity_note',
    'carry_over',
    'suggested_tasks',
    'plan_tasks',
    'queue_pulls',
    'recovery_day',
  ],
} as const;

/** Strip ```json fences if the model accidentally adds them */
function stripFences(text: string): string {
  return text.replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '');
}

const PRIORITIES: readonly Priority[] = ['high', 'medium', 'low'];

/** Manually validate the JSON shape from the model — report exactly where it's wrong */
function parseResult(raw: string): SuggestionResult {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    throw new Error('Model trả về không phải JSON hợp lệ');
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj?.capacity_note !== 'string') {
    throw new Error('JSON thiếu trường capacity_note');
  }
  // breakdown steps array: keep only non-empty strings, drop if empty
  const parseSubtasks = (raw: unknown): string[] | undefined => {
    if (!Array.isArray(raw)) return undefined;
    const steps = raw
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim());
    return steps.length > 0 ? steps : undefined;
  };
  // time-slotting fields (section 14) — valid "HH:MM" slotStart, positive estimate, deepWork true
  const parseSlot = (item: Record<string, unknown>) => ({
    slotStart:
      typeof item.slotStart === 'string' && isValidHm(item.slotStart) ? item.slotStart : undefined,
    estimatedMinutes:
      typeof item.estimatedMinutes === 'number' && item.estimatedMinutes > 0
        ? Math.round(item.estimatedMinutes)
        : undefined,
    deepWork: item.deepWork === true ? true : undefined,
  });
  const parseItems = (key: 'carry_over' | 'suggested_tasks'): SuggestionItem[] => {
    const arr = obj[key];
    if (!Array.isArray(arr)) throw new Error(`JSON thiếu mảng ${key}`);
    return arr.map((it, i) => {
      const item = it as Record<string, unknown>;
      if (typeof item?.title !== 'string' || typeof item?.reason !== 'string') {
        throw new Error(`${key}[${i}] thiếu title/reason`);
      }
      const priority = PRIORITIES.includes(item.priority as Priority)
        ? (item.priority as Priority)
        : 'medium';
      return {
        title: item.title,
        priority,
        reason: item.reason,
        subtasks: parseSubtasks(item.subtasks),
        cue: typeof item.cue === 'string' && item.cue.trim() ? item.cue.trim() : undefined,
        ...parseSlot(item),
      };
    });
  };
  // plan_tasks: like ordinary items but with planId (required) + milestoneId (optional)
  const parsePlanItems = (): PlanSuggestionItem[] => {
    const arr = obj.plan_tasks;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it): PlanSuggestionItem | null => {
        const item = it as Record<string, unknown>;
        if (
          typeof item?.title !== 'string' ||
          typeof item?.reason !== 'string' ||
          typeof item?.planId !== 'string'
        ) {
          return null; // drop if the link is missing, don't break the whole response
        }
        const priority = PRIORITIES.includes(item.priority as Priority)
          ? (item.priority as Priority)
          : 'medium';
        return {
          title: item.title,
          priority,
          reason: item.reason,
          subtasks: parseSubtasks(item.subtasks),
          cue: typeof item.cue === 'string' && item.cue.trim() ? item.cue.trim() : undefined,
          ...parseSlot(item),
          planId: item.planId,
          milestoneId: typeof item.milestoneId === 'string' ? item.milestoneId : null,
        };
      })
      .filter((x): x is PlanSuggestionItem => x !== null);
  };

  // queue_pulls (section 17): suggestion to pull an Incubating goal out — the server still filters by real goalId
  const parseQueuePulls = (): QueuePullItem[] => {
    const arr = obj.queue_pulls;
    if (!Array.isArray(arr)) return [];
    return arr
      .map((it): QueuePullItem | null => {
        const item = it as Record<string, unknown>;
        if (
          typeof item?.goalId !== 'string' ||
          typeof item?.title !== 'string' ||
          typeof item?.reason !== 'string'
        ) {
          return null;
        }
        const approach = item.suggestApproach === 'plan' ? 'plan' : 'task';
        return {
          goalId: item.goalId,
          title: item.title,
          suggestApproach: approach,
          reason: item.reason,
        };
      })
      .filter((x): x is QueuePullItem => x !== null);
  };

  return {
    capacity_note: obj.capacity_note,
    carry_over: parseItems('carry_over'),
    suggested_tasks: parseItems('suggested_tasks'),
    plan_tasks: parsePlanItems(),
    queue_pulls: parseQueuePulls(),
    plan_alerts: [], // filled by the server later (dynamic figures, not made up by the model)
    recovery_day: obj.recovery_day === true,
  };
}

/**
 * Call Gemini (REST, JSON mode) with a response schema and return the raw JSON text.
 * Shared by both the tomorrow suggestion and plan decompose.
 */
async function callGeminiJson(
  systemPrompt: string,
  userText: string,
  responseSchema: object,
  temperature: number,
): Promise<string> {
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    throw new Error('Chưa cấu hình AI_API_KEY trong .env (xem .env.example)');
  }
  const model = process.env.AI_MODEL || 'gemini-2.5-flash';

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: userText }] }],
        generationConfig: {
          temperature,
          responseMimeType: 'application/json',
          responseSchema,
        },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Gemini lỗi ${res.status}: ${body.slice(0, 300)}`);
  }

  const payload = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('');
  if (!text) throw new Error('Gemini không trả về nội dung nào');
  return text;
}

/** Call Gemini to suggest tomorrow and return the validated result */
export async function suggestTomorrow(ctx: SuggestContext): Promise<SuggestionResult> {
  const text = await callGeminiJson(
    SYSTEM_PROMPT,
    `Dữ liệu của người dùng:\n${JSON.stringify(ctx, null, 2)}`,
    RESPONSE_SCHEMA,
    0.4,
  );
  return parseResult(text);
}

// ---- Discord notifications: the AI writes the "voice", the facts are supplied by code (section 13) ----

/** REAL facts (code assembles from the DB) for the AI to ground on, NOT to make up figures */
export interface NotificationFacts {
  kind: 'morning' | 'streak_guard' | 'random_nudge' | 'evening' | 'queue_nudge';
  /** current keep-the-flame streak (days) */
  streakCurrent: number;
  /** streak at risk (nothing done today yet) */
  streakAtRisk: boolean;
  doneCount: number;
  totalCount: number;
  undoneCount: number;
  /** suggested "main task" today/in progress — null if none */
  mitTitle: string | null;
  /** a few in-progress tasks (max ~3) for the nudge to ground on */
  sampleUndone: string[];
  /** names of plans behind schedule */
  behindPlans: string[];
  /** energy/day 0..100 if there's a check-in, null otherwise */
  capacityScore: number | null;
  /** today's hard schedule in the form "08:00–11:00 Math" (section 14) — empty if none */
  todaySchedule: string[];
  /** free minutes today after the hard schedule (section 14) */
  freeMinutesToday: number;
  /** number of goals currently in "Incubating" (section 17) */
  incubatingCount: number;
  /** the best-fit "Incubating" goal to suggest pulling out — null if none */
  topIncubatingGoal: string | null;
  /** id of topIncubatingGoal (internal — to set the lastNudgedAt cooldown after sending) */
  topIncubatingGoalId: string | null;
  /** size hint for topIncubatingGoal: "task" | "plan" — null if none */
  topIncubatingApproach: 'task' | 'plan' | null;
}

export interface ComposeNotificationInput {
  facts: NotificationFacts;
  include: { motivation: boolean; quote: boolean; tip: boolean };
  /** content sent recently — so the AI does NOT repeat a quote/tip */
  recentMessages: string[];
}

export interface NotificationVoice {
  /** 1–3 short sentences, supportive tone, fitting the notification kind */
  message: string;
  /** a nice quote (with author if known), null if disabled/not fitting */
  quote: string | null;
  /** one concrete, immediately actionable tip, null if disabled */
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
     Nếu "todaySchedule" có lịch cứng, nhắc khéo (vd "hôm nay có lịch học 8–11h, còn ~3h tối rảnh")
     để người dùng hình dung khung ngày — KHÔNG liệt kê dài dòng.
   - "streak_guard": nhắc DỊU DÀNG rằng làm 1 việc nhỏ là giữ được chuỗi N ngày. Khung tích cực ("giữ thành quả"),
     KHÔNG doạ ("sắp mất hết!"). Nếu streakCurrent nhỏ/0 thì khích lệ bắt đầu chuỗi mới.
   - "random_nudge": một cú hích NHẸ, thân thiện, gợi ý thử bắt tay vào một việc đang dở (dùng sampleUndone/mitTitle).
     Nếu không còn việc dở, khen ngợi và bảo cứ nghỉ ngơi.
   - "evening": đúc kết dịu dàng những gì làm được hôm nay, gợi ý ghi chú lại, không phán xét phần chưa xong.
   - "queue_nudge": người dùng đang có quỹ giờ rảnh ("freeMinutesToday"). Gợi ý NHẸ NHÀNG dạng CƠ HỘI (KHÔNG
     phải nghĩa vụ) rằng có thể lấy một điều đang "ấp ủ" ra làm — dùng "topIncubatingGoal" nếu có. Khung
     "đang rảnh, thử bắt đầu một chút", TUYỆT ĐỐI không hối thúc, không kể tội việc chưa làm. Nếu
     "topIncubatingApproach" = "plan", có thể gợi ý biến nó thành một kế hoạch nhỏ. Không có topIncubatingGoal
     → khích lệ nhẹ ngó qua mục "Ấp ủ".
3. "message" ngắn (≤ 3 câu), tiếng Việt tự nhiên, ấm áp, có thể dùng 0–1 emoji nhẹ nhàng (không lạm dụng).
4. "quote": nếu include.quote = true, cho MỘT câu nói hay/danh ngôn ngắn phù hợp tinh thần (kèm tác giả nếu có).
   Nếu false → null. KHÔNG trùng với các câu trong "recentMessages".
5. "tip": nếu include.tip = true, cho MỘT mẹo NĂNG SUẤT/THÓI QUEN cụ thể, làm được ngay (vd chia nhỏ việc,
   quy tắc 2 phút, if-then). Nếu false → null. KHÔNG trùng "recentMessages".
6. Nếu include.motivation = false, giữ "message" thuần thông tin, bớt phần khích lệ.
7. Viết toàn bộ bằng tiếng Việt.

Chỉ trả về đúng JSON theo schema, không kèm văn bản hay markdown nào khác.`;

const NOTIFY_SCHEMA = {
  type: 'OBJECT',
  properties: {
    message: { type: 'STRING' },
    quote: { type: 'STRING', nullable: true },
    tip: { type: 'STRING', nullable: true },
  },
  required: ['message'],
} as const;

/** Call Gemini to write the notification voice; throw on failure so the caller can fall back to static */
export async function composeNotificationVoice(
  input: ComposeNotificationInput,
): Promise<NotificationVoice> {
  const text = await callGeminiJson(
    NOTIFY_PROMPT,
    `Dữ kiện & yêu cầu:\n${JSON.stringify(input, null, 2)}`,
    NOTIFY_SCHEMA,
    0.8, // a bit higher for more varied wording, less repetition
  );
  let data: unknown;
  try {
    data = JSON.parse(stripFences(text));
  } catch {
    throw new Error('Model trả về không phải JSON hợp lệ');
  }
  const obj = data as Record<string, unknown>;
  if (typeof obj?.message !== 'string' || !obj.message.trim()) {
    throw new Error('JSON thiếu trường message');
  }
  return {
    message: obj.message.trim(),
    quote: typeof obj.quote === 'string' && obj.quote.trim() ? obj.quote.trim() : null,
    tip: typeof obj.tip === 'string' && obj.tip.trim() ? obj.tip.trim() : null,
  };
}

// ---- Decompose plan: long-term goal → milestone roadmap (section 10.7) ----

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
  type: 'OBJECT',
  properties: {
    milestones: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING' },
          order: { type: 'INTEGER' },
          targetDate: { type: 'STRING', nullable: true },
        },
        required: ['title', 'order'],
      },
    },
  },
  required: ['milestones'],
} as const;

/** Manually validate the decompose JSON shape */
function parseDecompose(raw: string): DecomposeResult {
  let data: unknown;
  try {
    data = JSON.parse(stripFences(raw));
  } catch {
    throw new Error('Model trả về không phải JSON hợp lệ');
  }
  const arr = (data as Record<string, unknown>)?.milestones;
  if (!Array.isArray(arr)) throw new Error('JSON thiếu mảng milestones');
  const milestones: MilestoneDraft[] = arr.map((it, i) => {
    const m = it as Record<string, unknown>;
    if (typeof m?.title !== 'string' || !m.title.trim()) {
      throw new Error(`milestones[${i}] thiếu title`);
    }
    const order = typeof m.order === 'number' ? m.order : i + 1;
    const targetDate = typeof m.targetDate === 'string' ? m.targetDate : null;
    return { title: m.title.trim(), order, targetDate };
  });
  // normalize order to a contiguous 1..n following the order the model returned
  milestones.sort((a, b) => a.order - b.order).forEach((m, i) => (m.order = i + 1));
  return { milestones };
}

/** Decompose parameters assembled from the create-plan form */
export interface DecomposeInput {
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  durationDays: number;
  intensity: Intensity;
}

/** Call Gemini to split a goal into a milestone roadmap */
export async function decomposePlan(input: DecomposeInput): Promise<DecomposeResult> {
  const text = await callGeminiJson(
    DECOMPOSE_PROMPT,
    `Thông tin kế hoạch:\n${JSON.stringify(input, null, 2)}`,
    DECOMPOSE_SCHEMA,
    0.5,
  );
  return parseDecompose(text);
}
