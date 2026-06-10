/**
 * Timezone helper cho MCP (mục 15): DB lưu UTC, MCP giao tiếp ISO 8601, "ngày địa phương"
 * (cột `date` dạng "YYYY-MM-DD" của app) quy theo DEFAULT_TIMEZONE.
 */

export function defaultTz(): string {
  return process.env.DEFAULT_TIMEZONE || "Asia/Ho_Chi_Minh";
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
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Hôm nay ("YYYY-MM-DD") theo DEFAULT_TIMEZONE. */
export function todayLocal(tz: string = defaultTz()): string {
  return localDay(new Date(), tz);
}
