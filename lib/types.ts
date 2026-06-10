export type Emotion = "love" | "meh" | "hard";

export type Priority = "high" | "medium" | "low";

/** Một đề xuất của AI — luôn kèm reason truy ngược được về dữ liệu thật */
export interface SuggestionItem {
  title: string;
  priority: Priority;
  reason: string;
  /**
   * Khi việc quá lớn / hay trượt, AI có thể đề xuất chia thành các bước nhỏ (mục 11).
   * Rỗng/không có = việc đơn. Thêm "Ngày mai" sẽ tạo task cha + các task con này.
   */
  subtasks?: string[];
  /** gợi ý "khi nào/ở đâu" làm việc (implementation intention, mục 11) — tùy chọn */
  cue?: string;
}

/** Đề xuất phục vụ một kế hoạch — kèm liên kết để gắn task vào plan/milestone */
export interface PlanSuggestionItem extends SuggestionItem {
  planId: string;
  milestoneId: string | null;
}

/** Cảnh báo chậm tiến độ (mục 10.4) — số liệu tính ĐỘNG ở server, không để model bịa */
export interface PlanAlert {
  planId: string;
  planTitle: string;
  behindDays: number;
  options: string[];
}

/** Hợp đồng JSON model phải trả về (spec mục 6 + nhóm plan mục 10.7) */
export interface SuggestionResult {
  capacity_note: string;
  carry_over: SuggestionItem[];
  suggested_tasks: SuggestionItem[];
  /** việc rót từ kế hoạch đang chạy — model điền */
  plan_tasks: PlanSuggestionItem[];
  /** cảnh báo chậm — server điền sau khi model trả về */
  plan_alerts: PlanAlert[];
  /** ngày phục hồi (mục 11): sức thấp / nhiều ngày "hard" → chỉ đề xuất việc nhẹ */
  recovery_day: boolean;
}

/** DTO gọn cho client component — đã tính sẵn delay phía server */
export interface TaskDTO {
  id: string;
  title: string;
  done: boolean;
  emotion: Emotion | null;
  /** số ngày trì hoãn (0 nếu task mới trong ngày) */
  delay: number;
  /** tên plan nếu task phục vụ một kế hoạch (mục 10) — để hiện chip */
  planTitle?: string | null;
  /** các bước con nếu task này là "container" được chia nhỏ (mục 11) */
  subtasks?: TaskDTO[];
  /** gợi ý "khi nào/ở đâu" (implementation intention, mục 11) — tùy chọn */
  cue?: string | null;
  /** mức tác động 80/20 (mục 11) — để tính "việc chính" (MIT) */
  impact?: Priority | null;
  /** lý do trượt nếu đã ghi (mục 11) */
  slipReason?: string | null;
}

// ---- Kế hoạch (mục 10) ----

export type PlanStatus = "active" | "paused" | "done" | "archived";
export type Intensity = "nhẹ" | "vừa" | "dồn";

/** Một cột mốc model trả về từ bước decompose (chưa có id, chưa lưu DB) */
export interface MilestoneDraft {
  title: string;
  order: number;
  targetDate: string | null;
}

/** Hợp đồng JSON cho route /api/plan/decompose */
export interface DecomposeResult {
  milestones: MilestoneDraft[];
}

// ---- Lịch trình (mục 14) ----

export type ScheduleKind = "hoc" | "lam" | "khac";

/** Lịch cứng lặp theo tuần (khớp model Commitment) */
export interface CommitmentDTO {
  id: string;
  title: string;
  dayOfWeek: number; // 0=CN .. 6=T7
  startTime: string; // "HH:MM"
  endTime: string;
  kind: ScheduleKind;
  active: boolean;
}

/** Sự kiện đột xuất một lần (khớp model ScheduleEvent) */
export interface ScheduleEventDTO {
  id: string;
  title: string;
  date: string; // "YYYY-MM-DD"
  startTime: string | null;
  endTime: string | null;
  kind: ScheduleKind;
  cancels: boolean;
}

/** Một khối lịch đã "phẳng hoá" cho một ngày cụ thể (commitment hoặc event) */
export interface ScheduleBlock {
  id: string;
  title: string;
  startTime: string | null; // null = cả ngày
  endTime: string | null;
  kind: ScheduleKind;
  source: "commitment" | "event" | "soft";
}

/** Một khe giờ rảnh trong ngày (mục 14) — tính động từ computeFreeSlots */
export interface FreeSlot {
  start: string; // "HH:MM"
  end: string; // "HH:MM"
  durationMin: number;
}

/** Kết quả tính quỹ thời gian một ngày (mục 14) */
export interface CapacityResult {
  slots: FreeSlot[];
  capacityMin: number; // tổng phút rảnh (sau buffer, bỏ khe ngắn)
  wakingMin: number; // tổng phút trong giờ thức
  busyMin: number; // tổng phút bận (đã gộp chồng + buffer)
}

/** Cấu hình lịch trình (lib/schedule-settings.ts) — khớp model ScheduleSettings */
export interface ScheduleSettingsDTO {
  wakeTime: string;
  sleepTime: string;
  bufferMin: number;
  minSlotMin: number;
  termAnchorMonday: string | null;
}

// ---- Thông báo Discord (mục 13) ----

/** Bốn loại thông báo — khớp cột `kind` của NotificationLog */
export type NotificationKind =
  | "morning" // bản tin sáng
  | "streak_guard" // nhắc giữ streak khi atRisk
  | "random_nudge" // cú hích ngẫu nhiên làm task
  | "evening"; // đúc kết tối

/** Preset cường độ — chỉ là gợi ý UI để set nhanh các toggle bên dưới */
export type NotificationIntensity = "minimal" | "balanced" | "active";

/** Cấu hình thông báo (1 hàng, app một người dùng) — khớp model Prisma */
export interface NotificationSettingsDTO {
  enabled: boolean;
  discordWebhookUrl: string;
  intensity: NotificationIntensity;
  morningEnabled: boolean;
  morningTime: string;
  streakGuardEnabled: boolean;
  streakGuardTime: string;
  randomNudgeEnabled: boolean;
  eveningEnabled: boolean;
  eveningTime: string;
  randomWindowStart: string;
  randomWindowEnd: string;
  quietStart: string;
  quietEnd: string;
  includeMotivation: boolean;
  includeQuote: boolean;
  includeTip: boolean;
}

/** Tiến độ tính ĐỘNG của một plan (lib/plan.ts) — không lưu DB */
export interface PlanProgress {
  total: number;
  done: number;
  progressPct: number;
  /** > 0: chậm; < 0: nhanh; 0: đúng tiến độ */
  behindDays: number;
  daysLeft: number;
  /** cột mốc đang làm (milestone chưa done đầu tiên), null nếu xong hết */
  currentMilestone: string | null;
}
