'use client';

import { useTransition } from 'react';
import { AlertTriangle, CalendarPlus, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { extendPlanDeadline } from '@/app/actions';

/**
 * Behind-schedule alert + options (section 10.4) — does NOT silently auto-adjust,
 * states clearly how far behind it is and lets the user choose how to handle it.
 */
export function BehindAlert({ id, behindDays }: { id: string; behindDays: number }) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-lg border border-warn/30 bg-warn/10 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-warn">
        <AlertTriangle className="size-4 shrink-0" />
        Đang chậm khoảng {behindDays} ngày so với lộ trình
      </p>
      <p className="mt-1 text-xs text-warn/80">Chọn một hướng để lộ trình khả thi trở lại:</p>
      <ul className="mt-2 space-y-1 text-xs text-warn/80">
        <li>· Giãn deadline để giữ nhịp hiện tại, hoặc</li>
        <li>· Bỏ bớt một cột mốc chưa quan trọng (xoá ở danh sách dưới), hoặc</li>
        <li>· Giữ nguyên và tăng tốc — đề xuất hằng ngày sẽ ưu tiên việc của kế hoạch này.</li>
      </ul>
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => startTransition(() => extendPlanDeadline(id, behindDays))}
        className="mt-3 gap-2 border-warn/40"
      >
        {pending ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <CalendarPlus className="size-3.5" />
        )}
        Giãn deadline +{behindDays} ngày
      </Button>
    </div>
  );
}
