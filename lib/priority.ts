import type { TaskDTO } from './types';

const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * 80/20 score (section 11): prioritize high-impact tasks, those belonging to a plan, those delayed.
 * Used to pick the day's "main task" (MIT) — does NOT reorder the list
 * (keeps the entry order for familiarity), only highlights 1 task.
 */
function valueScore(t: TaskDTO): number {
  const impact = t.impact ? IMPACT_RANK[t.impact] : 0;
  return impact * 10 + (t.planTitle ? 3 : 0) + Math.min(t.delay, 5);
}

/**
 * Pick the id of today's "main task": the NOT-done task with the highest 80/20 score.
 * Only returns when there are ≥2 unfinished tasks and the top one truly has a signal (score > 0),
 * so the "main task" badge is meaningful.
 */
export function pickMitId(leaves: TaskDTO[]): string | null {
  const undone = leaves.filter((t) => !t.done);
  if (undone.length < 2) return null;
  let best = undone[0];
  for (const t of undone) {
    if (valueScore(t) > valueScore(best)) best = t;
  }
  return valueScore(best) > 0 ? best.id : null;
}
