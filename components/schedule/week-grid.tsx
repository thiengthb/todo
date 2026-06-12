'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarOff, Clock, Lock, Move } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hmToMinutes, minutesToHm } from '@/lib/notify/time';
import {
  PX_PER_MIN,
  SNAP_MIN,
  clampToBounds,
  columnIndexFromX,
  layoutOverlaps,
  minutesToTopPx,
  snap,
  yToMinutes,
} from '@/lib/schedule-grid';
import type { FreeSlot, ScheduleBlock, ScheduleKind } from '@/lib/types';
import type { DayColumn } from '@/components/schedule/week-view';

const KIND_BORDER: Record<ScheduleKind, string> = {
  hoc: 'border-l-sky-400/70',
  lam: 'border-l-violet-400/70',
  khac: 'border-l-border',
};

export interface GridChange {
  dayOfWeek: number;
  date: string;
  start: string;
  end: string;
}

type Gesture =
  | { mode: 'create'; dayIndex: number; anchorMin: number }
  | {
      mode: 'move';
      block: ScheduleBlock;
      grabOffsetMin: number;
      durMin: number;
    }
  | { mode: 'resize'; block: ScheduleBlock; startMin: number };

interface Preview {
  dayIndex: number;
  startMin: number;
  endMin: number;
}

/**
 * Google-Calendar-style week grid (section 14, 2026-06 overhaul) — drag-create + drag-move/resize.
 * Pure Pointer Events (mouse + touch), 15′ snap, NO drag library. Drag logic centralized via
 * event-delegation over the 7-column area. Shows only the schedule (commitment/soft/event) — NO tasks (§14).
 */
