/**
 * Timezone helper cho MCP (mục 15): DB lưu UTC, MCP giao tiếp ISO 8601, "ngày địa phương"
 * (cột `date` dạng "YYYY-MM-DD" của app) quy theo DEFAULT_TIMEZONE.
 */

export function defaultTz(): string {
  return process.env.DEFAULT_TIMEZONE || 'Asia/Ho_Chi_Minh';
}

/** Parse chuỗi ISO 8601 → Date; ném lỗi rõ nếu sai. */
export function parseIso(iso: string): Date {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) {
    throw new Error(`Thời gian không hợp lệ (cần ISO 8601): ${iso}`);
  }
  return d;
}

/** "YYYY-MM-DD" theo múi giờ tz cho một mốc thời gian (dùng để set cột `date`). */
export function localDay(date: Date, tz: string = defaultTz()): string {
  // en-CA cho định dạng YYYY-MM-DD; timeZone quy về ngày địa phương
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Hôm nay ("YYYY-MM-DD") theo DEFAULT_TIMEZONE. */
export function todayLocal(tz: string = defaultTz()): string {
  return localDay(new Date(), tz);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** Offset (phút, local − UTC) của một mốc thời gian tại tz. VD Asia/Ho_Chi_Minh = +420. */
function tzOffsetMinutes(at: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const m: Record<string, string> = {};
  for (const p of parts) m[p.type] = p.value;
  const asUtc = Date.UTC(+m.year, +m.month - 1, +m.day, +m.hour, +m.minute, +m.second);
  return (asUtc - at.getTime()) / 60000;
}

/**
 * Đổi "YYYY-MM-DD" → Date = NỬA ĐÊM ĐỊA PHƯƠNG của ngày đó tại tz (đúng quy ước app),
 * KHÔNG phải UTC-midnight như `new Date("2026-06-11")`. Lưu vào cột DateTime sẽ đọc lại
 * đúng ngày khi quy về `localDay`.
 */
export function localMidnightUtc(dateStr: string, tz: string = defaultTz()): Date {
  if (!DATE_ONLY.test(dateStr)) {
    throw new Error(`Cần ngày dạng YYYY-MM-DD: ${dateStr}`);
  }
  const [y, mo, d] = dateStr.split('-').map(Number);
  const utcGuess = Date.UTC(y, mo - 1, d, 0, 0, 0);
  const offset = tzOffsetMinutes(new Date(utcGuess), tz);
  return new Date(utcGuess - offset * 60000);
}

/**
 * Parser ngày KHOAN DUNG cho I/O của MCP: nhận CẢ "YYYY-MM-DD" (→ nửa đêm địa phương)
 * LẪN ISO 8601 đầy đủ (→ đúng mốc). Dùng cho scheduledFor/dueDate/startDate/targetEndDate.
 */
export function coerceToInstant(input: string, tz: string = defaultTz()): Date {
  return DATE_ONLY.test(input) ? localMidnightUtc(input, tz) : parseIso(input);
}

/** True nếu chuỗi parse được thành mốc thời gian (date-only hoặc ISO 8601) — cho zod refine. */
export function isDateOrIso(input: string): boolean {
  if (DATE_ONLY.test(input)) return true;
  return !Number.isNaN(new Date(input).getTime());
}
