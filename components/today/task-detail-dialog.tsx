'use client';

import { useState, useTransition, type ReactNode } from 'react';
import { toast } from 'sonner';
import {
  Brain,
  CalendarClock,
  ChevronsDown,
  ChevronsUp,
  Equal,
  Flag,
  Frown,
  Meh,
  Smile,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Truncate } from '@/components/ui/truncate';
import { SlotPicker } from '@/components/today/slot-picker';
import { cn } from '@/lib/utils';
import {
  deleteTask,
  setActualBucket,
  setCue,
  setDeepWork,
  setEmotion,
  setEstimate,
  setImpact,
  setSlipReason,
  type ActualBucket,
  type SlipReason,
} from '@/app/actions';
import type { Emotion, FreeSlot, Priority, TaskDTO } from '@/lib/types';

// ── Shared constants (gathered from the old task-item) ──

export const EMOTIONS: {
  value: Emotion;
  icon: LucideIcon;
  label: string;
  activeClass: string;
}[] = [
  {
    value: 'love',
    icon: Smile,
    label: 'Dễ',
    activeClass: 'text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'meh',
    icon: Meh,
    label: 'Bình thường',
    activeClass: 'text-amber-600 dark:text-amber-400',
  },
  { value: 'hard', icon: Frown, label: 'Mệt', activeClass: 'text-rose-600 dark:text-rose-400' },
];

const ESTIMATES = [15, 30, 60, 90];

const IMPACTS: { value: Priority; label: string; activeClass: string }[] = [
  {
    value: 'high',
    label: 'Cao',
    activeClass:
      'border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-400',
  },
  {
    value: 'medium',
    label: 'Vừa',
    activeClass:
      'border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400',
  },
  { value: 'low', label: 'Thấp', activeClass: 'border-border bg-muted text-foreground' },
];

const SLIP_REASONS: { value: SlipReason; label: string }[] = [
  { value: 'tired', label: 'Mệt' },
  { value: 'too_hard', label: 'Quá khó' },
  { value: 'no_time', label: 'Hết giờ' },
  { value: 'unclear', label: 'Chưa rõ làm gì' },
  { value: 'deprioritized', label: 'Hết ưu tiên' },
];

const BUCKETS: { value: ActualBucket; icon: LucideIcon; label: string }[] = [
  { value: 'slower', icon: ChevronsUp, label: 'Lâu hơn dự kiến' },
  { value: 'asExpected', icon: Equal, label: 'Đúng như dự kiến' },
  { value: 'faster', icon: ChevronsDown, label: 'Nhanh hơn dự kiến' },
];

