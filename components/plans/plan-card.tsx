import Link from 'next/link';
import { AlertTriangle, ChevronRight, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Truncate } from '@/components/ui/truncate';
import { cn } from '@/lib/utils';
import type { PlanProgress, PlanStatus } from '@/lib/types';

const STATUS_LABEL: Record<PlanStatus, string> = {
  active: 'Đang chạy',
  paused: 'Tạm dừng',
  done: 'Hoàn thành',
  archived: 'Lưu trữ',
};

interface PlanCardProps {
  id: string;
  title: string;
  status: PlanStatus;
  daysLeftLabel: string;
  progress: PlanProgress;
}

/** Summary card for a plan in the list — % ring + current milestone + behind-schedule alert */
export function PlanCard({ id, title, status, daysLeftLabel, progress }: PlanCardProps) {
  const behind = status === 'active' && progress.behindDays >= 1;

  return (
    <Link
      href={`/plans/${id}`}
      className="group flex items-center gap-4 rounded-lg border border-border/70 p-4 transition-[background-color,transform] hover:bg-muted/40 active:scale-[0.99]"
    >
      <ProgressRing pct={progress.progressPct} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <Truncate className="text-sm font-medium">{title}</Truncate>
          {status !== 'active' && (
            <Badge variant="outline" className="shrink-0 text-[11px] font-normal">
              {STATUS_LABEL[status]}
            </Badge>
          )}
          {behind && (
            <Badge
              variant="outline"
              className="shrink-0 gap-1 border-amber-300 bg-amber-50 text-[11px] font-normal text-amber-700 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-400"
            >
              <AlertTriangle className="size-3" />
              chậm {progress.behindDays}d
            </Badge>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
          <Target className="size-3 shrink-0" />
          <Truncate>{progress.currentMilestone ?? 'Đã xong mọi cột mốc'}</Truncate>
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {progress.done}/{progress.total} cột mốc
          </span>
          <span aria-hidden>·</span>
          <span>{daysLeftLabel}</span>
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Small progress ring via conic-gradient — no lib needed */
function ProgressRing({ pct }: { pct: number }) {
  return (
    <div
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-foreground) ${pct}%, var(--color-muted) 0)`,
      }}
    >
      <div className="flex size-8 items-center justify-center rounded-full bg-background">
        <span className={cn('text-[11px] font-medium tabular-nums')}>{pct}</span>
      </div>
    </div>
  );
}
