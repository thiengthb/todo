'use client';

import { useState, useTransition } from 'react';
import {
  AlertTriangle,
  Check,
  Clock,
  HeartPulse,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Sparkles,
  Sprout,
  Target,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { tomorrowStr } from '@/lib/dates';
import { addTomorrowTask } from '@/app/actions';
import { promoteGoalToTask } from '@/app/incubating/actions';
import { CreatePlanDialog } from '@/components/plans/create-plan-dialog';
import type { Priority, QueuePullItem, SuggestionItem, SuggestionResult } from '@/lib/types';

const PRIORITY_LABEL: Record<Priority, string> = {
  high: 'cao',
  medium: 'vừa',
  low: 'nhẹ',
};

const PRIORITY_CLASS: Record<Priority, string> = {
  high: 'border-alert/30 bg-alert/10 text-alert',
  medium: 'border-warn/30 bg-warn/10 text-warn',
  low: 'border-border bg-muted text-muted-foreground',
};

/**
 * Validate the /api/suggest payload at the boundary instead of a blind `as` cast (react-ui-craft).
 * A lightweight first-party guard — not Zod — to avoid pulling Zod into the client bundle just to
 * re-check our own server's response; it ensures every array the UI maps over actually exists.
 */
function parseSuggestionResult(data: unknown): SuggestionResult {
  const d = data as Record<string, unknown> | null;
  const arrays = ['carry_over', 'suggested_tasks', 'plan_tasks', 'queue_pulls', 'plan_alerts'];
  if (!d || typeof d.capacity_note !== 'string' || arrays.some((k) => !Array.isArray(d[k]))) {
    throw new Error('Phản hồi đề xuất không hợp lệ');
  }
  return data as SuggestionResult;
}

function SuggestionRow({
  item,
  isCarryOver,
  planLink,
  added,
  onAdded,
}: {
  item: SuggestionItem;
  isCarryOver: boolean;
  planLink?: { planId: string; milestoneId: string | null };
  /** lifted to the sheet so a regenerate keeps the "đã thêm" state */
  added: boolean;
  onAdded: () => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-3 last:border-b-0">
      <Badge
        variant="outline"
        className={cn('mt-0.5 shrink-0 text-[11px] font-normal', PRIORITY_CLASS[item.priority])}
      >
        {PRIORITY_LABEL[item.priority]}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
        {item.cue && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <MapPin className="size-3 shrink-0" />
            {item.cue}
          </p>
        )}
        {(item.slotStart || item.estimatedMinutes) && (
          <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="size-3 shrink-0" />
            {item.slotStart && `gợi ý lúc ${item.slotStart}`}
            {item.slotStart && item.estimatedMinutes && ' · '}
            {item.estimatedMinutes && `~${item.estimatedMinutes}′`}
            {item.deepWork && ' · tập trung sâu'}
          </p>
        )}
        {item.subtasks && item.subtasks.length > 0 && (
          <ul className="mt-1.5 space-y-1 border-l border-border/60 pl-3">
            {item.subtasks.map((s, i) => (
              <li key={i} className="text-xs text-muted-foreground">
                · {s}
              </li>
            ))}
          </ul>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        disabled={added || pending}
        onClick={() =>
          startTransition(async () => {
            await addTomorrowTask(
              item.title,
              isCarryOver,
              planLink,
              item.subtasks,
              item.cue,
              item.priority, // suggestion priority = an 80/20 signal (section 11)
              {
                slotStart: item.slotStart ?? null,
                estimatedMinutes: item.estimatedMinutes ?? null,
                deepWork: item.deepWork,
              },
            );
            onAdded();
          })
        }
        className="shrink-0 active:scale-[0.97]"
      >
        {added ? (
          <>
            <Check className="size-3.5" /> Đã thêm
          </>
        ) : pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : item.slotStart ? (
          <>
            <Clock className="size-3.5" /> Xếp {item.slotStart}
          </>
        ) : (
          <>
            <Plus className="size-3.5" /> Ngày mai
          </>
        )}
      </Button>
    </div>
  );
}

/** A suggestion to pull an "Incubating" goal out to work on (section 17) — drag into a task or promote to a plan */
function QueuePullRow({
  item,
  added,
  onAdded,
}: {
  item: QueuePullItem;
  added: boolean;
  onAdded: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const isPlan = item.suggestApproach === 'plan';

  function pullToTomorrow() {
    startTransition(async () => {
      await promoteGoalToTask(item.goalId, { date: tomorrowStr() });
      onAdded();
    });
  }

  const planTrigger = (variant: 'default' | 'ghost') => (
    <CreatePlanDialog
      goalId={item.goalId}
      defaultTitle={item.title}
      defaultGoal={item.title}
      trigger={
        <Button
          variant={variant}
          size="sm"
          className={cn('gap-1', variant === 'ghost' && 'text-muted-foreground')}
        >
          <Target className="size-3.5" /> Kế hoạch
        </Button>
      }
    />
  );

  const tomorrowBtn = (variant: 'default' | 'ghost') => (
    <Button
      variant={variant}
      size="sm"
      onClick={pullToTomorrow}
      disabled={pending}
      className={cn('gap-1', variant === 'ghost' && 'text-muted-foreground')}
    >
      {pending ? (
        <Loader2 className="size-3.5 animate-spin" />
      ) : (
        <>
          <Plus className="size-3.5" /> Ngày mai
        </>
      )}
    </Button>
  );

  return (
    <div className="flex items-start gap-3 border-b border-border/70 py-3 last:border-b-0">
      <Badge variant="outline" className="mt-0.5 shrink-0 text-[11px] font-normal">
        {isPlan ? 'kế hoạch' : 'việc'}
      </Badge>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{item.title}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{item.reason}</p>
      </div>
      {added ? (
        <Button variant="outline" size="sm" disabled className="shrink-0">
          <Check className="size-3.5" /> Đã thêm
        </Button>
      ) : (
        // the primary button follows the suggested size; the secondary button is the other exit
        <div className="flex shrink-0 flex-col gap-1">
          {isPlan ? (
            <>
              {planTrigger('default')}
              {tomorrowBtn('ghost')}
            </>
          ) : (
            <>
              {tomorrowBtn('default')}
              {planTrigger('ghost')}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
      {children}
    </h3>
  );
}

/**
 * "Tomorrow suggestion" — wide right-side Sheet (UI section): can reference today's list,
 * fixed header/footer, the list scrolls inside a ScrollArea (nice scrollbar), not the whole modal.
 */
export function SuggestSheet() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SuggestionResult | null>(null);
  // "đã thêm" lives here (keyed by item) so re-generating the list does NOT lose what you already added
  const [addedKeys, setAddedKeys] = useState<Set<string>>(() => new Set());
  const markAdded = (key: string) => setAddedKeys((prev) => new Set(prev).add(key));

  async function generate() {
    setLoading(true);
    setError(null);
    setResult(null); // addedKeys intentionally kept across regenerate
    try {
      const res = await fetch('/api/suggest', { method: 'POST' });
      const data: unknown = await res.json();
      if (!res.ok) {
        throw new Error((data as { error?: string } | null)?.error ?? `Lỗi ${res.status}`);
      }
      setResult(parseSuggestionResult(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lỗi không xác định');
    } finally {
      setLoading(false);
    }
  }

  const totalItems = result
    ? result.carry_over.length +
      result.suggested_tasks.length +
      result.plan_tasks.length +
      result.queue_pulls.length
    : 0;
  const empty = result && totalItems === 0;

  return (
    <Sheet
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o && !result && !loading) void generate();
      }}
    >
      <SheetTrigger asChild>
        <Button className="w-full gap-2 active:scale-[0.99]">
          <Sparkles className="size-4" />
          Đề xuất todo cho ngày mai
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="flex flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="border-b border-border/70 px-5 py-4">
          <SheetTitle className="flex items-center gap-2">
            <Sparkles className="size-4" /> Đề xuất cho ngày mai
          </SheetTitle>
          <SheetDescription>
            Dựa trên việc đã xong, việc còn dở, cảm xúc và tốc độ thực tế của bạn.
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="min-h-0 flex-1">
          <div className="space-y-5 px-5 py-4">
            {loading && (
              <div className="space-y-3">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-5/6" />
                <Skeleton className="h-9 w-full" />
              </div>
            )}

            {error && (
              <div className="space-y-3">
                <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  {error}
                </p>
                <Button variant="outline" size="sm" onClick={generate}>
                  <RefreshCw className="size-3.5" /> Thử lại
                </Button>
              </div>
            )}

            {result && (
              <>
                {result.recovery_day && (
                  <div className="flex items-start gap-2 rounded-md border border-ok/30 bg-ok/10 p-3">
                    <HeartPulse className="mt-0.5 size-4 shrink-0 text-ok" />
                    <p className="text-xs leading-relaxed text-ok">
                      Hôm nay nên là <strong>ngày phục hồi</strong> — sức đang thấp, chỉ làm vài
                      việc thật nhẹ để giữ nhịp. Nghỉ ngơi cũng là một phần của kỷ luật.
                    </p>
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="rounded-md border border-border/70 bg-muted/40 p-3 text-xs leading-relaxed text-muted-foreground">
                    {result.capacity_note}
                  </p>
                  {!empty && (
                    <p className="text-[11px] text-muted-foreground">
                      <span className="font-medium text-foreground tabular-nums">{totalItems}</span>{' '}
                      mục được đề xuất — cuộn để xem.
                    </p>
                  )}
                </div>

                {result.plan_alerts.map((a) => (
                  <div key={a.planId} className="rounded-md border border-warn/30 bg-warn/10 p-3">
                    <p className="flex items-center gap-1.5 text-xs font-medium text-warn">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      {a.planTitle} đang chậm ~{a.behindDays} ngày
                    </p>
                    {a.options.length > 0 ? (
                      <ul className="mt-1.5 space-y-1 text-[11px] text-warn/80">
                        {a.options.map((opt, i) => (
                          <li key={i} className="flex gap-1.5">
                            <span aria-hidden>·</span>
                            <span>{opt}</span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1 text-[11px] text-warn/80">
                        Mở trang kế hoạch để giãn deadline, bỏ bớt cột mốc, hoặc tăng tốc.
                      </p>
                    )}
                  </div>
                ))}

                {result.carry_over.length > 0 && (
                  <section>
                    <SectionTitle>Giữ lại từ hôm trước</SectionTitle>
                    {result.carry_over.map((item, i) => {
                      const key = `c-${item.title}`;
                      return (
                        <SuggestionRow
                          key={`c-${i}`}
                          item={item}
                          isCarryOver
                          added={addedKeys.has(key)}
                          onAdded={() => markAdded(key)}
                        />
                      );
                    })}
                  </section>
                )}

                {result.suggested_tasks.length > 0 && (
                  <section>
                    <SectionTitle>Việc mới đề xuất</SectionTitle>
                    {result.suggested_tasks.map((item, i) => {
                      const key = `s-${item.title}`;
                      return (
                        <SuggestionRow
                          key={`s-${i}`}
                          item={item}
                          isCarryOver={false}
                          added={addedKeys.has(key)}
                          onAdded={() => markAdded(key)}
                        />
                      );
                    })}
                  </section>
                )}

                {result.plan_tasks.length > 0 && (
                  <section>
                    <SectionTitle>
                      <Target className="size-3" /> Theo kế hoạch
                    </SectionTitle>
                    {result.plan_tasks.map((item, i) => {
                      const key = `p-${item.title}`;
                      return (
                        <SuggestionRow
                          key={`p-${i}`}
                          item={item}
                          isCarryOver={false}
                          planLink={{
                            planId: item.planId,
                            milestoneId: item.milestoneId,
                          }}
                          added={addedKeys.has(key)}
                          onAdded={() => markAdded(key)}
                        />
                      );
                    })}
                  </section>
                )}

                {result.queue_pulls.length > 0 && (
                  <section>
                    <SectionTitle>
                      <Sprout className="size-3" /> Từ Ấp ủ
                    </SectionTitle>
                    <p className="mb-1 text-[11px] text-muted-foreground">
                      Ngày mai còn dư chỗ — lấy một điều bạn đang ấp ủ ra làm?
                    </p>
                    {result.queue_pulls.map((item, i) => {
                      const key = `q-${item.goalId}`;
                      return (
                        <QueuePullRow
                          key={`q-${i}`}
                          item={item}
                          added={addedKeys.has(key)}
                          onAdded={() => markAdded(key)}
                        />
                      );
                    })}
                  </section>
                )}

                {empty && (
                  <p className="py-2 text-center text-sm text-muted-foreground">
                    Chưa đủ dữ liệu để đề xuất — dùng app thêm vài ngày nhé.
                  </p>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        {result && (
          <div className="border-t border-border/70 px-5 py-3">
            <Button variant="ghost" size="sm" onClick={generate} className="text-muted-foreground">
              <RefreshCw className="size-3.5" /> Tạo lại đề xuất
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
