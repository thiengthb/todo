'use client';

import { useState, useTransition } from 'react';
import { Check, MoreHorizontal, Pencil, Pin, PinOff, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { IconTooltip } from '@/components/icon-tooltip';
import { Truncate } from '@/components/ui/truncate';
import { cn } from '@/lib/utils';
import { dropGoal, pinGoal, snoozeGoal, updateGoal } from '@/app/incubating/actions';
import type { GoalDTO } from '@/lib/types';
import { PromoteMenu } from '@/components/incubating/promote-menu';

/** Một hàng mục tiêu trong "Ấp ủ" (mục 17) — bộ row chuẩn §12. */
export function GoalCard({ goal }: { goal: GoalDTO }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(goal.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, startTransition] = useTransition();

  function saveEdit() {
    const t = draft.trim();
    setEditing(false);
    if (!t || t === goal.title) {
      setDraft(goal.title);
      return;
    }
    startTransition(() => updateGoal(goal.id, { title: t }));
  }

  function togglePin() {
    startTransition(() => pinGoal(goal.id, !goal.pinned));
  }

  function drop() {
    setMenuOpen(false);
    startTransition(async () => {
      await dropGoal(goal.id);
      toast('Đã buông', { description: goal.title });
    });
  }

  function keep() {
    // "giữ" = ghim → reset độ-cũ, tắt gợi ý hỏi-cũ
    startTransition(() => pinGoal(goal.id, true));
  }

  const rowClass =
    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted';

  return (
    <div className="flex items-start gap-3 border-b border-border/70 px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/40">
      {/* Ghim */}
      <IconTooltip label={goal.pinned ? 'Bỏ ghim' : 'Ghim — muốn làm sớm'}>
        <button
          type="button"
          onClick={togglePin}
          aria-label={goal.pinned ? 'Bỏ ghim' : 'Ghim'}
          className={cn(
            'mt-0.5 shrink-0 rounded-md p-1 transition-colors',
            goal.pinned
              ? 'text-foreground'
              : 'text-muted-foreground/40 hover:text-muted-foreground',
          )}
        >
          <Pin className={cn('size-4', goal.pinned && 'fill-current')} />
        </button>
      </IconTooltip>

      {/* Tiêu đề + ghi chú + (nếu cũ) gợi ý giữ/buông */}
      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-1">
            <Input
              value={draft}
              autoFocus
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveEdit();
                if (e.key === 'Escape') {
                  setDraft(goal.title);
                  setEditing(false);
                }
              }}
              className="h-8 text-sm"
            />
            <button
              type="button"
              aria-label="Lưu"
              onClick={saveEdit}
              className="rounded-md p-1 text-muted-foreground hover:text-foreground"
            >
              <Check className="size-4" />
            </button>
          </div>
        ) : (
          <>
            <Truncate className="text-sm">{goal.title}</Truncate>
            {goal.note && (
              <Truncate className="mt-0.5 text-xs text-muted-foreground">{goal.note}</Truncate>
            )}
            {goal.isStale && (
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <span>Nằm im {goal.ageDays} ngày — còn muốn không?</span>
                <button
                  type="button"
                  onClick={keep}
                  className="font-medium text-foreground hover:underline"
                >
                  Giữ
                </button>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  onClick={drop}
                  className="hover:text-foreground hover:underline"
                >
                  Buông
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Tuổi */}
      {!editing && !goal.isStale && goal.ageDays >= 1 && (
        <span className="mt-0.5 shrink-0 text-xs text-muted-foreground tabular-nums">
          {goal.ageDays}d
        </span>
      )}

      {/* Đưa vào (kéo thành việc / nâng thành kế hoạch) */}
      {!editing && <PromoteMenu goal={goal} />}

      {/* Overflow: sửa / buông */}
      {!editing && (
        <Popover open={menuOpen} onOpenChange={setMenuOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="size-8 shrink-0" aria-label="Tuỳ chọn">
              <MoreHorizontal className="size-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1">
            <button
              type="button"
              className={rowClass}
              onClick={() => {
                setMenuOpen(false);
                setEditing(true);
              }}
            >
              <Pencil className="size-4" /> Sửa tiêu đề
            </button>
            {!goal.pinned && (
              <button
                type="button"
                className={rowClass}
                onClick={() => {
                  setMenuOpen(false);
                  startTransition(() => snoozeGoal(goal.id, 30));
                  toast('Tạm ẩn 30 ngày');
                }}
              >
                <PinOff className="size-4" /> Tạm ẩn 30 ngày
              </button>
            )}
            <button type="button" className={cn(rowClass, 'text-destructive')} onClick={drop}>
              <Trash2 className="size-4" /> Buông
            </button>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
