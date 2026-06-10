"use client";

import { useState, useTransition } from "react";
import {
  Brain,
  Check,
  ChevronsDown,
  ChevronsUp,
  Clock,
  Equal,
  Flag,
  Frown,
  HelpCircle,
  ListChecks,
  Meh,
  Smile,
  Star,
  Target,
  Timer,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  deleteTask,
  setActualBucket,
  setCue,
  setDeepWork,
  setEmotion,
  setEstimate,
  setImpact,
  setSlipReason,
  toggleTask,
  type ActualBucket,
  type SlipReason,
} from "@/app/actions";
import type { Emotion, Priority, TaskDTO } from "@/lib/types";

// lý do trượt 1 chạm (mục 11) — AI học để chia nhỏ / giảm tải
const SLIP_REASONS: { value: SlipReason; label: string }[] = [
  { value: "tired", label: "Mệt" },
  { value: "too_hard", label: "Quá khó" },
  { value: "no_time", label: "Hết giờ" },
  { value: "unclear", label: "Chưa rõ làm gì" },
  { value: "deprioritized", label: "Hết ưu tiên" },
];

/** Nút ghi lý do trượt — chỉ hiện ở việc quá hạn chưa xong (mục 11) */
function SlipButton({
  id,
  slipReason,
}: {
  id: string;
  slipReason: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();
  const current = SLIP_REASONS.find((r) => r.value === slipReason);

  function pick(value: SlipReason) {
    setOpen(false);
    startTransition(() =>
      setSlipReason(id, slipReason === value ? null : value),
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Vì sao việc này bị trượt?"
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-opacity hover:!opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60",
            current
              ? "text-foreground opacity-70"
              : "text-muted-foreground opacity-60",
          )}
        >
          <HelpCircle className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-52 p-1.5">
        <p className="mb-1.5 px-1 text-xs text-muted-foreground">
          Điều gì đã cản trở?
        </p>
        <div className="flex flex-col gap-0.5">
          {SLIP_REASONS.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => pick(r.value)}
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted",
                slipReason === r.value && "bg-muted font-medium",
              )}
            >
              {r.label}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// vòng đặt tác động 80/20: chưa đặt → cao → vừa → thấp → bỏ (mục 11)
const IMPACT_CYCLE: Record<string, Priority | null> = {
  none: "high",
  high: "medium",
  medium: "low",
  low: null,
};
const IMPACT_LABEL: Record<Priority, string> = {
  high: "tác động cao",
  medium: "tác động vừa",
  low: "tác động thấp",
};
const IMPACT_CLASS: Record<Priority, string> = {
  high: "text-rose-600 dark:text-rose-400",
  medium: "text-amber-600 dark:text-amber-400",
  low: "text-muted-foreground",
};

/** Nút đặt mức tác động 80/20 — 1 chạm để xoay vòng (mục 11) */
function ImpactButton({
  id,
  impact,
}: {
  id: string;
  impact: Priority | null | undefined;
}) {
  const [, startTransition] = useTransition();
  const cur = impact ?? null;
  const next = IMPACT_CYCLE[cur ?? "none"];

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Đặt mức tác động (80/20)"
          onClick={() => startTransition(() => setImpact(id, next))}
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-opacity hover:!opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60",
            cur
              ? cn("opacity-70", IMPACT_CLASS[cur])
              : "text-muted-foreground opacity-60",
          )}
        >
          <Flag className={cn("size-3.5", cur === "high" && "fill-current")} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {cur ? IMPACT_LABEL[cur] : "Đặt mức tác động"}
      </TooltipContent>
    </Tooltip>
  );
}

const EMOTIONS: {
  value: Emotion;
  icon: LucideIcon;
  label: string;
  activeClass: string;
}[] = [
  {
    value: "love",
    icon: Smile,
    label: "Dễ",
    activeClass: "text-emerald-600 dark:text-emerald-400",
  },
  {
    value: "meh",
    icon: Meh,
    label: "Bình thường",
    activeClass: "text-amber-600 dark:text-amber-400",
  },
  {
    value: "hard",
    icon: Frown,
    label: "Mệt",
    activeClass: "text-rose-600 dark:text-rose-400",
  },
];

/** Nút đặt/sửa gợi ý "khi nào/ở đâu" (implementation intention, mục 11) */
function CueButton({
  id,
  cue,
}: {
  id: string;
  cue: string | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [val, setVal] = useState(cue ?? "");
  const [, startTransition] = useTransition();

  function save() {
    setOpen(false);
    startTransition(() => setCue(id, val));
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setVal(cue ?? "");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Đặt khi nào/ở đâu sẽ làm"
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-opacity hover:!opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60",
            cue
              ? "text-foreground opacity-70"
              : "text-muted-foreground opacity-60",
          )}
        >
          <Clock className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="mb-1.5 text-xs text-muted-foreground">
          Khi nào / ở đâu bạn sẽ làm việc này?
        </p>
        <Input
          autoFocus
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") setOpen(false);
          }}
          onBlur={save}
          placeholder="vd: sau cà phê, ở bàn làm"
          className="h-8 text-sm"
        />
      </PopoverContent>
    </Popover>
  );
}

