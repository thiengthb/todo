import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { InfoHint } from '@/components/info-hint';

/**
 * Shared Field for EVERY form (UI section): label + control + hint/info.
 * A control inside a `sm:grid-cols-2` grid is always `w-full` → equal cells filling the grid.
 * Uses a <div> (not a wrapping <label>) so it doesn't conflict with Popover-style controls (DatePicker/TimePicker).
 */
export function Field({
  label,
  hint,
  info,
  className,
  children,
}: {
  label: ReactNode;
  /** Short note below the control */
  hint?: ReactNode;
  /** Long explanation → ⓘ icon next to the label (Popover) */
  info?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {info && (
          <InfoHint label={typeof label === 'string' ? label : 'Giải thích'}>{info}</InfoHint>
        )}
      </span>
      {children}
      {hint && <span className="text-[11px] text-muted-foreground/80">{hint}</span>}
    </div>
  );
}
