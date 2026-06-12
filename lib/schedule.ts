import { hmToMinutes, minutesToHm } from '@/lib/notify/time';
import { daysBetween, mondayOf } from '@/lib/dates';
import type {
  CapacityResult,
  CommitmentDTO,
  FreeSlot,
  ScheduleBlock,
  ScheduleEventDTO,
  ScheduleKind,
  SoftBlockDTO,
} from '@/lib/types';

/**
 * Schedule (section 14) — computed DYNAMICALLY, not stored (like delay/streak/progress).
 * The hard schedule is CONTEXT feeding the suggestions: it reveals the real free-time budget each day.
 */

export const SCHEDULE_KINDS: { value: ScheduleKind; label: string }[] = [
  { value: 'hoc', label: 'Học' },
  { value: 'lam', label: 'Làm' },
  { value: 'khac', label: 'Khác' },
];

/** Default waking hours 07:00–23:00 (used as a fallback when there is no ScheduleSettings) */
export const WAKING_START = '07:00';
export const WAKING_END = '23:00';

/** 0=Sun..6=Sat of a "YYYY-MM-DD" date string (local time) */
export function dayOfWeekOf(dateStr: string): number {
  return new Date(`${dateStr}T00:00:00`).getDay();
}

function toKind(k: string): ScheduleKind {
  return k === 'hoc' || k === 'lam' ? k : 'khac';
}

/** "odd" | "even" of the week containing dateStr relative to the anchor week (the anchor's week = "odd") */
export function weekParityOf(dateStr: string, anchorMonday: string): 'odd' | 'even' {
  const weeks = Math.floor(daysBetween(mondayOf(anchorMonday), mondayOf(dateStr)) / 7);
  // normalize the modulo into [0,1] even when negative (dates before the anchor)
  return ((weeks % 2) + 2) % 2 === 0 ? 'odd' : 'even';
}

/** Whether a recurring schedule block applies on this day (section 14): term window + odd/even week */
function recurringApplies(
  rule: {
    validFrom?: string | null;
    validUntil?: string | null;
    weekParity?: string | null;
  },
  dateStr: string,
  anchorMonday?: string | null,
): boolean {
  // validity window (ISO string comparison = chronological) — applies even without an anchor
  if (rule.validFrom && dateStr < rule.validFrom) return false;
  if (rule.validUntil && dateStr > rule.validUntil) return false;
  // odd/even week: only filter when both parity and the week anchor are present
  if (rule.weekParity && anchorMonday) {
    if (weekParityOf(dateStr, anchorMonday) !== rule.weekParity) return false;
  }
  return true;
}

/** Sort blocks by start time; all-day blocks (null) come first */
function byStart(a: ScheduleBlock, b: ScheduleBlock): number {
  if (a.startTime === b.startTime) return 0;
  if (a.startTime === null) return -1;
  if (b.startTime === null) return 1;
  return hmToMinutes(a.startTime) - hmToMinutes(b.startTime);
}

/**
 * "Flatten" a day's schedule: commitments matching the weekday (active) + that day's events.
 * If an event has cancels=true (off all day) → drop all commitments that day.
 */
export function blocksForDate(
  dateStr: string,
  commitments: CommitmentDTO[],
  events: ScheduleEventDTO[],
  anchorMonday?: string | null,
): ScheduleBlock[] {
  const dow = dayOfWeekOf(dateStr);
  const dayEvents = events.filter((e) => e.date === dateStr);
  const dayOff = dayEvents.some((e) => e.cancels);

  const fromCommitments: ScheduleBlock[] = dayOff
    ? []
    : commitments
        .filter(
          (c) => c.active && c.dayOfWeek === dow && recurringApplies(c, dateStr, anchorMonday),
        )
        .map((c) => ({
          id: c.id,
          title: c.title,
          startTime: c.startTime,
          endTime: c.endTime,
          kind: toKind(c.kind),
          source: 'commitment' as const,
        }));

  const fromEvents: ScheduleBlock[] = dayEvents
    .filter((e) => !e.cancels)
    .map((e) => ({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      kind: toKind(e.kind),
      source: 'event' as const,
    }));

  return [...fromCommitments, ...fromEvents].sort(byStart);
}