/** Nút ước lượng thời lượng 1-chạm (mục 14) — chip "30′" khi đã đặt, ngược lại icon mờ */
const ESTIMATES = [15, 30, 60, 90];
function EstimateButton({
  id,
  minutes,
}: {
  id: string;
  minutes: number | null | undefined;
}) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  function pick(m: number | null) {
    setOpen(false);
    startTransition(() => setEstimate(id, m));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Ước lượng thời lượng"
          className={cn(
            "flex shrink-0 items-center gap-0.5 rounded-md p-1.5 text-[11px] tabular-nums transition-opacity hover:!opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60",
            minutes
              ? "text-foreground opacity-70"
              : "text-muted-foreground opacity-60",
          )}
        >
          <Timer className="size-3.5" />
          {minutes ? `${minutes}′` : ""}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-auto p-1.5">
        <p className="mb-1.5 px-1 text-xs text-muted-foreground">
          Việc này mất bao lâu?
        </p>
        <div className="flex gap-1">
          {ESTIMATES.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => pick(m)}
              className={cn(
                "rounded-md border px-2 py-1 text-xs tabular-nums transition-colors",
                minutes === m
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground",
              )}
            >
              {m}′
            </button>
          ))}
          {minutes && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
            >
              bỏ
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/** Toggle "việc cần tập trung sâu" (mục 14) — AI ưu tiên khe sáng */
function DeepWorkButton({
  id,
  deepWork,
}: {
  id: string;
  deepWork: boolean | undefined;
}) {
  const [, startTransition] = useTransition();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="Việc cần tập trung sâu"
          onClick={() => startTransition(() => setDeepWork(id, !deepWork))}
          className={cn(
            "shrink-0 rounded-md p-1.5 transition-opacity hover:!opacity-100 focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60",
            deepWork
              ? "text-foreground opacity-70"
              : "text-muted-foreground opacity-60",
          )}
        >
          <Brain className={cn("size-3.5", deepWork && "fill-current")} />
        </button>
      </TooltipTrigger>
      <TooltipContent>
        {deepWork
          ? "Việc tập trung sâu (ưu tiên buổi sáng)"
          : "Đánh dấu cần tập trung sâu"}
      </TooltipContent>
    </Tooltip>
  );
}

