/** "HH:MM" time helpers in the server's LOCAL TIME (prod sets TZ=Asia/Ho_Chi_Minh). */

/** "07:30" → 450 (minutes from midnight). Bad format → -1. */
export function hmToMinutes(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
  return h * 60 + min;
}

/** Date → "HH:MM" local time */
export function toHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Minutes-from-midnight → "HH:MM" (inverse of hmToMinutes). Clamped to [0, 1439]. */
export function minutesToHm(min: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** Valid "HH:MM"? */
export function isValidHm(hm: string): boolean {
  return hmToMinutes(hm) >= 0;
}

/** Date → minutes from midnight (local time) */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * Whether nowMin falls within [start, end) — HANDLES wrapping across midnight.
 * E.g. quiet 22:00→07:00: both 23:30 and 06:00 fall within.
 */
export function isWithinWindow(nowMin: number, startHm: string, endHm: string): boolean {
  const s = hmToMinutes(startHm);
  const e = hmToMinutes(endHm);
  if (s < 0 || e < 0) return false;
  if (s === e) return false; // empty window
  return s < e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e;
}

/**
 * "Target" minute in the day for the random nudge — seeded by DATE so it's fixed
 * within the day (avoids Math.random causing double-fire / hard to test), but changes daily.
 * Returns a minute-from-midnight within [windowStart, windowEnd). -1 if the window is invalid.
 */
export function randomNudgeTargetMinute(
  dateStr: string,
  windowStart: string,
  windowEnd: string,
): number {
  const s = hmToMinutes(windowStart);
  let e = hmToMinutes(windowEnd);
  if (s < 0 || e < 0) return -1;
  if (e <= s) e = s + 60; // minimum 1-hour window if the config is odd
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  const span = e - s;
  return s + (Math.abs(h) % span);
}
