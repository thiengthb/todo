import { daysBetween, toDateStr, todayStr } from './dates';
import type { FreeSlot } from './types';

/**
 * Pure logic for "Incubating" (section 17) — the queue of uncommitted goals.
 *
 * Every metric (age, staleness, suggestion order) is computed DYNAMICALLY here, NOT stored in a column — like
 * the way delay/streak/plan-progress are computed. Side-effect-free, easy to test, reusable across
 * UI + notification + MCP.
 */

/** Minimum needed to compute the metrics — matches both a Prisma row and a DTO */
export interface GoalLite {
  title: string;
  note?: string | null;
  pinned: boolean;
  snoozedUntil: string | null;
  lastNudgedAt?: Date | null;
  createdAt: Date;
}

/** Number of days since the goal was captured (dynamic age) */
export function goalAgeDays(goal: { createdAt: Date }, today: string = todayStr()): number {
  return Math.max(0, daysBetween(toDateStr(goal.createdAt), today));
}

/** Is the snooze still in effect? (the scheduled snooze date hasn't arrived) */
export function isSnoozed(
  goal: { snoozedUntil: string | null },
  today: string = todayStr(),
): boolean {
  return goal.snoozedUntil != null && daysBetween(today, goal.snoozedUntil) > 0;
}

/**
 * "Compassion for old items" (section 11.2): a goal sitting idle ≥30 days, not pinned, not snoozed
 * → enable a gentle "still want this? keep / drop" hint. Non-judgmental, dismissible.
 */
export function isStale(goal: GoalLite, today: string = todayStr()): boolean {
  if (goal.pinned || isSnoozed(goal, today)) return false;
  return goalAgeDays(goal, today) >= 30;
}

/**
 * Estimate a goal's "size" from text — a SOFT signal only, to match against free slots when ordering
 * suggestions. NOT a task/plan verdict (the AI handles that, section 17). Heuristic: more words / has
 * a note → seems larger.
 */
export function estimateGoalSize(goal: {
  title: string;
  note?: string | null;
}): 'small' | 'medium' | 'large' {
  const words = goal.title.trim().split(/\s+/).filter(Boolean).length;
  const hasNote = !!goal.note && goal.note.trim().length > 0;
  const weight = words + (hasNote ? 4 : 0);
  if (weight <= 3) return 'small';
  if (weight <= 6) return 'medium';
  return 'large';
}

/** Fit score between goal size and the longest free slot + capacity (0..100) */
function fitScore(
  size: 'small' | 'medium' | 'large',
  longestSlotMin: number,
  capacity: number, // 0..100 (null already replaced with a neutral value)
): number {
  const roomy = longestSlotMin >= 120 && capacity >= 55; // long slot + good energy → fits big tasks
  const tight = longestSlotMin < 60 || capacity < 40; // short slot / tired → fits small tasks
  if (roomy) return size === 'large' ? 100 : size === 'medium' ? 70 : 40;
  if (tight) return size === 'small' ? 100 : size === 'medium' ? 60 : 20;
  return size === 'medium' ? 90 : 70; // in between: prefer medium tasks
}

/**
 * Order goals for SUGGESTION (notification, Today card, suggest context) — "fit to time budget &
 * energy" (section 17). Priority: pinned › not nudged recently › fits free slot/energy › newer.
 * Filters out snoozed goals. Returns a new array (does not touch the input).
 */
export function rankGoalsForNudge<T extends GoalLite>(
  goals: T[],
  freeSlots: FreeSlot[],
  capacityScore: number | null,
  today: string = todayStr(),
): T[] {
  const longestSlotMin = freeSlots.reduce((m, s) => Math.max(m, s.durationMin), 0);
  const capacity = capacityScore ?? 60; // null = neutral, leaning positive
  const candidates = goals.filter((g) => !isSnoozed(g, today));

  const scored = candidates.map((g) => {
    let score = fitScore(estimateGoalSize(g), longestSlotMin, capacity);
    if (g.pinned) score += 1000;
    // throttle: nudged within the last 3 days → drop hard to avoid repeating
    if (g.lastNudgedAt && daysBetween(toDateStr(g.lastNudgedAt), today) < 3) score -= 500;
    // newer ones edge ahead as a tie-breaker (a freshly captured goal is still "hot")
    score += Math.max(0, 30 - goalAgeDays(g, today)) * 0.1;
    return { g, score };
  });

  return scored.sort((a, b) => b.score - a.score).map((s) => s.g);
}