export function WeekGrid({
  days,
  wake,
  sleep,
  freeSlotsByDate,
  onCreate,
  onMoveResize,
  onOpen,
}: {
  days: DayColumn[];
  wake: string;
  sleep: string;
  freeSlotsByDate: Record<string, FreeSlot[]>;
  onCreate: (draft: GridChange) => void;
  onMoveResize: (block: ScheduleBlock, change: GridChange) => void;
  onOpen: (block: ScheduleBlock) => void;
}) {
  const wakeMin = hmToMinutes(wake);
  const sleepMin = hmToMinutes(sleep);
  const height = Math.max(0, (sleepMin - wakeMin) * PX_PER_MIN);

  const lanesRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const startPt = useRef<{ x: number; y: number; moved: boolean }>({
    x: 0,
    y: 0,
    moved: false,
  });
  const [preview, setPreview] = useState<Preview | null>(null);

  // map of timed blocks → column, to know which day a block belongs to when dragging
  const blockIndex = useMemo(() => {
    const map = new Map<string, { block: ScheduleBlock; dayIndex: number }>();
    days.forEach((d, ci) => {
      for (const b of d.blocks) {
        if (b.startTime && b.endTime) map.set(`${b.source}-${b.id}`, { block: b, dayIndex: ci });
      }
    });
    return map;
  }, [days]);

  // the "now" line — only in today's column
  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, []);

  function lanesRect() {
    return lanesRef.current!.getBoundingClientRect();
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const rect = lanesRect();
    const target = e.target as HTMLElement;
    const blockEl = target.closest<HTMLElement>('[data-block-id]');
    const isResize = !!target.closest('[data-resize]');

    startPt.current = { x: e.clientX, y: e.clientY, moved: false };
    const localY = e.clientY - rect.top;
    const rawMin = yToMinutes(localY, wakeMin);

    if (blockEl) {
      const key = `${blockEl.dataset.blockSource}-${blockEl.dataset.blockId}`;
      const found = blockIndex.get(key);
      if (!found) return;
      const { block, dayIndex } = found;
      const bs = hmToMinutes(block.startTime!);
      const be = hmToMinutes(block.endTime!);
      if (isResize) {
        gesture.current = { mode: 'resize', block, startMin: bs };
      } else {
        gesture.current = {
          mode: 'move',
          block,
          grabOffsetMin: rawMin - bs,
          durMin: be - bs,
        };
      }
      setPreview({ dayIndex, startMin: bs, endMin: be });
      lanesRef.current?.setPointerCapture(e.pointerId);
    } else {
      const dayIndex = columnIndexFromX(e.clientX, rect.left, rect.width);
      const anchorMin = clampToBounds(snap(rawMin), wakeMin, sleepMin);
      gesture.current = { mode: 'create', dayIndex, anchorMin };
      setPreview({ dayIndex, startMin: anchorMin, endMin: anchorMin });
      // mouse: capture the pointer to drag-select a range; touch: do NOT capture (so swipe-scroll works)
      if (e.pointerType === 'mouse') lanesRef.current?.setPointerCapture(e.pointerId);
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - startPt.current.x;
    const dy = e.clientY - startPt.current.y;
    if (!startPt.current.moved && Math.hypot(dx, dy) > 4) startPt.current.moved = true;

    const rect = lanesRect();
    const rawMin = yToMinutes(e.clientY - rect.top, wakeMin);

    if (g.mode === 'create') {
      // touch: only "drag-select" once moved past the threshold (otherwise allow scrolling)
      if (e.pointerType !== 'mouse' && !startPt.current.moved) return;
      const cur = clampToBounds(snap(rawMin), wakeMin, sleepMin);
      setPreview({
        dayIndex: g.dayIndex,
        startMin: Math.min(g.anchorMin, cur),
        endMin: Math.max(g.anchorMin, cur),
      });
      if (e.pointerType === 'mouse') e.preventDefault();
    } else if (g.mode === 'move') {
      const newStart = clampToBounds(snap(rawMin - g.grabOffsetMin), wakeMin, sleepMin - g.durMin);
      setPreview({
        dayIndex: columnIndexFromX(e.clientX, rect.left, rect.width),
        startMin: newStart,
        endMin: newStart + g.durMin,
      });
      e.preventDefault();
    } else {
      const newEnd = clampToBounds(snap(rawMin), g.startMin + SNAP_MIN, sleepMin);
      setPreview((p) => (p ? { ...p, endMin: newEnd } : p));
      e.preventDefault();
    }
  }

  function finish(e: React.PointerEvent) {
    const g = gesture.current;
    const p = preview;
    gesture.current = null;
    setPreview(null);
    try {
      lanesRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // pointer was not captured (e.g. create on touch) — ignore
    }
    if (!g) return;
    const moved = startPt.current.moved;

    if (g.mode === 'create') {
      // tap/no drag → create a default 60′ block; dragged → use the selected range
      let s: number;
      let en: number;
      if (!moved || !p || p.endMin - p.startMin < SNAP_MIN) {
        s = g.anchorMin;
        en = Math.min(sleepMin, s + 60);
        if (en - s < SNAP_MIN) s = Math.max(wakeMin, en - 60);
      } else {
        s = p.startMin;
        en = p.endMin;
      }
      const tgt = days[g.dayIndex];
      onCreate({
        dayOfWeek: tgt.dow,
        date: tgt.date,
        start: minutesToHm(s),
        end: minutesToHm(en),
      });
      return;
    }

    // move / resize
    if (!moved || !p) {
      onOpen(g.block); // just tap/click (no drag) → open the edit dialog
      return;
    }
    const tgt = days[p.dayIndex] ?? days[0];
    onMoveResize(g.block, {
      dayOfWeek: tgt.dow,
      date: tgt.date,
      start: minutesToHm(p.startMin),
      end: minutesToHm(p.endMin),
    });
  }

  // whole-hour labels
  const hours: number[] = [];
  for (let h = Math.ceil(wakeMin / 60); h * 60 <= sleepMin; h++) hours.push(h);

  return (
    <div className="overflow-x-auto rounded-lg border border-border/70">
      <div className="min-w-[44rem]">
        {/* Header thứ/ngày */}
        <div className="flex border-b border-border/70">
          <div className="w-10 shrink-0" />
          <div className="grid flex-1 grid-cols-7">
            {days.map((d) => (
              <div
                key={d.date}
                className={cn(
                  'border-l border-border/60 px-1 py-1.5 text-center first:border-l-0',
                  d.isToday && 'bg-muted/40',
                )}
              >
                <div
                  className={cn(
                    'text-xs font-medium',
                    d.isToday ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {d.label}
                </div>
                <div className="text-[10px] text-muted-foreground tabular-nums">{d.dateShort}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Thân lưới */}
        <div className="flex" style={{ height }}>
          {/* trục giờ */}
          <div className="relative w-10 shrink-0">
            {hours.map((h) => (
              <div
                key={h}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-muted-foreground/70 tabular-nums"
                style={{ top: minutesToTopPx(h * 60, wakeMin) }}
              >
                {String(h).padStart(2, '0')}
              </div>
            ))}
          </div>

          {/* 7 cột — vùng kéo-thả */}
          <div
            ref={lanesRef}
            className="relative grid flex-1 grid-cols-7"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={finish}
            onPointerCancel={finish}
          >
            {/* vạch giờ ngang trải 7 cột */}
            {hours.map((h) => (
              <div
                key={h}
                className="pointer-events-none absolute inset-x-0 h-px bg-border/40"
                style={{ top: minutesToTopPx(h * 60, wakeMin) }}
              />
            ))}

            {days.map((d, ci) => (
              <DayColumnCell
                key={d.date}
                day={d}
                colIndex={ci}
                wakeMin={wakeMin}
                sleepMin={sleepMin}
                freeSlots={freeSlotsByDate[d.date] ?? []}
                nowMin={d.isToday ? nowMin : null}
              />
            ))}

            {/* ghost preview khi đang kéo */}
            {preview && (
              <div
                className="pointer-events-none absolute z-20 overflow-hidden rounded-md border border-dashed border-foreground/40 bg-muted/70 px-1.5 py-0.5 text-[10px] font-medium tabular-nums shadow-sm"
                style={{
                  left: `${(preview.dayIndex / 7) * 100}%`,
                  width: `${100 / 7}%`,
                  top: minutesToTopPx(preview.startMin, wakeMin),
                  height: Math.max(14, (preview.endMin - preview.startMin) * PX_PER_MIN),
                }}
              >
                {minutesToHm(preview.startMin)}–{minutesToHm(preview.endMin)}
              </div>
            )}
          </div>
        </div>
      </div>
      <p className="border-t border-border/70 px-3 py-1.5 text-[11px] text-muted-foreground">
        Kéo trên lưới để tạo · kéo block để dời · kéo mép dưới để đổi giờ kết thúc · chạm để sửa.
      </p>
    </div>
  );
}

/** A single day column: free-slot + timed block + all-day chip + now-line. */
function DayColumnCell({
  day,
  colIndex,
  wakeMin,
  sleepMin,
  freeSlots,
  nowMin,
}: {
  day: DayColumn;
  colIndex: number;
  wakeMin: number;
  sleepMin: number;
  freeSlots: FreeSlot[];
  nowMin: number | null;
}) {
  const timed = layoutOverlaps(day.blocks);
  const allDay = day.blocks.filter((b) => !b.startTime || !b.endTime);

  return (
    <div
      className={cn(
        'relative border-l border-border/60 first:border-l-0',
        day.isToday && 'bg-muted/20',
      )}
    >
      {/* khe rảnh */}
      {freeSlots.map((s) => {
        const top = minutesToTopPx(hmToMinutes(s.start), wakeMin);
        const h = (hmToMinutes(s.end) - hmToMinutes(s.start)) * PX_PER_MIN;
        return (
          <div
            key={`free-${s.start}`}
            className="pointer-events-none absolute inset-x-0.5 rounded bg-muted/25"
            style={{ top, height: h }}
          />
        );
      })}

      {/* chip cả-ngày / nghỉ */}
      {allDay.length > 0 && (
        <div className="absolute inset-x-0.5 top-0 z-[2] flex flex-col gap-0.5">
          {allDay.map((b) => (
            <button
              key={`${b.source}-${b.id}`}
              type="button"
              data-block-id={b.id}
              data-block-source={b.source}
              className="flex items-center gap-1 truncate rounded border border-border/60 bg-background px-1 py-0.5 text-left text-[10px]"
            >
              <CalendarOff className="size-2.5 shrink-0 text-muted-foreground" />
              <span className="truncate">{b.title}</span>
            </button>
          ))}
        </div>
      )}

      {/* block định giờ */}
      {timed.map(({ block: b, lane, lanes }) => {
        const s = hmToMinutes(b.startTime!);
        const e = hmToMinutes(b.endTime!);
        const top = Math.max(0, minutesToTopPx(Math.max(s, wakeMin), wakeMin));
        const bottom = minutesToTopPx(Math.min(e, sleepMin), wakeMin);
        const soft = b.source === 'soft';
        return (
          <div
            key={`${b.source}-${b.id}`}
            data-block-id={b.id}
            data-block-source={b.source}
            data-col={colIndex}
            style={{
              top,
              height: Math.max(16, bottom - top),
              left: `calc(${(lane / lanes) * 100}% + 2px)`,
              width: `calc(${100 / lanes}% - 4px)`,
              touchAction: 'none',
            }}
            className={cn(
              'absolute z-[5] cursor-grab touch-none overflow-hidden rounded-md border border-l-2 px-1.5 py-0.5 active:cursor-grabbing',
              soft
                ? 'border-dashed border-border/60 bg-background'
                : 'border-border/60 bg-muted/60',
              KIND_BORDER[b.kind],
            )}
          >
            <span className="flex items-center gap-0.5 truncate text-[10px] font-medium">
              {soft ? (
                <Move className="size-2.5 shrink-0 text-muted-foreground" />
              ) : (
                <Lock className="size-2.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate">{b.title}</span>
            </span>
            <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground tabular-nums">
              <Clock className="size-2 shrink-0" />
              {b.startTime}
            </span>
            {/* mép kéo resize */}
            <div
              data-resize
              className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize touch-none"
            />
          </div>
        );
      })}

      {/* đường bây giờ */}
      {nowMin != null && nowMin >= wakeMin && nowMin <= sleepMin && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 h-px bg-rose-500/70"
          style={{ top: minutesToTopPx(nowMin, wakeMin) }}
        />
      )}
    </div>
  );
}
