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