/** A settings row: label on the left + control on the right, underline rule (standard §12 card set) */
function Row({
  label,
  hint,
  children,
  stacked,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  /** stack the control on the next line (for long inputs) */
  stacked?: boolean;
}) {
  return (
    <div className="border-b border-border/70 py-3 last:border-b-0">
      <div className={cn('flex gap-3', stacked ? 'flex-col' : 'items-center justify-between')}>
        <div className="min-w-0">
          <p className="text-sm font-medium">{label}</p>
          {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
        </div>
        <div className={cn('flex items-center gap-1', stacked && 'flex-wrap')}>{children}</div>
      </div>
    </div>
  );
}

/** chip button for a one-of-many choice (used for estimate / impact / slip) */
function Chip({
  active,
  onClick,
  activeClass,
  children,
}: {
  active: boolean;
  onClick: () => void;
  activeClass?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-xs tabular-nums transition-colors',
        active
          ? (activeClass ?? 'border-foreground bg-foreground text-background')
          : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

/**
 * Task detail modal (UI section §12): gathers ALL buttons (work time, estimate, emotion, impact
 * level, deep focus, when-cue, slip reason, delete) — so the outer card keeps only the name + status.
 * Every change calls a server action + a transparent toast (sonner). Controlled via open/onOpenChange.
 */
export function TaskDetailDialog({
  task,
  freeSlots,
  open,
  onOpenChange,
}: {
  task: TaskDTO;
  /** present → allow scheduling/changing the work time (section 14) */
  freeSlots?: FreeSlot[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [pending, startTransition] = useTransition();
  const [cue, setCueVal] = useState(task.cue ?? '');

  function run(action: () => Promise<void>, message: string) {
    startTransition(async () => {
      await action();
      toast.success(message);
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="pr-6">
            <Truncate>{task.title}</Truncate>
          </DialogTitle>
          <DialogDescription>Tùy chỉnh việc này — mọi thay đổi lưu ngay.</DialogDescription>
        </DialogHeader>

        <div className={cn('-mt-1', pending && 'pointer-events-none opacity-60')}>
          {/* Cảm xúc — chỉ cho việc đã xong (đánh giá việc chưa làm là vô nghĩa) */}
          {task.done && (
            <Row label="Cảm xúc" hint="Việc này làm bạn thấy thế nào?">
              {EMOTIONS.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  aria-label={e.label}
                  onClick={() => run(() => setEmotion(task.id, e.value), `Đã chấm: ${e.label}`)}
                  className={cn(
                    'rounded-md p-1.5 transition-colors hover:bg-muted',
                    task.emotion === e.value
                      ? cn('bg-muted', e.activeClass)
                      : 'text-muted-foreground/50 hover:text-foreground',
                  )}
                >
                  <e.icon className="size-4" />
                </button>
              ))}
            </Row>
          )}

          {/* Thời điểm làm (mục 14) */}
          {freeSlots && (
            <Row label="Thời điểm làm" hint="Xếp vào một khe giờ rảnh">
              <SlotPicker
                taskId={task.id}
                estimatedMinutes={task.estimatedMinutes}
                freeSlots={freeSlots}
                hasSlot={!!task.scheduledFor}
                trigger={
                  <Button variant="outline" size="sm" className="tabular-nums">
                    <CalendarClock className="size-3.5" />
                    {task.scheduledFor ?? 'Chọn giờ'}
                  </Button>
                }
              />
            </Row>
          )}

          {/* Dự kiến xong trong (mục 14) */}
          <Row label="Dự kiến xong trong" hint="Để AI khớp khe giờ & tránh quá tải">
            {ESTIMATES.map((m) => (
              <Chip
                key={m}
                active={task.estimatedMinutes === m}
                onClick={() =>
                  run(
                    () => setEstimate(task.id, task.estimatedMinutes === m ? null : m),
                    task.estimatedMinutes === m ? 'Đã bỏ ước lượng' : `Dự kiến ${m}′`,
                  )
                }
              >
                {m}′
              </Chip>
            ))}
          </Row>

          {/* Mức tác động 80/20 (mục 11) */}
          <Row label="Mức ảnh hưởng" hint="Việc đáng giá nhất (80/20)">
            <Flag className="mr-0.5 size-3.5 text-muted-foreground" />
            {IMPACTS.map((i) => (
              <Chip
                key={i.value}
                active={task.impact === i.value}
                activeClass={i.activeClass}
                onClick={() =>
                  run(
                    () => setImpact(task.id, task.impact === i.value ? null : i.value),
                    task.impact === i.value
                      ? 'Đã bỏ đánh dấu'
                      : `Tác động ${i.label.toLowerCase()}`,
                  )
                }
              >
                {i.label}
              </Chip>
            ))}
          </Row>

          {/* Tập trung sâu (mục 14) */}
          <Row label="Tập trung sâu" hint="AI ưu tiên xếp vào buổi sáng">
            <Brain
              className={cn(
                'size-3.5',
                task.deepWork ? 'text-foreground' : 'text-muted-foreground',
              )}
            />
            <Switch
              checked={!!task.deepWork}
              onCheckedChange={(v) =>
                run(
                  () => setDeepWork(task.id, v),
                  v ? 'Đã đánh dấu tập trung sâu' : 'Đã bỏ đánh dấu',
                )
              }
            />
          </Row>

          {/* Khi nào / ở đâu (implementation intention, mục 11) */}
          <Row label="Khi nào / ở đâu sẽ làm" stacked>
            <Input
              value={cue}
              onChange={(e) => setCueVal(e.target.value)}
              onBlur={() => {
                if ((cue.trim() || null) !== (task.cue ?? null))
                  run(() => setCue(task.id, cue), 'Đã lưu gợi ý');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') e.currentTarget.blur();
              }}
              placeholder="vd: sau cà phê, ở bàn làm"
              className="h-8 w-full text-sm"
            />
          </Row>

          {/* Lý do trượt — chỉ việc quá hạn chưa xong (mục 11) */}
          {!task.done && task.delay >= 1 && (
            <Row label="Điều gì đã cản trở?" hint="AI học để chia nhỏ / giảm tải" stacked>
              {SLIP_REASONS.map((r) => (
                <Chip
                  key={r.value}
                  active={task.slipReason === r.value}
                  onClick={() =>
                    run(
                      () => setSlipReason(task.id, task.slipReason === r.value ? null : r.value),
                      task.slipReason === r.value ? 'Đã bỏ' : `Đã ghi: ${r.label.toLowerCase()}`,
                    )
                  }
                >
                  {r.label}
                </Chip>
              ))}
            </Row>
          )}

          {/* Phản hồi thời lượng — chỉ khi đã xong & có ước lượng (mục 14) */}
          {task.done && task.estimatedMinutes != null && (
            <Row label="So với dự kiến" hint="Giúp AI hiệu chỉnh, không phán xét">
              {BUCKETS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  aria-label={b.label}
                  onClick={() =>
                    run(
                      () =>
                        setActualBucket(task.id, task.actualBucket === b.value ? null : b.value),
                      task.actualBucket === b.value ? 'Đã bỏ' : b.label,
                    )
                  }
                  className={cn(
                    'rounded-md p-1.5 transition-colors hover:bg-muted',
                    task.actualBucket === b.value
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground/50 hover:text-foreground',
                  )}
                >
                  <b.icon className="size-4" />
                </button>
              ))}
            </Row>
          )}
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="destructive"
            size="sm"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                onOpenChange(false);
                await deleteTask(task.id);
                toast.success('Đã xóa việc', { description: task.title });
              })
            }
          >
            <Trash2 className="size-3.5" />
            Xóa việc
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * One-tap emotion prompt that pops up RIGHT when a task is ticked done (UX requirement): 3 buttons + skip.
 * Separate from the detail modal for low friction — auto-closes after a choice.
 */
export function EmotionPrompt({
  taskId,
  title,
  open,
  onOpenChange,
}: {
  taskId: string;
  title: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, startTransition] = useTransition();

  function pick(e: (typeof EMOTIONS)[number]) {
    onOpenChange(false);
    startTransition(async () => {
      await setEmotion(taskId, e.value);
      toast.success(`Đã chấm: ${e.label}`, { description: title });
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xs" showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Việc này thế nào?</DialogTitle>
          <DialogDescription>
            <Truncate>{title}</Truncate>
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-2">
          {EMOTIONS.map((e) => (
            <button
              key={e.value}
              type="button"
              onClick={() => pick(e)}
              className={cn(
                'flex flex-col items-center gap-1.5 rounded-lg border border-border/70 py-3 transition-colors hover:bg-muted',
                e.activeClass,
              )}
            >
              <e.icon className="size-6" />
              <span className="text-xs text-foreground">{e.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          className="text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          Bỏ qua
        </button>
      </DialogContent>
    </Dialog>
  );
}
