'use client';

import { useState, useTransition } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toggleHabitToday } from '@/app/habits/actions';

export interface HabitStripItem {
  id: string;
  title: string;
  doneToday: boolean;
}

/**
 * Dải thói quen hôm nay (mục 11) — pill 1 chạm. KHÔNG điểm/streak (giữ phản hồi thông tin).
 * Trang chỉ truyền các thói quen ĐẾN HẠN hôm nay; rỗng → component không render.
 */
export function HabitStrip({ habits }: { habits: HabitStripItem[] }) {
  const [pending, startTransition] = useTransition();
  // trạng thái lạc quan để bấm thấy phản hồi ngay
  const [done, setDone] = useState<Record<string, boolean>>(
    Object.fromEntries(habits.map((h) => [h.id, h.doneToday])),
  );

  if (habits.length === 0) return null;

  function toggle(id: string) {
    setDone((d) => ({ ...d, [id]: !d[id] }));
    startTransition(() => toggleHabitToday(id));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-xs text-muted-foreground">Thói quen</span>
      {habits.map((h) => {
        const isDone = done[h.id];
        return (
          <button
            key={h.id}
            type="button"
            disabled={pending}
            onClick={() => toggle(h.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors',
              isDone
                ? 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-400'
                : 'border-border text-muted-foreground hover:border-foreground hover:text-foreground',
            )}
          >
            <span
              className={cn(
                'flex size-3.5 items-center justify-center rounded-full border',
                isDone
                  ? 'border-emerald-500 bg-emerald-500 text-white dark:text-emerald-950'
                  : 'border-muted-foreground/50',
              )}
            >
              {isDone && <Check className="size-2.5" strokeWidth={3} />}
            </span>
            {h.title}
          </button>
        );
      })}
    </div>
  );
}
