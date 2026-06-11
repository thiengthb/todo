'use client';

import { useState, useTransition } from 'react';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { formatMinutes } from '@/lib/schedule';
import { hmToMinutes } from '@/lib/notify/time';
import { scheduleTaskAt } from '@/app/actions';
import type { FreeSlot } from '@/lib/types';

/**
 * Primitive xếp một việc vào khe giờ (mục 14) — Popover liệt kê khe rảnh 1-chạm.
 * Khe ngắn hơn ước lượng → disabled + gợi ý. Có ô giờ thủ công. Không drag-drop.
 */
export function SlotPicker({
  taskId,
  estimatedMinutes,
  freeSlots,
  trigger,
  hasSlot,
}: {
  taskId: string;
  estimatedMinutes?: number | null;
  freeSlots: FreeSlot[];
  trigger: React.ReactNode;
  /** đã xếp giờ rồi → cho phép bỏ giờ */
  hasSlot?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState('');
  const [, startTransition] = useTransition();

  function pick(hm: string | null) {
    setOpen(false);
    startTransition(() => scheduleTaskAt(taskId, hm));
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="w-60 p-1.5">
        <p className="mb-1.5 px-1 text-xs text-muted-foreground">Xếp vào khe trống</p>
        <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
          {freeSlots.length === 0 && (
            <p className="px-1 py-2 text-xs text-muted-foreground/70">
              Không còn khe trống — thử ô giờ thủ công bên dưới.
            </p>
          )}
          {freeSlots.map((s) => {
            const tooShort = estimatedMinutes != null && s.durationMin < estimatedMinutes;
            return (
              <button
                key={s.start}
                type="button"
                disabled={tooShort}
                onClick={() => pick(s.start)}
                className={cn(
                  'flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                  tooShort ? 'cursor-not-allowed text-muted-foreground/40' : 'hover:bg-muted',
                )}
              >
                <span className="tabular-nums">
                  {s.start}–{s.end}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  rảnh {formatMinutes(s.durationMin)}
                  {tooShort && ' · ngắn'}
                </span>
              </button>
            );
          })}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 border-t border-border/70 pt-1.5">
          <Input
            type="time"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            className="h-8 w-28"
            aria-label="Giờ thủ công"
          />
          <button
            type="button"
            disabled={!manual || hmToMinutes(manual) < 0}
            onClick={() => pick(manual)}
            className="rounded-md px-2 py-1 text-xs text-foreground hover:bg-muted disabled:opacity-40"
          >
            Đặt
          </button>
          {hasSlot && (
            <button
              type="button"
              onClick={() => pick(null)}
              className="ml-auto rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-destructive"
            >
              Bỏ giờ
            </button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
