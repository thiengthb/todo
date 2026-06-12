'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * SMART single-line truncate shared across the app (UI section §12): only enables the tooltip
 * when the text actually overflows — no pointless tooltip for short text. The tooltip shows the full
 * content right below the cursor (default side "bottom"). Measures overflow via scrollWidth + ResizeObserver.
 */
export function Truncate({
  children,
  full,
  className,
  side = 'bottom',
}: {
  children: ReactNode;
  /** full content shown in the tooltip; defaults to children (used when children is a string) */
  full?: ReactNode;
  className?: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  const check = useCallback(() => {
    const el = ref.current;
    if (el) setOverflow(el.scrollWidth > el.clientWidth + 1);
  }, []);

  useEffect(() => {
    check();
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [check, children]);

  const span = (
    <span ref={ref} className={cn('block min-w-0 truncate', className)}>
      {children}
    </span>
  );

  if (!overflow) return span;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{span}</TooltipTrigger>
      <TooltipContent side={side} className="max-w-xs break-words whitespace-normal">
        {full ?? children}
      </TooltipContent>
    </Tooltip>
  );
}
