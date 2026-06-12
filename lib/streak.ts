import { daysBetween } from './dates';

/** A keep-the-flame streak: consecutive active days */
export interface StreakRun {
  start: string; // "YYYY-MM-DD"
  end: string; // "YYYY-MM-DD"
  length: number; // number of days in the streak
}

export interface StreakSummary {
  /** number of consecutive days up to today (or yesterday if there's no activity today yet) */
  current: number;
  /** streak still alive but no task done today — need to do 1 task to keep it */
  atRisk: boolean;
  /** longest streak ever reached */
  longest: number;
  /** all streaks, most recent first */
  runs: StreakRun[];
}

/**
 * Compute the streak FULLY DYNAMICALLY from a list of "active days" (days with ≥1 done task).
 * Not stored, to avoid data drift — per the project's principle (like delayDays).
 *
 * ONE-DAY GRACE (section 11, "never miss twice"): missing a SINGLE isolated day does NOT break the streak —
 * that day is "frozen", and the streak continues when activity resumes. Only missing TWO consecutive
 * days breaks it. `length` counts real active days (not frozen days), matching the
 * evidence (Lally): skipping 1 day doesn't harm automaticity, but it needs kindness, not punishment.
 */
export function computeStreaks(activeDays: string[], today: string): StreakSummary {
  // unique, drop future days (not counted in the streak), sort ascending
  const days = [...new Set(activeDays)].filter((d) => d <= today).sort();
  if (days.length === 0) {
    return { current: 0, atRisk: false, longest: 0, runs: [] };
  }

  const runs: StreakRun[] = [];
  let start = days[0];
  let prev = days[0];
  let count = 1; // number of active days in the run (not counting frozen days)
  for (let i = 1; i < days.length; i++) {
    // gap ≤ 2: adjacent (1) or exactly 1 day missed (2) → still the same streak (grace)
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

  // The current streak is alive if the last run ends within 2 days (thanks to the grace).
  // gap 0: already kept today. gap 1 (missed today, yesterday had it) / gap 2 (missed yesterday, none yet today):
  // still salvageable — doing 1 task today continues it; skipping today too (gap becomes ≥3) breaks it.
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

  runs.reverse(); // most recent first
  return { current, atRisk, longest, runs };
}
