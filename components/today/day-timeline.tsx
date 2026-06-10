"use client";

import { useEffect, useState, useTransition } from "react";
import { Brain, Check, Clock, Lock, Move, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { hmToMinutes, minutesToHm } from "@/lib/notify/time";
import { toggleTask } from "@/app/actions";
import { SlotPicker } from "@/components/today/slot-picker";
import { EmptyState } from "@/components/empty-state";
import type {
  FreeSlot,
  ScheduleBlock,
  ScheduleKind,
  TaskDTO,
} from "@/lib/types";

const PX_PER_MIN = 0.75;
const MIN_CARD_MIN = 36; // chiều cao tối thiểu một thẻ (≈ tap target)

const KIND_BORDER: Record<ScheduleKind, string> = {
  hoc: "border-l-sky-400/70",
  lam: "border-l-violet-400/70",
  khac: "border-l-border",
};

/**
 * Dòng thời gian theo giờ (mục 14) — trung tâm trang Hôm nay. Hiển thị lịch cứng (khóa),
 * khung mềm (dời được), khe rảnh, và việc đã xếp giờ. Không drag-drop: đổi giờ qua SlotPicker.
 */
export function DayTimeline({
  isToday,
  wake,
  sleep,
  blocks,
  freeSlots,
  tasks,
  mitId,
}: {
  isToday: boolean;
  wake: string;
  sleep: string;
  blocks: ScheduleBlock[];
  freeSlots: FreeSlot[];
  /** việc lá đã có scheduledFor (HH:MM) */
  tasks: TaskDTO[];
  mitId?: string | null;
}) {
  const wakeMin = hmToMinutes(wake);
  const sleepMin = hmToMinutes(sleep);
  const height = Math.max(0, (sleepMin - wakeMin) * PX_PER_MIN);
  const top = (min: number) => (min - wakeMin) * PX_PER_MIN;

  const [nowMin, setNowMin] = useState<number | null>(null);
  useEffect(() => {
    if (!isToday) return;
    const tick = () => {
      const d = new Date();
      setNowMin(d.getHours() * 60 + d.getMinutes());
    };
    tick();
    const t = setInterval(tick, 60_000);
    return () => clearInterval(t);
  }, [isToday]);

  if (blocks.length === 0 && freeSlots.length === 0 && tasks.length === 0) {
    return (
      <EmptyState
        title="Chưa có gì trên dòng thời gian"
        description="Thêm lịch ở trang Lịch, hoặc xếp việc vào khe giờ — hoặc xem ở chế độ Danh sách."
        className="py-10"
      />
    );
  }

  // nhãn giờ tròn từ wake → sleep
  const hours: number[] = [];
  for (let h = Math.ceil(wakeMin / 60); h * 60 <= sleepMin; h++) hours.push(h);

  return (
    <div className="relative" style={{ height }}>
      {/* vạch giờ + nhãn */}
      {hours.map((h) => (
        <div
          key={h}
          className="pointer-events-none absolute inset-x-0 flex items-start"
          style={{ top: top(h * 60) }}
        >
          <span className="-mt-2 w-9 shrink-0 text-[10px] text-muted-foreground/70 tabular-nums">
            {String(h).padStart(2, "0")}:00
          </span>
          <div className="mt-0 h-px flex-1 bg-border/40" />
        </div>
      ))}

      {/* khe rảnh — dải nền nhạt */}
      {freeSlots.map((s) => {
        const t = top(hmToMinutes(s.start));
        const h = (hmToMinutes(s.end) - hmToMinutes(s.start)) * PX_PER_MIN;
        return (
          <div
            key={`free-${s.start}`}
            className="absolute right-0 left-10 rounded-md bg-muted/20"
            style={{ top: t, height: h }}
          >
            <span className="px-2 py-0.5 text-[10px] text-muted-foreground/50">
              rảnh
            </span>
          </div>
        );
      })}

      {/* khối lịch (cứng + mềm) */}
      {blocks
        .filter((b) => b.startTime && b.endTime)
        .map((b) => {
          const t = top(hmToMinutes(b.startTime!));
          const h = Math.max(
            18,
            (hmToMinutes(b.endTime!) - hmToMinutes(b.startTime!)) * PX_PER_MIN,
          );
          const soft = b.source === "soft";
          return (
            <div
              key={`${b.source}-${b.id}`}
              className={cn(
                "absolute right-0 left-10 overflow-hidden rounded-md border border-l-2 px-2 py-1",
                soft
                  ? "border-dashed border-border/60 bg-transparent"
                  : "border-border/60 bg-muted/50",
                KIND_BORDER[b.kind],
              )}
              style={{ top: t, height: h }}
            >
              <span className="flex items-center gap-1 truncate text-[11px] font-medium">
                {soft ? (
                  <Move className="size-2.5 shrink-0 text-muted-foreground" />
                ) : (
                  <Lock className="size-2.5 shrink-0 text-muted-foreground" />
                )}
                <span className="truncate">{b.title}</span>
                <span className="shrink-0 text-[10px] font-normal text-muted-foreground tabular-nums">
                  {b.startTime}
                </span>
              </span>
            </div>
          );
        })}

      {/* việc đã xếp giờ */}
      {tasks.map((task) => (
        <ScheduledCard
          key={task.id}
          task={task}
          isMit={task.id === mitId}
          top={top(hmToMinutes(task.scheduledFor!))}
          freeSlots={freeSlots}
        />
      ))}

      {/* đường "bây giờ" */}
      {nowMin != null && nowMin >= wakeMin && nowMin <= sleepMin && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ top: top(nowMin) }}
        >
          <span className="w-9 shrink-0 text-[10px] font-medium text-rose-500 tabular-nums">
            {minutesToHm(nowMin)}
          </span>
          <div className="h-px flex-1 bg-rose-500/60" />
        </div>
      )}
    </div>
  );
}

