/** Định dạng Date → "YYYY-MM-DD" theo giờ địa phương (không dùng UTC để khỏi lệch ngày) */
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

/** Số ngày nguyên giữa 2 chuỗi "YYYY-MM-DD" (to - from) */
export function daysBetween(from: string, to: string): number {
  const f = new Date(`${from}T00:00:00`);
  const t = new Date(`${to}T00:00:00`);
  return Math.round((t.getTime() - f.getTime()) / 86_400_000);
}

/**
 * Mức trì hoãn của một task chưa xong — tính động theo spec:
 * số ngày từ carriedFrom (nếu có) hoặc ngày tạo, đến hôm nay.
 */
export function delayDays(task: { carriedFrom: string | null; createdAt: Date }): number {
  const origin = task.carriedFrom ?? toDateStr(task.createdAt);
  return Math.max(0, daysBetween(origin, todayStr()));
}

/** "Thứ Bảy, 7 tháng 6" — hiển thị tiêu đề ngày */
export function formatDateVN(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

/** Cộng/trừ n ngày trên chuỗi "YYYY-MM-DD" */
export function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  d.setDate(d.getDate() + n);
  return toDateStr(d);
}

/** Nhãn thân thiện: Hôm nay / Ngày mai / Hôm qua / thứ trong tuần */
export function dayLabel(dateStr: string): string {
  const diff = daysBetween(todayStr(), dateStr);
  if (diff === 0) return 'Hôm nay';
  if (diff === 1) return 'Ngày mai';
  if (diff === -1) return 'Hôm qua';
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    weekday: 'long',
  });
}

/** "06/06" — dạng ngắn cho dòng timeline */
export function formatDateShort(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00`).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
  });
}

/** Chuỗi hợp lệ dạng YYYY-MM-DD? */
export function isValidDateStr(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T00:00:00`).getTime());
}

const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/** Nhãn thứ ngắn tiếng Việt: CN, T2..T7 */
export function weekdayShortVN(dayOfWeek: number): string {
  return WEEKDAY_SHORT[((dayOfWeek % 7) + 7) % 7];
}

/** Ngày thứ Hai của tuần chứa dateStr (tuần bắt đầu T2) */
export function mondayOf(dateStr: string): string {
  const dow = new Date(`${dateStr}T00:00:00`).getDay(); // 0=CN..6=T7
  const offset = dow === 0 ? -6 : 1 - dow;
  return addDays(dateStr, offset);
}
