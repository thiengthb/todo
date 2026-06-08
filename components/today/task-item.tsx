"use client";

import { useTransition } from "react";
import { Check, Frown, Meh, Smile, Trash2, type LucideIcon } from "lucide-react";
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
  { value: "love", icon: Smile, label: "Dễ", activeClass: "text-emerald-600 dark:text-emerald-400" },
  { value: "meh", icon: Meh, label: "Bình thường", activeClass: "text-amber-600 dark:text-amber-400" },
  { value: "hard", icon: Frown, label: "Mệt", activeClass: "text-rose-600 dark:text-rose-400" },
];

export function TaskItem({ task }: { task: TaskDTO }) {
  const [, startTransition] = useTransition();

  return (
    <div className="group flex items-center gap-2.5 border-b border-border/70 py-3 last:border-b-0 sm:gap-3">
      {/* Checkbox tròn */}
      <button
        type="button"
        aria-label={task.done ? "Đánh dấu chưa xong" : "Đánh dấu đã xong"}
        onClick={() => startTransition(() => toggleTask(task.id, !task.done))}
        className={cn(
          "flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors",
          task.done
            ? "border-foreground bg-foreground text-background"
            : "border-muted-foreground/50 hover:border-foreground"
        )}
      >
        {task.done && <Check className="size-3" strokeWidth={3} />}
      </button>

      {/* Tiêu đề */}
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-sm",
          task.done && "text-muted-foreground line-through"
        )}
      >
        {task.title}
      </span>

      {/* Badge trì hoãn ≥ 2 ngày (chỉ task chưa xong) */}
      {!task.done && task.delay >= 2 && (
        <Badge
          variant="outline"
          className="shrink-0 border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
        >
          trì hoãn {task.delay}d
        </Badge>
      )}

      {/* 3 nút cảm xúc — khoá khi chưa done */}
      <div className="flex shrink-0 items-center gap-0.5">
        {EMOTIONS.map((e) => (
          <Tooltip key={e.value}>
            <TooltipTrigger asChild>
              <button
                type="button"
                disabled={!task.done}
                aria-label={e.label}
                onClick={() => startTransition(() => setEmotion(task.id, e.value))}
                className={cn(
                  "rounded-md p-1.5 leading-none transition-all",
                  !task.done && "cursor-not-allowed text-muted-foreground/30",
                  task.done && "hover:bg-muted",
                  task.emotion === e.value
                    ? cn("bg-muted", e.activeClass)
                    : task.done && "text-muted-foreground/50 hover:text-foreground"
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

      {/* Xóa — luôn hiện trên cảm ứng (không có hover), chỉ ẩn-hiện theo hover ở desktop */}
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
