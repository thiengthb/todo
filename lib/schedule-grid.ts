import { hmToMinutes } from "@/lib/notify/time";
import type { ScheduleBlock } from "@/lib/types";

/**
 * Helper thuần cho lưới lịch tuần kéo-thả (mục 14, đại tu 2026-06) — không React, dễ test.
 * Pixel-per-minute khớp DayTimeline để hai nơi nhìn nhất quán; snap 15′.
 */
export const PX_PER_MIN = 0.8;
export const SNAP_MIN = 15;

export function snap(min: number, step = SNAP_MIN): number {
  return Math.round(min / step) * step;
}

export function clampToBounds(min: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, min));
}

/** localY (px tính từ đỉnh vùng giờ) → phút trong ngày */
export function yToMinutes(localY: number, wakeMin: number): number {
  return wakeMin + localY / PX_PER_MIN;
}

export function minutesToTopPx(min: number, wakeMin: number): number {
  return (min - wakeMin) * PX_PER_MIN;
}

export function durationToHeightPx(startMin: number, endMin: number): number {
  return Math.max(0, (endMin - startMin) * PX_PER_MIN);
}

/** Cột ngày (0..6) từ toạ độ X, dựa trên rect của vùng 7 cột (không gồm trục giờ) */
export function columnIndexFromX(
  clientX: number,
  lanesLeft: number,
  lanesWidth: number,
): number {
  const colWidth = lanesWidth / 7;
  return Math.max(0, Math.min(6, Math.floor((clientX - lanesLeft) / colWidth)));
}

export interface LaidOut {
  block: ScheduleBlock;
  lane: number;
  lanes: number;
}

/**
 * Xếp các block CHỒNG GIỜ thành lane cạnh nhau (greedy) để không đè lên nhau.
 * Chỉ tính block có giờ; trả lane (cột con) + tổng số lane của cụm chứa nó.
 */
export function layoutOverlaps(blocks: ScheduleBlock[]): LaidOut[] {
  const timed = blocks.filter((b) => b.startTime && b.endTime);
  const sorted = [...timed].sort(
    (a, b) => hmToMinutes(a.startTime!) - hmToMinutes(b.startTime!),
  );

  const result: LaidOut[] = [];
  let cluster: ScheduleBlock[] = [];
  let clusterEnd = -1;

  const flush = () => {
    if (cluster.length === 0) return;
    const laneEnds: number[] = []; // phút kết thúc của block cuối mỗi lane
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
