'use client';

import { useState, useTransition } from 'react';
import { Loader2, Pencil, Plus, Repeat, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/empty-state';
import { InfoHint } from '@/components/info-hint';
import { weekdayShortVN } from '@/lib/dates';
import { addHabit, deleteHabit, setHabitActive, updateHabit } from '@/app/habits/actions';

export interface HabitRow {
  id: string;
  title: string;
  daysOfWeek: string | null;
  active: boolean;
  streak: number;
}

const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function daysLabel(csv: string | null): string {
  if (!csv) return 'Hằng ngày';
  const set = new Set(csv.split(',').map(Number));
  return WEEK_ORDER.filter((d) => set.has(d))
    .map((d) => weekdayShortVN(d))
    .join(' · ');
}

export function HabitManager({ habits }: { habits: HabitRow[] }) {
  const [editing, setEditing] = useState<HabitRow | 'new' | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const header = (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-1.5 text-sm font-medium">
        <Repeat className="size-4 text-muted-foreground" />
        Thói quen
        {habits.length > 0 && (
          <span className="font-normal text-muted-foreground">({habits.length})</span>
        )}
        <InfoHint label="Thói quen là gì?">
          Hành vi lặp lại bạn muốn duy trì (uống nước, thiền…). Tick 1 chạm mỗi ngày. Không điểm số
          — chỉ phản chiếu chuỗi để bạn thấy đà.
        </InfoHint>
      </h2>
      <Button variant="outline" size="sm" onClick={() => setEditing('new')}>
        <Plus /> Thêm thói quen
      </Button>
    </div>
  );

  return (
    <section className="space-y-3">
      {header}
      {habits.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="Chưa có thói quen nào"
          description="Thêm một thói quen nhỏ, dễ giữ — tick mỗi ngày để nhen đà."
          className="py-10"
        />
      ) : (
        <div className="rounded-lg border border-border/70">
          {habits.map((h, i) => (
            <div
              key={h.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40',
                i < habits.length - 1 && 'border-b border-border/70',
                !h.active && 'opacity-50',
              )}
            >
              <span className="min-w-0 flex-1 truncate text-sm">{h.title}</span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {daysLabel(h.daysOfWeek)}
              </span>
              {h.streak > 0 && (
                <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                  {h.streak}d
                </span>
              )}
              <Switch
                checked={h.active}
                aria-label="Bật/tắt thói quen"
                onCheckedChange={(v) => {
                  setPendingId(h.id);
                  startTransition(async () => {
                    await setHabitActive(h.id, v);
                    setPendingId(null);
                  });
                }}
              />
              <button
                type="button"
                aria-label="Sửa"
                onClick={() => setEditing(h)}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                aria-label="Xoá"
                disabled={pendingId === h.id}
                onClick={() => {
                  setPendingId(h.id);
                  startTransition(async () => {
                    await deleteHabit(h.id);
                    toast.success('Đã xoá thói quen');
                    setPendingId(null);
                  });
                }}
                className="shrink-0 rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          {editing && (
            <HabitForm
              key={editing === 'new' ? 'new' : editing.id}
              initial={editing === 'new' ? null : editing}
              onClose={() => setEditing(null)}
            />
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function HabitForm({ initial, onClose }: { initial: HabitRow | null; onClose: () => void }) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [days, setDays] = useState<Set<number>>(
    new Set(initial?.daysOfWeek ? initial.daysOfWeek.split(',').map(Number) : []),
  );
  const [saving, startSave] = useTransition();

  function toggleDay(d: number) {
    setDays((prev) => {
      const next = new Set(prev);
      if (next.has(d)) next.delete(d);
      else next.add(d);
      return next;
    });
  }

  function submit() {
    const csv = days.size === 0 ? null : WEEK_ORDER.filter((d) => days.has(d)).join(',');
    startSave(async () => {
      const res = initial
        ? await updateHabit(initial.id, { title, daysOfWeek: csv })
        : await addHabit({ title, daysOfWeek: csv });
      if (res.ok) {
        toast.success(initial ? 'Đã cập nhật' : 'Đã thêm');
        onClose();
      } else {
        toast.error(res.error ?? 'Không lưu được');
      }
    });
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>{initial ? 'Sửa thói quen' : 'Thêm thói quen'}</DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Tên thói quen</label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Uống nước, thiền 5 phút…"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Ngày trong tuần <span className="font-normal">(bỏ trống = hằng ngày)</span>
          </label>
          <div className="flex flex-wrap gap-1">
            {WEEK_ORDER.map((d) => (
              <Button
                key={d}
                type="button"
                size="sm"
                variant={days.has(d) ? 'default' : 'outline'}
                onClick={() => toggleDay(d)}
              >
                {weekdayShortVN(d)}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-2 flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose} disabled={saving}>
          Huỷ
        </Button>
        <Button onClick={submit} disabled={saving}>
          {saving && <Loader2 className="animate-spin" />}
          {initial ? 'Lưu' : 'Thêm'}
        </Button>
      </div>
    </>
  );
}
