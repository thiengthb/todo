"use client";

import { useTransition } from "react";
import {
  Check,
  Frown,
  ListChecks,
  Meh,
  Smile,
  Target,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { deleteTask, setEmotion, toggleTask } from "@/app/actions";
import type { Emotion, TaskDTO } from "@/lib/types";

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
function LeafRow({ task }: { task: TaskDTO }) {
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

      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            "min-w-0 truncate text-sm",
            task.done && "text-muted-foreground line-through",
          )}
        >
          {task.title}
        </span>
        {task.planTitle && <PlanChip title={task.planTitle} />}
      </span>

      {!task.done && task.delay >= 2 && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
        >
          trì hoãn {task.delay}d
        </Badge>
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
function ContainerRow({ task }: { task: TaskDTO }) {
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
          <LeafRow key={s.id} task={s} />
        ))}
      </div>
    </div>
  );
}

export function TaskItem({ task }: { task: TaskDTO }) {
  if (task.subtasks && task.subtasks.length > 0) {
    return <ContainerRow task={task} />;
  }
  return <LeafRow task={task} />;
}
