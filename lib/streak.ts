import { daysBetween } from "./dates";

/** Một chuỗi giữ lửa: các ngày hoạt động liên tiếp nhau */
export interface StreakRun {
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
  length: number; // số ngày trong chuỗi
}

export interface StreakSummary {
  /** số ngày liên tiếp tính đến hôm nay (hoặc hôm qua nếu hôm nay chưa hoạt động) */
  current: number;
  /** chuỗi còn sống nhưng hôm nay chưa có việc xong — cần làm 1 việc để giữ */
  atRisk: boolean;
  /** chuỗi dài nhất từng đạt */
  longest: number;
  /** tất cả các chuỗi, mới nhất trước */
  runs: StreakRun[];
}

/**
 * Tính streak HOÀN TOÀN ĐỘNG từ danh sách "ngày hoạt động" (ngày có ≥1 việc done).
 * Không lưu cứng để tránh lệch dữ liệu — theo nguyên tắc của project (giống delayDays).
 *
 * Một chuỗi = các ngày hoạt động cách nhau đúng 1 ngày.
 * Chuỗi hiện tại còn sống nếu kết thúc ở hôm nay (đã giữ) hoặc hôm qua (đang treo,
 * `atRisk`): hoàn thành 1 việc hôm nay là nối tiếp, bỏ qua hôm nay là đứt.
 */
export function computeStreaks(
  activeDays: string[],
  today: string
): StreakSummary {
  // unique, bỏ ngày tương lai (không tính vào chuỗi), sort tăng dần
  const days = [...new Set(activeDays)].filter((d) => d <= today).sort();
  if (days.length === 0) {
    return { current: 0, atRisk: false, longest: 0, runs: [] };
  }

  const runs: StreakRun[] = [];
  let start = days[0];
  let prev = days[0];
  for (let i = 1; i < days.length; i++) {
    if (daysBetween(prev, days[i]) === 1) {
      prev = days[i];
    } else {
      runs.push({ start, end: prev, length: daysBetween(start, prev) + 1 });
      start = days[i];
      prev = days[i];
    }
  }
  runs.push({ start, end: prev, length: daysBetween(start, prev) + 1 });

  const longest = Math.max(...runs.map((r) => r.length));

  // Chuỗi hiện tại: run cuối phải kết thúc ở hôm nay (gap 0) hoặc hôm qua (gap 1)
  const last = runs[runs.length - 1];
  const gap = daysBetween(last.end, today);
  let current = 0;
  let atRisk = false;
  if (gap === 0) {
    current = last.length;
  } else if (gap === 1) {
    current = last.length;
    atRisk = true;
  }

  runs.reverse(); // mới nhất trước
  return { current, atRisk, longest, runs };
}
