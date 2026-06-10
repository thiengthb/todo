import { hmToMinutes } from "@/lib/notify/time";
import type {
  CommitmentDTO,
  ScheduleBlock,
  ScheduleEventDTO,
  ScheduleKind,
} from "@/lib/types";

/**
 * Lịch trình (mục 14) — tính ĐỘNG, không lưu cứng (giống delay/streak/progress).
 * Lịch cứng là BỐI CẢNH nuôi đề xuất: cho biết quỹ giờ rảnh thật mỗi ngày.
 */

export const SCHEDULE_KINDS: { value: ScheduleKind; label: string }[] = [
  { value: "hoc", label: "Học" },
  { value: "lam", label: "Làm" },
  { value: "khac", label: "Khác" },
];

/** Giờ thức mặc định 07:00–23:00 = 960 phút (dùng để suy quỹ rảnh) */
export const WAKING_START = "07:00";
export const WAKING_END = "23:00";
const WAKING_MINUTES =
  hmToMinutes(WAKING_END) - hmToMinutes(WAKING_START); // 960

/** 0=CN..6=T7 của một chuỗi ngày "YYYY-MM-DD" (giờ địa phương) */
export function dayOfWeekOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

function toKind(k: string): ScheduleKind {
  return k === "hoc" || k === "lam" ? k : "khac";
}

/** Sắp khối theo giờ bắt đầu; khối cả ngày (null) lên đầu */
function byStart(a: ScheduleBlock, b: ScheduleBlock): number {
  if (a.startTime === b.startTime) return 0;
  if (a.startTime === null) return -1;
  if (b.startTime === null) return 1;
  return hmToMinutes(a.startTime) - hmToMinutes(b.startTime);
}

/**
 * "Phẳng hoá" lịch của một ngày: commitment khớp thứ (active) + event hôm đó.
 * Nếu có event cancels=true (nghỉ cả ngày) → bỏ hết commitment hôm đó.
 */
export function blocksForDate(
  dateStr: string,
  commitments: CommitmentDTO[],
  events: ScheduleEventDTO[],
): ScheduleBlock[] {
  const dow = dayOfWeekOf(dateStr);
  const dayEvents = events.filter((e) => e.date === dateStr);
  const dayOff = dayEvents.some((e) => e.cancels);

  const fromCommitments: ScheduleBlock[] = dayOff
    ? []
    : commitments
        .filter((c) => c.active && c.dayOfWeek === dow)
        .map((c) => ({
          id: c.id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          kind: toKind(c.kind),
          source: "commitment" as const,
        }));

  const fromEvents: ScheduleBlock[] = dayEvents
    .filter((e) => !e.cancels)
    .map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      kind: toKind(e.kind),
      source: "event" as const,
    }));

  return [...fromCommitments, ...fromEvents].sort(byStart);
}

/**
 * Tổng phút BẬN trong giờ thức — gộp các khoảng chồng nhau để không đếm trùng.
 * Chỉ tính khối CÓ giờ (bỏ khối cả ngày khỏi phép tính quỹ rảnh).
 */
export function busyMinutes(blocks: ScheduleBlock[]): number {
  const ws = hmToMinutes(WAKING_START);
  const we = hmToMinutes(WAKING_END);
  const intervals = blocks
    .filter((b) => b.startTime && b.endTime)
    .map((b) => {
      const s = Math.max(ws, hmToMinutes(b.startTime!));
      const e = Math.min(we, hmToMinutes(b.endTime!));
      return [s, e] as const;
    })
    .filter(([s, e]) => e > s)
    .sort((a, b) => a[0] - b[0]);

  let total = 0;
  let curStart = -1;
  let curEnd = -1;
  for (const [s, e] of intervals) {
    if (s > curEnd) {
      if (curEnd > curStart) total += curEnd - curStart;
      curStart = s;
      curEnd = e;
    } else if (e > curEnd) {
      curEnd = e;
    }
  }
  if (curEnd > curStart) total += curEnd - curStart;
  return total;
}

/** Quỹ phút RẢNH của một ngày = giờ thức − phút bận (≥ 0) */
export function freeMinutes(
  dateStr: string,
  commitments: CommitmentDTO[],
  events: ScheduleEventDTO[],
): number {
  const busy = busyMinutes(blocksForDate(dateStr, commitments, events));
  return Math.max(0, WAKING_MINUTES - busy);
}

/** "3h30" / "45 phút" cho hiển thị gọn */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
