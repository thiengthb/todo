import { daysBetween, todayStr } from "./dates";
import type { PlanProgress } from "./types";

/** Một milestone tối thiểu để tính tiến độ */
interface MilestoneLite {
  order: number;
  done: boolean;
}

/**
 * Tính tiến độ một plan HOÀN TOÀN ĐỘNG (mục 10.5) — không lưu cứng, tránh lệch
 * dữ liệu giống cách tính delay/streak.
 *
 * - progressPct: số milestone done / tổng.
 * - behindDays: chênh giữa "mốc kỳ vọng theo lịch" và tiến độ thực, quy ra ngày.
 *   expectedFraction = thời gian đã trôi / tổng thời gian; behindDays = round(
 *   (expectedFraction - actualFraction) × tổng ngày). > 0 nghĩa là đang chậm.
 * - currentMilestone: milestone chưa done có order nhỏ nhất.
 */
export function computePlanProgress(
  plan: { startDate: string; endDate: string },
  milestones: { order: number; done: boolean; title: string }[],
  today: string = todayStr(),
): PlanProgress {
  const total = milestones.length;
  const done = milestones.filter((m) => m.done).length;
  const progressPct = total === 0 ? 0 : Math.round((done / total) * 100);

  const totalDays = Math.max(1, daysBetween(plan.startDate, plan.endDate));
  // thời gian đã trôi, kẹp trong [0, totalDays] để không vượt biên khi quá/chưa tới hạn
  const elapsed = Math.min(
    totalDays,
    Math.max(0, daysBetween(plan.startDate, today)),
  );
  const expectedFraction = elapsed / totalDays;
  const actualFraction = total === 0 ? 0 : done / total;
  const behindDays = Math.round(
    (expectedFraction - actualFraction) * totalDays,
  );

  const daysLeft = daysBetween(today, plan.endDate);

  const current = [...milestones]
    .filter((m) => !m.done)
    .sort((a, b) => a.order - b.order)[0];

  return {
    total,
    done,
    progressPct,
    behindDays,
    daysLeft,
    currentMilestone: current?.title ?? null,
  };
}

/** Sắp xếp milestone theo order (helper dùng chung cho UI/AI) */
export function sortMilestones<T extends MilestoneLite>(milestones: T[]): T[] {
  return [...milestones].sort((a, b) => a.order - b.order);
}
