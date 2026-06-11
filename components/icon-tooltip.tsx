'use client';

import { type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Tooltip read-only cho nút-icon — dùng CHUNG toàn app (mục giao diện), thay mọi `title=`.
 * Chỉ cho nội dung NGẮN khi hover/focus; phần giải thích dài/khái niệm dùng <InfoHint> (Popover).
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
