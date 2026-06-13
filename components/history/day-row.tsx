import Link from 'next/link';
import { ChevronRight, Frown, Meh, Smile, type LucideIcon } from 'lucide-react';
import { dayLabel, formatDateShort } from '@/lib/dates';
import { Truncate } from '@/components/ui/truncate';

export interface DaySummary {
  date: string;
  total: number;
  done: number;
  percent: number;
  emotions: { love: number; meh: number; hard: number };
  note: string | null;
  /** the first few titles — preview for a future day */
  titles: string[];
}

const EMOTION_ICONS: Record<keyof DaySummary['emotions'], { icon: LucideIcon; className: string }> =
  {
    love: { icon: Smile, className: 'text-ok' },
    meh: { icon: Meh, className: 'text-warn' },
    hard: { icon: Frown, className: 'text-alert' },
  };

export function EmotionSummary({ emotions }: { emotions: DaySummary['emotions'] }) {
  const keys = (Object.keys(EMOTION_ICONS) as (keyof typeof EMOTION_ICONS)[]).filter(
    (k) => emotions[k] > 0,
  );
  if (keys.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1.5 text-xs tabular-nums">
      {keys.map((k) => {
        const { icon: Icon, className } = EMOTION_ICONS[k];
        return (
          <span key={k} className="flex items-center gap-0.5 text-muted-foreground">
            <Icon className={`size-3.5 ${className}`} aria-hidden />
            {emotions[k]}
          </span>
        );
      })}
    </span>
  );
}

export function DayRow({ day, isFuture }: { day: DaySummary; isFuture: boolean }) {
  return (
    <Link
      href={`/?date=${day.date}`}
      className="group flex items-center gap-4 border-b border-border/70 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
    >
      <div className="w-20 shrink-0 sm:w-24">
        <p className="text-sm font-medium capitalize">{dayLabel(day.date)}</p>
        <p className="text-xs text-muted-foreground">{formatDateShort(day.date)}</p>
      </div>

      <div className="min-w-0 flex-1">
        {isFuture ? (
          <Truncate className="text-xs text-muted-foreground" full={day.titles.join(' · ')}>
            {day.titles.slice(0, 3).join(' · ')}
            {day.titles.length > 3 && ` +${day.titles.length - 3}`}
          </Truncate>
        ) : (
          <>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-foreground/70"
                style={{ width: `${day.percent}%` }}
              />
            </div>
            {day.note && (
              <p className="mt-1.5 line-clamp-1 text-xs text-muted-foreground italic">
                “{day.note}”
              </p>
            )}
            {/* emotion summary moves below the bar on mobile so it isn't dropped on small screens */}
            <div className="mt-1.5 sm:hidden">
              <EmotionSummary emotions={day.emotions} />
            </div>
          </>
        )}
      </div>

      {isFuture ? (
        <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
          {day.total} việc
        </span>
      ) : (
        <>
          <div className="hidden sm:block">
            <EmotionSummary emotions={day.emotions} />
          </div>
          <span className="w-16 shrink-0 text-right text-sm tabular-nums sm:w-20">
            {day.done}/{day.total}
            <span className="ml-1 text-xs text-muted-foreground">{day.percent}%</span>
          </span>
        </>
      )}
      <ChevronRight className="hidden size-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
    </Link>
  );
}
