import { addDays } from '@/lib/dates';
import type { HabitDTO, HabitStatus } from '@/lib/types';

/** 0=Sun..6=Sat of a "YYYY-MM-DD" date string (local time) */
function dowOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

/** Whether a habit is "due" on this day (daysOfWeek null = daily) */
export function habitDueOn(habit: Pick<HabitDTO, 'daysOfWeek'>, dateStr: string): boolean {
  if (!habit.daysOfWeek) return true;
  const days = habit.daysOfWeek
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n));
  return days.includes(dowOf(dateStr));
}

/**
 * Dynamic state of a habit (section 11) — NOT stored, inferred from the ticked days.
 * streak = number of consecutive DUE-DAYS (going back from today) that were ticked; not ticking today does NOT
 * break it (light grace — it's just informational feedback, not a score).
 */
export function computeHabitStatus(
  habit: Pick<HabitDTO, 'daysOfWeek'>,
  checkedDates: string[],
  today: string,
): HabitStatus {
  const checked = new Set(checkedDates);
  const dueToday = habitDueOn(habit, today);
  const doneToday = checked.has(today);

  let streak = 0;
  // scan up to ~1 year of due-days, going backwards
  for (let i = 0; i < 366; i++) {
    const day = addDays(today, -i);
    if (!habitDueOn(habit, day)) continue;
    if (checked.has(day)) {
      streak += 1;
    } else if (day === today) {
      continue; // not ticked today — not counted yet, but doesn't break the streak
    } else {
      break;
    }
  }
  return { dueToday, doneToday, streak };
}
