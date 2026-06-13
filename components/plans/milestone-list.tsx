'use client';

import { useState, useTransition } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { daysBetween, formatDateShort } from '@/lib/dates';
import { addMilestone, deleteMilestone, toggleMilestone } from '@/app/actions';

export interface MilestoneRow {
  id: string;
  title: string;
  order: number;
  targetDate: string | null;
  done: boolean;
}

/**
 * Compact timeline of the dated milestones — dots positioned by `targetDate`, colored by state
 * (done = ok, overdue = warn, upcoming = neutral) + a "today" marker. Only shown when ≥2 milestones
 * carry a target date and they don't all fall on the same day.
 */
function MilestoneTimeline({ milestones, today }: { milestones: MilestoneRow[]; today: string }) {
  const dated = milestones
    .filter((m) => m.targetDate)
    .sort((a, b) => a.targetDate!.localeCompare(b.targetDate!));
  if (dated.length < 2) return null;
  const min = dated[0].targetDate!;
  const max = dated[dated.length - 1].targetDate!;
  const span = daysBetween(min, max);
  if (span <= 0) return null;
  const pos = (d: string) => (daysBetween(min, d) / span) * 100;
  const todayInRange = today >= min && today <= max;

  return (
    <div className="mt-1 mb-5">
      <div className="relative h-6">
        <div className="absolute inset-x-1 top-1/2 h-px -translate-y-1/2 bg-border" />
        {todayInRange && (
          <div
            aria-hidden
            className="absolute top-1/2 h-3 w-px -translate-y-1/2 bg-foreground/40"
            style={{ left: `${pos(today)}%` }}
          />
        )}
        {dated.map((m) => {
          const overdue = !m.done && m.targetDate! < today;
          const tone = m.done ? 'var(--ok)' : overdue ? 'var(--warn)' : 'var(--muted-foreground)';
          return (
            <span
              key={m.id}
              title={`${m.title} · ${formatDateShort(m.targetDate!)}`}
              className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
              style={{ left: `${pos(m.targetDate!)}%`, background: tone }}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{formatDateShort(min)}</span>
        <span>{formatDateShort(max)}</span>
      </div>
    </div>
  );
}

export function MilestoneList({
  planId,
  milestones,
  today,
}: {
  planId: string;
  milestones: MilestoneRow[];
  /** the user's local day "YYYY-MM-DD" (passed from the server to avoid a hydration mismatch) */
  today: string;
}) {
  const [, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');

  function submitNew() {
    const t = draft.trim();
    if (!t) {
      setAdding(false);
      return;
    }
    setDraft('');
    setAdding(false);
    startTransition(() => addMilestone(planId, t));
  }

  return (
    <div>
      <MilestoneTimeline milestones={milestones} today={today} />
      {milestones.map((m) => {
        const overdue = !!m.targetDate && !m.done && m.targetDate < today;
        return (
          <div
            key={m.id}
            className="group flex items-center gap-3 border-b border-border/70 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
          >
            <button
              type="button"
              aria-label={m.done ? 'Bỏ đánh dấu xong' : 'Đánh dấu xong cột mốc'}
              onClick={() => startTransition(() => toggleMilestone(m.id, !m.done))}
              className={cn(
                'flex size-[18px] shrink-0 items-center justify-center rounded-full border transition-colors',
                m.done
                  ? 'border-foreground bg-foreground text-background'
                  : overdue
                    ? 'border-warn text-warn hover:border-warn'
                    : 'border-muted-foreground/50 hover:border-foreground',
              )}
            >
              {m.done && <Check className="size-3" strokeWidth={3} />}
            </button>

            <span
              className={cn(
                'min-w-0 flex-1 text-sm',
                m.done && 'text-muted-foreground line-through',
              )}
            >
              {m.title}
            </span>

            {m.targetDate && (
              <span
                className={cn(
                  'shrink-0 text-[11px] tabular-nums',
                  overdue ? 'font-medium text-warn' : 'text-muted-foreground',
                )}
              >
                {formatDateShort(m.targetDate)}
              </span>
            )}

            <button
              type="button"
              aria-label="Xoá cột mốc"
              onClick={() => startTransition(() => deleteMilestone(m.id))}
              className="shrink-0 rounded-md p-1.5 text-muted-foreground opacity-60 transition-opacity hover:!opacity-100 hover:text-destructive focus-visible:opacity-100 sm:opacity-0 sm:group-hover:opacity-60"
            >
              <X className="size-3.5" />
            </button>
          </div>
        );
      })}

      {adding ? (
        <div className="flex items-center gap-3 py-3">
          <span className="size-[18px] shrink-0 rounded-full border border-dashed border-muted-foreground/40" />
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') {
                setDraft('');
                setAdding(false);
              }
            }}
            onBlur={submitNew}
            placeholder="Tên cột mốc... (Enter)"
            className="h-8 border-0 border-b bg-transparent text-sm shadow-none rounded-none focus-visible:ring-0"
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 flex items-center gap-2 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <Plus className="size-3.5" /> Thêm cột mốc
        </button>
      )}
    </div>
  );
}
