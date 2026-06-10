import { hmToMinutes, minutesToHm } from "@/lib/notify/time";
import type {
  CapacityResult,
  CommitmentDTO,
  FreeSlot,
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

/** Giờ thức mặc định 07:00–23:00 (dùng làm fallback khi chưa có ScheduleSettings) */
export const WAKING_START = "07:00";
export const WAKING_END = "23:00";

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

/** Gộp các khoảng [start,end) chồng nhau → danh sách rời nhau, tăng dần. Dùng chung. */
function mergeIntervals(
  intervals: readonly (readonly [number, number])[],
): [number, number][] {
  const sorted = intervals
    .filter(([s, e]) => e > s)
    .slice()
    .sort((a, b) => a[0] - b[0]);
  const merged: [number, number][] = [];
  for (const [s, e] of sorted) {
    const last = merged[merged.length - 1];
    if (!last || s > last[1]) merged.push([s, e]);
    else if (e > last[1]) last[1] = e;
  }
  return merged;
}

/**
 * Tổng phút BẬN trong giờ thức (07–23h) — gộp khoảng chồng để không đếm trùng.
 * Chỉ tính khối CÓ giờ. Giữ nguyên hành vi cũ (không buffer) cho các nơi gọi cũ.
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
    });
  return mergeIntervals(intervals).reduce((t, [s, e]) => t + (e - s), 0);
}

/** Cấu hình mềm cho computeFreeSlots — bỏ trống = hành vi tương thích ngược (07–23h, không buffer). */
export interface ScheduleConfig {
  wakeTime?: string;
  sleepTime?: string;
  bufferMin?: number;
  minSlotMin?: number;
}

function pushSlot(
  out: FreeSlot[],
  start: number,
  end: number,
  minSlot: number,
) {
  const dur = end - start;
  if (dur <= 0 || dur < minSlot) return;
  out.push({
    start: minutesToHm(start),
    end: minutesToHm(end),
    durationMin: dur,
  });
}

/**
 * Tính quỹ thời gian một ngày (mục 14): danh sách KHE TRỐNG + tổng phút rảnh.
 * Nới mỗi lịch cứng ±bufferMin (đệm di chuyển), kẹp trong [wake, sleep], gộp chồng,
 * khoảng trống giữa = khe rảnh; bỏ khe ngắn hơn minSlotMin.
 * Bỏ trống config → buffer 0 + minSlot 0 + giờ thức 07–23h ⇒ capacityMin == freeMinutes cũ.
 */
export function computeFreeSlots(
  dateStr: string,
  commitments: CommitmentDTO[],
  events: ScheduleEventDTO[],
  config?: ScheduleConfig,
): CapacityResult {
  const wake = hmToMinutes(config?.wakeTime ?? WAKING_START);
  const sleep = hmToMinutes(config?.sleepTime ?? WAKING_END);
  const buffer = Math.max(0, config?.bufferMin ?? 0);
  const minSlot = Math.max(0, config?.minSlotMin ?? 0);
  const wakingMin = Math.max(0, sleep - wake);

  const intervals = blocksForDate(dateStr, commitments, events)
    .filter((b) => b.startTime && b.endTime)
    .map((b) => {
      const s = Math.max(wake, hmToMinutes(b.startTime!) - buffer);
      const e = Math.min(sleep, hmToMinutes(b.endTime!) + buffer);
      return [s, e] as const;
    });
  const busy = mergeIntervals(intervals);
  const busyMin = busy.reduce((t, [s, e]) => t + (e - s), 0);

  const slots: FreeSlot[] = [];
  let cursor = wake;
  for (const [s, e] of busy) {
    if (s > cursor) pushSlot(slots, cursor, s, minSlot);
    cursor = Math.max(cursor, e);
  }
  if (cursor < sleep) pushSlot(slots, cursor, sleep, minSlot);

  const capacityMin = slots.reduce((t, s) => t + s.durationMin, 0);
  return { slots, capacityMin, wakingMin, busyMin };
}

/** Quỹ phút RẢNH của một ngày (tương thích ngược) = tổng khe rảnh, giờ thức 07–23h, không buffer. */
export function freeMinutes(
  dateStr: string,
  commitments: CommitmentDTO[],
  events: ScheduleEventDTO[],
): number {
  return computeFreeSlots(dateStr, commitments, events).capacityMin;
}

/** "3h30" / "45 phút" cho hiển thị gọn */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, "0")}`;
}
