import Link from 'next/link';
import { Clock, LayoutList } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatMinutes } from '@/lib/schedule';
import { InfoHint } from '@/components/info-hint';

/**
 * Focus bar (UI section, 2026-06 overhaul) — combines the time budget + List/Timeline toggle
 * into ONE row, replacing 2 separate strips (CapacityBanner + ViewToggle) so the Today page stacks fewer cards.
 * Shown only for non-past days.
 */
export function FocusBar({
  date,
  view,
  freeMin,
  slotCount,
  plannedMin,
}: {
  date: string;
  view: 'list' | 'timeline';
  freeMin: number;
  slotCount: number;
  /** total estimatedMinutes of unfinished tasks — overload warning */
  plannedMin: number;
}) {
  const over = plannedMin > freeMin && freeMin > 0;
  const toggles = [
    { value: 'list' as const, label: 'Danh sách', icon: LayoutList },
    { value: 'timeline' as const, label: 'Dòng giờ', icon: Clock },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 p-3">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5 shrink-0 text-foreground" />
        {/* free-time is the headline number of this bar → give it weight, not muted text-xs */}
        <span className="text-sm font-medium tabular-nums text-foreground">
          Rảnh ~{formatMinutes(freeMin)}
        </span>
        {slotCount > 0 && <span className="text-muted-foreground/70">· {slotCount} khe</span>}
        {plannedMin > 0 && (
          <span
            className={cn('tabular-nums text-muted-foreground/70', over && 'font-medium text-warn')}
          >
            · đã xếp ~{formatMinutes(plannedMin)}
          </span>
        )}
        <InfoHint label="Quỹ thời gian hôm nay">
          Quỹ giờ rảnh = giờ thức − lịch cứng − đệm.{' '}
          {over && 'Tổng ước lượng đang vượt quỹ rảnh — cân nhắc dời bớt một việc. '}
          Cảnh báo để bạn không nhồi quá sức, không phải để ép.
        </InfoHint>
      </div>
      <div className="inline-flex shrink-0 rounded-lg border border-border/70 p-0.5">
        {toggles.map((t) => {
          const active = view === t.value;
          return (
            <Link
              key={t.value}
              href={`/?date=${date}&view=${t.value}`}
              scroll={false}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
                active
                  ? 'bg-muted font-medium text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
