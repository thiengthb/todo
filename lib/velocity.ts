/**
 * Real velocity computed DYNAMICALLY — matches exactly how `/api/suggest` computes `weeklyAvg.avgDonePerDay`
 * so the number shown on the Today page MATCHES the number the AI uses (transparent, no drift).
 *
 * Only counts days that ACTUALLY have tasks (daysWithData) — skip empty days so they don't drag down
 * the average. Takes leaf tasks (containers already filtered at the call site), each with `date` + `done`.
 */
export interface Velocity {
  /** average tasks done per day-with-data (rounded to 1 decimal) */
  avgDonePerDay: number;
  /** number of days with at least 1 task in the window — confidence of the number */
  daysWithData: number;
}

export function computeVelocity(tasks: { date: string; done: boolean }[]): Velocity | null {
  const byDate = new Map<string, number>();
  let totalDone = 0;
  for (const t of tasks) {
    byDate.set(t.date, (byDate.get(t.date) ?? 0) + (t.done ? 1 : 0));
    if (t.done) totalDone += 1;
  }
  const daysWithData = byDate.size;
  if (daysWithData === 0) return null;
  return {
    avgDonePerDay: Math.round((totalDone / daysWithData) * 10) / 10,
    daysWithData,
  };
}
