import { daysBetween, todayStr } from './dates';
import type { PlanProgress } from './types';

/** A minimal milestone for computing progress */
interface MilestoneLite {
  order: number;
  done: boolean;
}

/**
 * Compute a plan's progress FULLY DYNAMICALLY (section 10.5) — not stored, avoiding data
 * drift, like the way delay/streak are computed.
 *
 * - progressPct: milestones done / total.
 * - behindDays: the gap between the "schedule-expected milestone" and actual progress, in days.
 *   expectedFraction = time elapsed / total time; behindDays = round(
 *   (expectedFraction - actualFraction) × total days). > 0 means behind.
 * - currentMilestone: the not-done milestone with the smallest order.
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
  // time elapsed, clamped to [0, totalDays] so it doesn't exceed bounds past/before the deadline
  const elapsed = Math.min(totalDays, Math.max(0, daysBetween(plan.startDate, today)));
  const expectedFraction = elapsed / totalDays;
  const actualFraction = total === 0 ? 0 : done / total;
  const behindDays = Math.round((expectedFraction - actualFraction) * totalDays);

  const daysLeft = daysBetween(today, plan.endDate);

  const current = [...milestones].filter((m) => !m.done).sort((a, b) => a.order - b.order)[0];

  return {
    total,
    done,
    progressPct,
    behindDays,
    daysLeft,
    expectedFraction,
    currentMilestone: current?.title ?? null,
  };
}

/** Sort milestones by order (shared helper for UI/AI) */
export function sortMilestones<T extends MilestoneLite>(milestones: T[]): T[] {
  return [...milestones].sort((a, b) => a.order - b.order);
}
