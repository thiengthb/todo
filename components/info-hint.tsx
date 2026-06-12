'use client';

import { type ReactNode } from 'react';
import { Info } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

/**
 * ⓘ icon opening a Popover on CLICK/TAP (UI section) — replaces long descriptions to reduce clutter.
 * Uses a Popover (not a hover-tooltip) so it works on touch + proper a11y (focus, Esc).
 * Only hides the EXPLANATION; the action label still shows next to it.
 */
export function InfoHint({
  children,
  label = 'Giải thích',
  className,
  side = 'top',
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            'inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground',
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-64 text-xs leading-relaxed text-muted-foreground"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
