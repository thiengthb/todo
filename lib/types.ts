export type Emotion = "love" | "meh" | "hard";

export type Priority = "high" | "medium" | "low";

/** Một đề xuất của AI — luôn kèm reason truy ngược được về dữ liệu thật */
export interface SuggestionItem {
  title: string;
  priority: Priority;
  reason: string;
}

/** Hợp đồng JSON model phải trả về (spec mục 6) */
export interface SuggestionResult {
  capacity_note: string;
  carry_over: SuggestionItem[];
  suggested_tasks: SuggestionItem[];
}

/** DTO gọn cho client component — đã tính sẵn delay phía server */
export interface TaskDTO {
  id: string;
  title: string;
  done: boolean;
  emotion: Emotion | null;
  /** số ngày trì hoãn (0 nếu task mới trong ngày) */
  delay: number;
}
