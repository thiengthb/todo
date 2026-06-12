/** Format Date → "YYYY-MM-DD" in local time (not UTC, to avoid date drift) */
export function toDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayStr(): string {
  return toDateStr(new Date());
}

export function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return toDateStr(d);
}

/** Whole number of days between 2 "YYYY-MM-DD" strings (to - from) */
export function daysBetween(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  return Math.round((t.getTime() - f.getTime()) / 86_400_000);
}

/**
 * The delay of an unfinished task — computed dynamically per the spec:
 * number of days from carriedFrom (if present) or the creation date, to today.
 */
export function delayDays(task: { carriedFrom: string | null; createdAt: Date }): number {
  const origin = task.carriedFrom ?? toDateStr(task.createdAt);
  return Math.max(0, daysBetween(origin, todayStr()));
}

/** "Thứ Bảy, 7 tháng 6" — display for a day title */
export function formatDateVN(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Add/subtract n days on a "YYYY-MM-DD" string */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Friendly label: Today / Tomorrow / Yesterday / weekday */
export function dayLabel(dateStr: string): string {
  const diff = daysBetween(todayStr(), dateStr);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  if (diff === -1) return 'Hôm qua';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
  });
}

/** "06/06" — short form for the timeline row */
export function formatDateShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

/** Valid YYYY-MM-DD string? */
export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
}

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Short Vietnamese weekday label: CN, T2..T7 */
export function weekdayShortVN(dayOfWeek: number): string {
  return WEEKDAY_SHORT[((dayOfWeek % 7) + 7) % 7];
}

/** The Monday of the week containing dateStr (week starts Monday) */
export function mondayOf(dateStr: string): string {
  const dow = new Date(`${dateStr}T00:00:00`).getDay(); // 0=Sun..6=Sat
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, offset);
}
