import { hmToMinutes } from '@/lib/notify/time';
import type { ScheduleBlock } from '@/lib/types';

/**
 * Pure helpers for the drag-and-drop weekly schedule grid (section 14, 2026-06 overhaul) — no React, easy to test.
 * Pixel-per-minute matches DayTimeline so the two places look consistent; snap 15′.
 * 1.0 px/min (raised from 0.8, 2026-06-14) → a 30′ block is 30px, legible with title + time.
 */
export const PX_PER_MIN = 1.0;
export const SNAP_MIN = 15;

export function snap(min: number, step = SNAP_MIN): number {
  return Math.round(min / step) * step;
}

export function clampToBounds(min: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, min));
}

/** localY (px from the top of the hour area) → minute of the day */
export function yToMinutes(localY: number, wakeMin: number): number {
  return wakeMin + localY / PX_PER_MIN;
}

export function minutesToTopPx(min: number, wakeMin: number): number {
  return (min - wakeMin) * PX_PER_MIN;
}

export function durationToHeightPx(startMin: number, endMin: number): number {
  return Math.max(0, (endMin - startMin) * PX_PER_MIN);
}

/** Day column (0..6) from the X coordinate, based on the rect of the 7-column area (excluding the hour axis) */
export function columnIndexFromX(clientX: number, lanesLeft: number, lanesWidth: number): number {
  const colWidth = lanesWidth / 7;
  return Math.max(0, Math.min(6, Math.floor((clientX - lanesLeft) / colWidth)));
}

export interface LaidOut {
  block: ScheduleBlock;
  lane: number;
  lanes: number;
}

/**
 * Lay out OVERLAPPING blocks into side-by-side lanes (greedy) so they don't cover each other.
 * Only counts timed blocks; returns the lane (sub-column) + total lanes of the cluster containing it.
 */
export function layoutOverlaps(blocks: ScheduleBlock[]): LaidOut[] {
  const timed = blocks.filter((b) => b.startTime && b.endTime);
  const sorted = [...timed].sort((a, b) => hmToMinutes(a.startTime!) - hmToMinutes(b.startTime!));

  const result: LaidOut[] = [];
  let cluster: ScheduleBlock[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = []; // end minute of the last block in each lane
    const laneOf = new Map<string, number>();
    for (const b of cluster) {
      const s = hmToMinutes(b.startTime!);
      const e = hmToMinutes(b.endTime!);
      let lane = laneEnds.findIndex((end) => end <= s);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(e);
      } else {
        laneEnds[lane] = e;
      }
      laneOf.set(`${b.source}-${b.id}`, lane);
    }
    const lanes = laneEnds.length;
    for (const b of cluster)
      result.push({
        block: b,
        lane: laneOf.get(`${b.source}-${b.id}`)!,
        lanes,
      });
    cluster = [];
    clusterEnd = -1;
  };

  for (const b of sorted) {
    const s = hmToMinutes(b.startTime!);
    const e = hmToMinutes(b.endTime!);
    if (cluster.length > 0 && s >= clusterEnd) flush();
    cluster.push(b);
    clusterEnd = Math.max(clusterEnd, e);
  }
  flush();
  return result;
}
