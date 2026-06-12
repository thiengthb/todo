'use client';

import { useState, useTransition } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InfoHint } from '@/components/info-hint';
import { computeCapacity } from '@/lib/capacity';
import { upsertCheckin } from '@/app/actions';

export interface CheckinValues {
  energy: number | null;
  mood: number | null;
  stress: number | null;
  sleepHours: number | null;
}

/** Soft interpretation of the 0..100 capacity score — no judgment, just a hint to adjust load */
function capacityLabel(score: number): { text: string; tone: string } {
  if (score >= 66) return { text: 'Sức tốt', tone: 'text-emerald-600 dark:text-emerald-400' };
  if (score >= 40) return { text: 'Sức vừa', tone: 'text-muted-foreground' };
  return { text: 'Sức thấp', tone: 'text-amber-600 dark:text-amber-400' };
}

/** A 1..5 scale, one tap to select; tapping the selected value again = clear */
function Scale({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number | null;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              'size-9 rounded-md border text-sm tabular-nums transition-colors sm:size-7 sm:text-xs',
              value === n
                ? 'border-foreground bg-foreground text-background'
                : 'border-border text-muted-foreground hover:border-foreground',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Personal OS check-in (section 11) — all optional, one tap, skippable.
 * The AI uses it to infer capacity → reduce load / suggest a recovery day when energy is low.
 */
export function CheckinBox({ initial }: { initial: CheckinValues }) {
  const [v, setV] = useState<CheckinValues>(initial);
  // progressive disclosure: open by default when nothing is rated, collapse once it is (saves space)
  const [open, setOpen] = useState(() => computeCapacity(initial) == null);
  const [, startTransition] = useTransition();

  function update(patch: Partial<CheckinValues>) {
    const next = { ...v, ...patch };
    setV(next);
    startTransition(() => upsertCheckin(next));
  }
  const pick = (key: keyof CheckinValues, n: number) => update({ [key]: v[key] === n ? null : n });

  const SLEEP = [5, 6, 7, 8];

  // capacity computed DYNAMICALLY on the client from the current check-in (section 11) — null when nothing entered
  const capacity = computeCapacity(v);
  const cap = capacity != null ? capacityLabel(capacity) : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/70 p-4">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        Trạng thái hôm nay
        <InfoHint label="Trạng thái hôm nay để làm gì?">
          Tùy chọn, chạm 1 lần. Những hôm năng lượng thấp / căng thẳng cao / ngủ ít, AI sẽ
          <strong className="font-medium text-foreground"> giảm tải</strong> và có thể đề xuất một{' '}
          <strong className="font-medium text-foreground">ngày phục hồi</strong>. Bỏ trống cũng
          không sao.
        </InfoHint>
      </p>

      {/* Gauge sức ngày — chỉ hiện khi đã có check-in; cập nhật ngay khi chấm */}
      {capacity != null && cap && (
        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Sức hôm nay</span>
            <span className={cn('font-medium tabular-nums', cap.tone)}>
              {cap.text} · {capacity}
            </span>
          </div>
          <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-500',
                capacity < 40 ? 'bg-amber-500/70' : 'bg-foreground/70',
              )}
              style={{ width: `${capacity}%` }}
            />
          </div>
          {capacity < 40 && (
            <p className="mt-1.5 text-[11px] leading-relaxed text-emerald-600 dark:text-emerald-400">
              Sức đang thấp — hôm nay nhẹ thôi cũng được. Giữ 1 việc chính là đủ.
            </p>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center justify-between rounded-md text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        <span>{capacity != null ? 'Cập nhật trạng thái' : 'Chấm trạng thái hôm nay'}</span>
        <ChevronDown className={cn('size-3.5 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          <Scale label="Năng lượng" value={v.energy} onPick={(n) => pick('energy', n)} />
          <Scale label="Tâm trạng" value={v.mood} onPick={(n) => pick('mood', n)} />
          <Scale label="Căng thẳng" value={v.stress} onPick={(n) => pick('stress', n)} />
          <div className="flex items-center justify-between gap-3">
            <span className="w-24 shrink-0 text-xs text-muted-foreground">Ngủ (giờ)</span>
            <div className="flex gap-1">
              {SLEEP.map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => update({ sleepHours: v.sleepHours === h ? null : h })}
                  className={cn(
                    'size-9 rounded-md border text-sm tabular-nums transition-colors sm:size-7 sm:text-xs',
                    v.sleepHours === h
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border text-muted-foreground hover:border-foreground',
                  )}
                >
                  {h === 8 ? '8+' : h}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
