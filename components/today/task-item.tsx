'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  AlertTriangle,
  Brain,
  Check,
  Clock,
  Flag,
  ListChecks,
  Star,
  Target,
  Timer,
  Trash2,
} from 'lucide-react';
import { Truncate } from '@/components/ui/truncate';
import { IconTooltip } from '@/components/icon-tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { deleteTask, toggleTask } from '@/app/actions';
import { EMOTIONS, EmotionPrompt, TaskDetailDialog } from '@/components/today/task-detail-dialog';
import type { FreeSlot, Priority, TaskDTO } from '@/lib/types';

const IMPACT_LABEL: Record<Priority, string> = {
  high: 'Tác động cao (80/20)',
  medium: 'Tác động vừa',
  low: 'Tác động thấp',
};
const IMPACT_CLASS: Record<Priority, string> = {
  high: 'text-rose-600 dark:text-rose-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-muted-foreground',
};

/** Compact read-only indicator (icon + number) — saves card space; details live in the modal */
function Meta({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <IconTooltip label={label}>
      <span
        className={cn(
          'flex shrink-0 items-center gap-0.5 text-[11px] tabular-nums text-muted-foreground',
          className,
        )}
      >
        {children}
      </span>
    </IconTooltip>
  );
}

/** Indicator cluster on the right of the card — all compact, hover for a tooltip; click opens the detail modal */
function MetaCluster({ task, isMit }: { task: TaskDTO; isMit?: boolean }) {
  const emotion = EMOTIONS.find((e) => e.value === task.emotion);
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {isMit && !task.done && (
        <Meta label="Việc chính hôm nay (80/20)" className="text-amber-500">
          <Star className="size-3.5 fill-current" />
        </Meta>
      )}
      {task.planTitle && (
        <Meta label={`Thuộc kế hoạch: ${task.planTitle}`}>
          <Target className="size-3.5" />
        </Meta>
      )}
      {!task.done && task.delay >= 2 && (
        <Meta
          label={`Trì hoãn ${task.delay} ngày`}
          className="rounded border border-amber-300 bg-amber-50 px-1 py-0.5 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
        >
          <AlertTriangle className="size-3" />
          {task.delay}d
        </Meta>
      )}
      {task.scheduledFor && (
        <Meta label={`Xếp lúc ${task.scheduledFor}`}>
          <Clock className="size-3.5" />
          {task.scheduledFor}
        </Meta>
      )}
      {task.estimatedMinutes != null && (
        <Meta label={`Dự kiến ${task.estimatedMinutes} phút`}>
          <Timer className="size-3.5" />
          {task.estimatedMinutes}′
        </Meta>
      )}
      {task.deepWork && (
        <Meta label="Việc cần tập trung sâu" className="text-foreground">
          <Brain className="size-3.5" />
        </Meta>
      )}
      {task.impact && (
        <Meta label={IMPACT_LABEL[task.impact]} className={IMPACT_CLASS[task.impact]}>
          <Flag className={cn('size-3.5', task.impact === 'high' && 'fill-current')} />
        </Meta>
      )}
      {/* trạng thái sau khi xong: cảm xúc đã chấm */}
      {task.done && emotion && (
        <Meta label={`Cảm xúc: ${emotion.label}`} className={emotion.activeClass}>
          <emotion.icon className="size-4" />
        </Meta>
      )}
    </span>
  );
}