// phản hồi thời lượng khi xong (mục 14) — chỉ hiện khi đã done & có ước lượng
const BUCKETS: { value: ActualBucket; icon: LucideIcon; label: string }[] = [
  { value: "slower", icon: ChevronsUp, label: "Lâu hơn dự kiến" },
  { value: "asExpected", icon: Equal, label: "Đúng như dự kiến" },
  { value: "faster", icon: ChevronsDown, label: "Nhanh hơn dự kiến" },
];
function DurationLearn({
  id,
  actualBucket,
}: {
  id: string;
  actualBucket: string | null | undefined;
}) {
  const [, startTransition] = useTransition();
  return (
    <div className="flex shrink-0 items-center gap-0.5">
      {BUCKETS.map((b) => (
        <Tooltip key={b.value}>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={b.label}
              onClick={() =>
                startTransition(() =>
                  setActualBucket(
                    id,
                    actualBucket === b.value ? null : b.value,
                  ),
                )
              }
              className={cn(
                "rounded-md p-1.5 leading-none transition-colors hover:bg-muted",
                actualBucket === b.value
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground/50 hover:text-foreground",
              )}
            >
              <b.icon className="size-3.5" />
            </button>
          </TooltipTrigger>
          <TooltipContent>{b.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function PlanChip({ title }: { title: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="flex shrink-0 items-center gap-1 rounded-md border border-border/70 bg-muted/50 px-1.5 py-0.5 text-[11px] text-muted-foreground">
          <Target className="size-3" />
          <span className="hidden max-w-[8rem] truncate sm:inline">
            {title}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent>Thuộc kế hoạch: {title}</TooltipContent>
    </Tooltip>
  );
}

/** Một dòng việc đơn (leaf): checkbox + tiêu đề + badge trì hoãn + cảm xúc + xoá */
function LeafRow({ task, isMit }: { task: TaskDTO; isMit?: boolean }) {
  const [, startTransition] = useTransition();

  return (
    <div className="group flex items-center gap-2.5 border-b border-border/70 py-3 last:border-b-0 sm:gap-3">
      <button
        type="button"
        aria-label={task.done ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
        onClick={() => startTransition(() => toggleTask(task.id, !task.done))}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
          task.done
            ? "border-foreground bg-foreground text-background"
            : "border-muted-foreground/50 hover:border-foreground",
        )}
      >
        {task.done && <Check className="size-3" strokeWidth={3} />}
      </button>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "min-w-0 truncate text-sm",
              task.done && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          {/* việc chính hôm nay (MIT, 80/20) */}
          {isMit && !task.done && (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
            >
              <Star className="size-3 fill-current" />
              việc chính
            </Badge>
          )}
          {task.planTitle && <PlanChip title={task.planTitle} />}
        </span>
        {/* gợi ý khi nào/ở đâu (implementation intention) */}
        {task.cue && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            {task.cue}
          </span>
        )}
      </span>

      {!task.done && task.delay >= 2 && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
        >
          trì hoãn {task.delay}d
        </Badge>
      )}

      {!task.done && task.delay >= 1 && (
        <SlipButton id={task.id} slipReason={task.slipReason} />
      )}
      <EstimateButton id={task.id} minutes={task.estimatedMinutes} />
      <DeepWorkButton id={task.id} deepWork={task.deepWork} />
      <ImpactButton id={task.id} impact={task.impact} />
      <CueButton id={task.id} cue={task.cue} />

      {/* phản hồi thời lượng — chỉ khi đã xong & có ước lượng (hiệu chỉnh, không phán xét) */}
      {task.done && task.estimatedMinutes != null && (
        <DurationLearn id={task.id} actualBucket={task.actualBucket} />
      )}

      <div className="flex shrink-0 items-center gap-0.5">
        {EMOTIONS.map((e) => (
          <Tooltip key={e.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={!task.done}
                aria-label={e.label}
                onClick={() =>
                  startTransition(() => setEmotion(task.id, e.value))
                }
                className={cn(
                  "rounded-md p-1.5 leading-none transition-all",
                  !task.done && "cursor-not-allowed text-muted-foreground/30",
                  task.done && "hover:bg-muted",
                  task.emotion === e.value
                    ? cn("bg-muted", e.activeClass)
                    : task.done &&
                        "text-muted-foreground/50 hover:text-foreground",
                )}
              >
                <e.icon className="size-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {task.done ? e.label : "Hoàn thành task trước đã"}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>

      <button
        type="button"
        aria-label="Xóa task"
        onClick={() => startTransition(() => deleteTask(task.id))}
        className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-60 transition-opacity hover:!opacity-100 hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

/** Task đã chia nhỏ (mục 11): header nhóm + các bước con. Goal-gradient: "còn N bước". */
function ContainerRow({
  task,
  mitId,
}: {
  task: TaskDTO;
  mitId?: string | null;
}) {
  const [, startTransition] = useTransition();
  const steps = task.subtasks ?? [];
  const doneSteps = steps.filter((s) => s.done).length;
  const remaining = steps.length - doneSteps;
  const allDone = remaining === 0;

  return (
    <div className="border-b border-border/70 py-3 last:border-b-0">
      {/* Header nhóm */}
      <div className="group flex items-center gap-2.5 sm:gap-3">
        <ListChecks
          className={cn(
            "size-[18px] shrink-0",
            allDone ? "text-foreground" : "text-muted-foreground",
          )}
        />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={cn(
              "min-w-0 truncate text-sm font-medium",
              allDone && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          {task.planTitle && <PlanChip title={task.planTitle} />}
        </span>

        {/* Goal-gradient: nhấn quãng đường còn lại, framing tích cực */}
        <Badge
          variant="outline"
          className={cn(
            "shrink-0 text-[11px] font-normal",
            allDone
              ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-400"
              : "text-muted-foreground",
          )}
        >
          {allDone ? "Xong cả nhóm" : `còn ${remaining}/${steps.length} bước`}
        </Badge>

        <button
          type="button"
          aria-label="Xóa cả nhóm việc"
          onClick={() => startTransition(() => deleteTask(task.id))}
          className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-60 transition-opacity hover:!opacity-100 hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60"
        >
          <Trash2 className="size-3.5" />
        </button>
      </div>

      {/* Các bước con — thụt vào, có vạch nối */}
      <div className="mt-1 ml-2 border-l border-border/60 pl-3 sm:ml-2.5">
        {steps.map((s) => (
          <LeafRow key={s.id} task={s} isMit={s.id === mitId} />
        ))}
      </div>
    </div>
  );
}

export function TaskItem({
  task,
  mitId,
}: {
  task: TaskDTO;
  mitId?: string | null;
}) {
  if (task.subtasks && task.subtasks.length > 0) {
    return <ContainerRow task={task} mitId={mitId} />;
  }
  return <LeafRow task={task} isMit={task.id === mitId} />;
}
