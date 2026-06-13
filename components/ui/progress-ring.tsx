import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Semantic progress tone — maps to the renovation color tokens (globals.css). */
export type ProgressTone = 'neutral' | 'ok' | 'warn' | 'alert' | 'brand';

export const PROGRESS_TONE_VAR: Record<ProgressTone, string> = {
  neutral: 'var(--foreground)',
  ok: 'var(--ok)',
  warn: 'var(--warn)',
  alert: 'var(--alert)',
  brand: 'var(--accent-brand)',
};

export interface ProgressRingProps {
  /** 0–100; clamped + rounded. */
  value: number;
  /** Outer diameter in px. */
  size?: number;
  /** Ring thickness in px. */
  thickness?: number;
  tone?: ProgressTone;
  /** Center content (number, fraction, icon…). */
  children?: ReactNode;
  /** Required a11y name describing what the ring measures, e.g. "Tiến độ kế hoạch". */
  label: string;
  className?: string;
}

/**
 * Accessible conic-gradient progress ring — the single source for every % donut in the app
 * (retires the 3 ad-hoc rings in stats-cards / plan-momentum / plan-card). No charting lib.
 */
export function ProgressRing({
  value,
  size = 44,
  thickness = 6,
  tone = 'neutral',
  children,
  label,
  className,
}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const inner = Math.max(0, size - thickness * 2);

  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn('relative flex shrink-0 items-center justify-center rounded-full', className)}
      style={{
        width: size,
        height: size,
        background: `conic-gradient(${PROGRESS_TONE_VAR[tone]} ${pct}%, var(--muted) 0)`,
      }}
    >
      <div
        className="flex flex-col items-center justify-center rounded-full bg-background"
        style={{ width: inner, height: inner }}
      >
        {children}
      </div>
    </div>
  );
}