/** A single leaf task row: tick + name + compact indicators. Clicking (except the tick) → detail modal. */
function LeafRow({
  task,
  isMit,
  freeSlots,
}: {
  task: TaskDTO;
  isMit?: boolean;
  freeSlots?: FreeSlot[];
}) {
  const [pending, startTransition] = useTransition();
  const [detailOpen, setDetailOpen] = useState(false);
  const [emotionOpen, setEmotionOpen] = useState(false);

  function tick(e: React.MouseEvent) {
    e.stopPropagation();
    const next = !task.done;
    startTransition(async () => {
      await toggleTask(task.id, next);
      if (next) {
        toast.success('Hoàn thành!', { description: task.title });
        // open the one-tap emotion prompt after the task has switched to "done"
        setEmotionOpen(true);
      }
    });
  }

  return (
    <div
      className={cn(
        'group flex items-center gap-2.5 border-b border-border/70 py-3 transition-colors last:border-b-0 hover:bg-muted/40 sm:gap-3',
        pending && 'opacity-60',
      )}
      aria-busy={pending}
    >
      <button
        type="button"
        aria-label={task.done ? 'Đánh dấu chưa xong' : 'Đánh dấu đã xong'}
        onClick={tick}
        className={cn(
          'flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
          task.done
            ? 'border-foreground bg-foreground text-background'
            : 'border-muted-foreground/50 hover:border-foreground',
        )}
      >
        {task.done && <Check className="size-3" strokeWidth={3} />}
      </button>

      {/* vùng bấm mở modal — chiếm toàn bộ chiều ngang còn lại */}
      <button
        type="button"
        onClick={() => setDetailOpen(true)}
        aria-label={`Tùy chỉnh: ${task.title}`}
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
      >
        <Truncate
          className={cn('flex-1 text-sm', task.done && 'text-muted-foreground line-through')}
        >
          {task.title}
        </Truncate>
        <MetaCluster task={task} isMit={isMit} />
      </button>

      <TaskDetailDialog
        task={task}
        freeSlots={freeSlots}
        open={detailOpen}
        onOpenChange={setDetailOpen}
      />
      <EmotionPrompt
        taskId={task.id}
        title={task.title}
        open={emotionOpen}
        onOpenChange={setEmotionOpen}
      />
    </div>
  );
}

/** A broken-down task (section 11): group header + child steps. Goal-gradient: "N steps left". */
function ContainerRow({ task, mitId }: { task: TaskDTO; mitId?: string | null }) {
  const [pending, startTransition] = useTransition();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const steps = task.subtasks ?? [];
  const doneSteps = steps.filter((s) => s.done).length;
  const remaining = steps.length - doneSteps;
  const allDone = remaining === 0;

  return (
    <div className="border-b border-border/70 py-3 last:border-b-0">
      {/* Header nhóm — bấm để xoá cả nhóm (qua modal xác nhận) */}
      <button
        type="button"
        onClick={() => setConfirmOpen(true)}
        className={cn(
          'group flex w-full items-center gap-2.5 text-left transition-colors sm:gap-3',
          pending && 'opacity-60',
        )}
        aria-busy={pending}
      >
        <ListChecks
          className={cn(
            'size-[18px] shrink-0',
            allDone ? 'text-foreground' : 'text-muted-foreground',
          )}
        />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Truncate
            className={cn(
              'flex-1 text-sm font-medium',
              allDone && 'text-muted-foreground line-through',
            )}
          >
            {task.title}
          </Truncate>
          {task.planTitle && (
            <Meta label={`Thuộc kế hoạch: ${task.planTitle}`}>
              <Target className="size-3.5" />
            </Meta>
          )}
        </span>
        <Meta
          label={allDone ? 'Đã xong cả nhóm' : `Còn ${remaining}/${steps.length} bước`}
          className={cn(allDone && 'text-emerald-600 dark:text-emerald-400')}
        >
          {allDone ? 'xong' : `${remaining}/${steps.length}`}
        </Meta>
      </button>

      {/* Các bước con — thụt vào, có vạch nối */}
      <div className="mt-1 ml-2 border-l border-border/60 pl-3 sm:ml-2.5">
        {steps.map((s) => (
          <LeafRow key={s.id} task={s} isMit={s.id === mitId} />
        ))}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-xs">
          <DialogHeader>
            <DialogTitle className="pr-6">
              <Truncate>{task.title}</Truncate>
            </DialogTitle>
            <DialogDescription>
              Nhóm việc — {allDone ? 'đã xong cả nhóm' : `còn ${remaining}/${steps.length} bước`}
            </DialogDescription>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Xóa nhóm sẽ xóa toàn bộ {steps.length} bước con. Không thể hoàn tác.
          </p>
          <DialogFooter className="sm:justify-between">
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(false)}>
              Đóng
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setConfirmOpen(false);
                  await deleteTask(task.id);
                  toast.success('Đã xóa nhóm việc', { description: task.title });
                })
              }
            >
              <Trash2 className="size-3.5" />
              Xóa nhóm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function TaskItem({
  task,
  mitId,
  freeSlots,
}: {
  task: TaskDTO;
  mitId?: string | null;
  /** passed down to show the schedule button (the "unscheduled" list in timeline mode) */
  freeSlots?: FreeSlot[];
}) {
  if (task.subtasks && task.subtasks.length > 0) {
    return <ContainerRow task={task} mitId={mitId} />;
  }
  return <LeafRow task={task} isMit={task.id === mitId} freeSlots={freeSlots} />;
}
