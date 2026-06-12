'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

/**
 * Cắt 1 dòng (truncate) THÔNG MINH dùng chung toàn app (mục giao diện §12): chỉ bật tooltip
 * khi chữ thật sự bị tràn — không phình tooltip vô nghĩa cho chữ ngắn. Tooltip hiện full nội
 * dung ngay dưới con trỏ (side mặc định "bottom"). Đo tràn qua scrollWidth + ResizeObserver.
 */
export function Truncate({
  children,
  full,
  className,
  side = 'bottom',
}: {
  children: ReactNode;
  /** nội dung đầy đủ hiện trong tooltip; mặc định = children (dùng khi children là chuỗi) */
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
