'use client';

import { type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Read-only tooltip for icon buttons — SHARED across the app (UI section), replacing every `title=`.
 * Only for SHORT content on hover/focus; long/conceptual explanations use <InfoHint> (Popover).
 */
export function IconTooltip({
  label,
  side = 'top',
  children,
}: {
  label: ReactNode;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  );
}
