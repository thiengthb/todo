/** Helper giờ "HH:MM" theo GIỜ ĐỊA PHƯƠNG của server (prod set TZ=Asia/Ho_Chi_Minh). */

/** "07:30" → 450 (phút từ nửa đêm). Sai định dạng → -1. */
export function hmToMinutes(hm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm.trim());
  if (!m) return -1;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return -1;
  return h * 60 + min;
}

/** Date → "HH:MM" giờ địa phương */
export function toHm(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Phút-từ-nửa-đêm → "HH:MM" (đảo của hmToMinutes). Kẹp trong [0, 1439]. */
export function minutesToHm(min: number): string {
  const clamped = Math.max(0, Math.min(1439, Math.round(min)));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/** "HH:MM" hợp lệ? */
export function isValidHm(hm: string): boolean {
  return hmToMinutes(hm) >= 0;
}

/** Date → số phút từ nửa đêm (giờ địa phương) */
export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

/**
 * nowMin có nằm trong [start, end) không — XỬ LÝ vắt qua nửa đêm.
 * VD quiet 22:00→07:00: 23:30 và 06:00 đều nằm trong.
 */
export function isWithinWindow(nowMin: number, startHm: string, endHm: string): boolean {
  const s = hmToMinutes(startHm);
  const e = hmToMinutes(endHm);
  if (s < 0 || e < 0) return false;
  if (s === e) return false; // cửa sổ rỗng
  return s < e ? nowMin >= s && nowMin < e : nowMin >= s || nowMin < e;
}

/**
 * Mốc phút "mục tiêu" trong ngày cho cú hích ngẫu nhiên — seed theo NGÀY để cố định
 * trong ngày (tránh Math.random gây double-fire / khó test), nhưng đổi mỗi ngày.
 * Trả phút-từ-nửa-đêm nằm trong [windowStart, windowEnd). -1 nếu cửa sổ không hợp lệ.
 */
export function randomNudgeTargetMinute(
  dateStr: string,
  windowStart: string,
  windowEnd: string,
): number {
  const s = hmToMinutes(windowStart);
  let e = hmToMinutes(windowEnd);
  if (s < 0 || e < 0) return -1;
  if (e <= s) e = s + 60; // cửa sổ tối thiểu 1 giờ nếu cấu hình lạ
  let h = 0;
  for (let i = 0; i < dateStr.length; i++) h = (h * 31 + dateStr.charCodeAt(i)) | 0;
  const span = e - s;
  return s + (Math.abs(h) % span);
}
