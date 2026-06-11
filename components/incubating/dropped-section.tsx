'use client';

import { useState, useTransition } from 'react';
import { ChevronDown, RotateCcw, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { IconTooltip } from '@/components/icon-tooltip';
import { deleteGoal, restoreGoal } from '@/app/incubating/actions';
import type { GoalDTO } from '@/lib/types';

/**
 * Khối "Đã buông" gập lại (mục 17 / 11.2): buông không tội lỗi, vẫn khôi phục được.
 * Mặc định đóng để không níu kéo sự chú ý.
 */
export function DroppedSection({ goals }: { goals: GoalDTO[] }) {
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  return (
    <section>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ChevronDown className={cn('size-4 transition-transform', !open && '-rotate-90')} />
        Đã buông ({goals.length})
      </button>

      {open && (
        <div className="mt-3 rounded-lg border border-border/70">
          {goals.map((g) => (
            <div
              key={g.id}
              className="flex items-center gap-3 border-b border-border/70 px-4 py-3 last:border-b-0"
            >
              <p className="min-w-0 flex-1 truncate text-sm text-muted-foreground line-through">
                {g.title}
              </p>
              <IconTooltip label="Khôi phục">
                <button
                  type="button"
                  aria-label="Khôi phục"
                  onClick={() => startTransition(() => restoreGoal(g.id))}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <RotateCcw className="size-4" />
                </button>
              </IconTooltip>
              <IconTooltip label="Xoá hẳn">
                <button
                  type="button"
                  aria-label="Xoá hẳn"
                  onClick={() => startTransition(() => deleteGoal(g.id))}
                  className="rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </button>
              </IconTooltip>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
