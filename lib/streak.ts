import { daysBetween } from './dates';

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
 * ÂN HẠN 1 NGÀY (mục 11, "never miss twice"): lỡ MỘT ngày đơn lẻ KHÔNG làm đứt chuỗi —
 * ngày đó được "đóng băng", chuỗi nối tiếp khi hoạt động trở lại. Chỉ lỡ HAI ngày liên
 * tiếp mới đứt. `length` đếm số ngày hoạt động thật (không tính ngày đóng băng), khớp
 * bằng chứng (Lally): bỏ 1 ngày không hại sự tự động hoá, nhưng cần kindness không phạt.
 */
export function computeStreaks(activeDays: string[], today: string): StreakSummary {
  // unique, bỏ ngày tương lai (không tính vào chuỗi), sort tăng dần
  const days = [...new Set(activeDays)].filter((d) => d <= today).sort();
  if (days.length === 0) {
    return { current: 0, atRisk: false, longest: 0, runs: [] };
  }

  const runs: StreakRun[] = [];
  let start = days[0];
  let prev = days[0];
  let count = 1; // số ngày hoạt động trong run (không tính ngày đóng băng)
  for (let i = 1; i < days.length; i++) {
    // gap ≤ 2: liền kề (1) hoặc lỡ đúng 1 ngày (2) → vẫn cùng chuỗi (ân hạn)
    if (daysBetween(prev, days[i]) <= 2) {
      prev = days[i];
      count += 1;
    } else {
      runs.push({ start, end: prev, length: count });
      start = days[i];
      prev = days[i];
      count = 1;
    }
  }
  runs.push({ start, end: prev, length: count });

  const longest = Math.max(...runs.map((r) => r.length));

  // Chuỗi hiện tại còn sống nếu run cuối kết thúc trong vòng 2 ngày (nhờ ân hạn).
  // gap 0: đã giữ hôm nay. gap 1 (lỡ hôm nay, hôm qua có) / gap 2 (lỡ hôm qua, nay chưa):
  // còn cứu được — làm 1 việc hôm nay là nối tiếp; bỏ luôn hôm nay (gap thành ≥3) mới đứt.
  const last = runs[runs.length - 1];
  const gap = daysBetween(last.end, today);
  let current = 0;
  let atRisk = false;
  if (gap === 0) {
    current = last.length;
  } else if (gap === 1 || gap === 2) {
    current = last.length;
    atRisk = true;
  }

  runs.reverse(); // mới nhất trước
  return { current, atRisk, longest, runs };
}