/** Merge overlapping [start,end) intervals → a disjoint, ascending list. Shared helper. */
function mergeIntervals(intervals: readonly (readonly [number, number])[]): [number, number][] {
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
 * Total BUSY minutes during waking hours (07–23h) — merge overlaps to avoid double-counting.
 * Only counts timed blocks. Keeps the old behavior (no buffer) for legacy call sites.
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

/** Soft config for computeFreeSlots — omit = backward-compatible behavior (07–23h, no buffer). */
export interface ScheduleConfig {
  wakeTime?: string;
  sleepTime?: string;
  bufferMin?: number;
  minSlotMin?: number;
  termAnchorMonday?: string | null; // week anchor to filter parity (section 14)
}

function pushSlot(out: FreeSlot[], start: number, end: number, minSlot: number) {
  const dur = end - start;
  if (dur <= 0 || dur < minSlot) return;
  out.push({
    start: minutesToHm(start),
    end: minutesToHm(end),
    durationMin: dur,
  });
}

/**
 * Compute a day's time budget (section 14): list of FREE SLOTS + total free minutes.
 * Pad each hard schedule item by ±bufferMin (travel buffer), clamp to [wake, sleep], merge overlaps,
 * the gaps between = free slots; drop slots shorter than minSlotMin.
 * Omit config → buffer 0 + minSlot 0 + waking hours 07–23h ⇒ capacityMin == the old freeMinutes.
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

  const intervals = blocksForDate(dateStr, commitments, events, config?.termAnchorMonday)
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

/** A day's FREE-minute budget (backward-compatible) = total free slots, waking hours 07–23h, no buffer. */
export function freeMinutes(
  dateStr: string,
  commitments: CommitmentDTO[],
  events: ScheduleEventDTO[],
): number {
  return computeFreeSlots(dateStr, commitments, events).capacityMin;
}

/**
 * "Flatten" a day's SOFT time blocks (section 14): soft blocks matching the weekday (active).
 * Off all day (event cancels) → drop all soft blocks that day, consistent with the hard schedule.
 * NOT subtracted from the hard free budget — only used for display + computing softLoad.
 */
export function softBlocksForDate(
  dateStr: string,
  softBlocks: SoftBlockDTO[],
  events: ScheduleEventDTO[] = [],
  anchorMonday?: string | null,
): ScheduleBlock[] {
  const dow = dayOfWeekOf(dateStr);
  const dayOff = events.some((e) => e.date === dateStr && e.cancels);
  if (dayOff) return [];
  return softBlocks
    .filter((s) => s.active && s.dayOfWeek === dow && recurringApplies(s, dateStr, anchorMonday))
    .map((s) => ({
      id: s.id,
      title: s.title,
      startTime: s.startTime,
      endTime: s.endTime,
      kind: toKind(s.kind),
      source: 'soft' as const,
    }))
    .sort(byStart);
}

/**
 * Total soft-block minutes that INTERSECT free slots (section 14) — "softLoad". Represents time the user
 * has intentionally set aside for focus → reduces the AI's "suggestion budget" (does not touch the hard budget).
 */
export function softLoadMinutes(slots: FreeSlot[], softBlocks: ScheduleBlock[]): number {
  const soft = softBlocks
    .filter((b) => b.startTime && b.endTime)
    .map((b) => [hmToMinutes(b.startTime!), hmToMinutes(b.endTime!)] as const);
  let total = 0;
  for (const s of slots) {
    const ss = hmToMinutes(s.start);
    const se = hmToMinutes(s.end);
    for (const [bs, be] of soft) {
      const lo = Math.max(ss, bs);
      const hi = Math.min(se, be);
      if (hi > lo) total += hi - lo;
    }
  }
  return total;
}

/** "3h30" / "45 phút" for compact display */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m} phút`;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}