function ScheduledCard({
  task,
  isMit,
  top,
  freeSlots,
}: {
  task: TaskDTO;
  isMit: boolean;
  top: number;
  freeSlots: FreeSlot[];
}) {
  const [, startTransition] = useTransition();
  const h = Math.max(MIN_CARD_MIN, (task.estimatedMinutes ?? 30) * PX_PER_MIN);

  return (
    <div
      className={cn(
        "group absolute right-0 left-10 z-[5] flex items-start gap-1.5 overflow-hidden rounded-md border bg-background px-2 py-1 shadow-sm transition-colors",
        task.done ? "border-border/70" : "border-foreground/30",
      )}
      style={{ top, height: h }}
    >
      <button
        type="button"
        aria-label={task.done ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
        onClick={() => startTransition(() => toggleTask(task.id, !task.done))}
        className={cn(
          "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-colors",
          task.done
            ? "border-foreground bg-foreground text-background"
            : "border-muted-foreground/50 hover:border-foreground",
        )}
      >
        {task.done && <Check className="size-2.5" strokeWidth={3} />}
      </button>
      <SlotPicker
        taskId={task.id}
        estimatedMinutes={task.estimatedMinutes}
        freeSlots={freeSlots}
        hasSlot
        trigger={
          <button
            type="button"
            className="min-w-0 flex-1 text-left"
            aria-label="Đổi giờ"
          >
            <span className="flex items-center gap-1">
              {isMit && !task.done && (
                <Star className="size-3 shrink-0 fill-amber-400 text-amber-500" />
              )}
              {task.deepWork && (
                <Brain className="size-3 shrink-0 text-muted-foreground" />
              )}
              <span
                className={cn(
                  "truncate text-xs font-medium",
                  task.done && "text-muted-foreground line-through",
                )}
              >
                {task.title}
              </span>
            </span>
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground tabular-nums">
              <Clock className="size-2.5" />
              {task.scheduledFor}
              {task.estimatedMinutes ? ` · ${task.estimatedMinutes}′` : ""}
            </span>
          </button>
        }
      />
    </div>
  );
}
