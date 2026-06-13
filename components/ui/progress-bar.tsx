import { cn } from '@/lib/utils';
import { PROGRESS_TONE_VAR, type ProgressTone } from '@/components/ui/progress-ring';

export interface ProgressBarProps {
  /** Actual progress 0–100; clamped + rounded. */
  value: number;
  /**
   * Optional expected position 0–100 (e.g. time elapsed vs. work done) → drawn as a vertical tick,
   * so a glance shows whether the fill lags or leads the schedule.
   */
  expected?: number;
  tone?: ProgressTone;
  /** Required a11y name, e.g. "Tiến độ cột mốc". */
  label: string;
  className?: string;
}

/**
 * Accessible linear progress bar with an optional "expected position" tick — the shared primitive
 * for plan/milestone progress (replaces the bare `h-1.5 bg-foreground` bars). No charting lib.
 */
export function ProgressBar({
  value,
  expected,
  tone = 'neutral',
  label,
  className,
}: ProgressBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const tick = expected === undefined ? null : Math.max(0, Math.min(100, expected));

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('relative h-1.5 w-full overflow-hidden rounded-full bg-muted', className)}
    >
      <div
        className="h-full rounded-full transition-[width]"
        style={{ width: `${pct}%`, background: PROGRESS_TONE_VAR[tone] }}
      />
      {tick !== null && (
        <span
          aria-hidden
          className="absolute inset-y-0 w-px bg-foreground/50"
          style={{ left: `${tick}%` }}
        />
      )}
    </div>
  );
}
