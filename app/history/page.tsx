import Link from 'next/link';
import {
  CalendarRange,
  ChevronRight,
  Clock,
  Flame,
  Frown,
  Meh,
  Smile,
  type LucideIcon,
} from 'lucide-react';
import { prisma } from '@/lib/db';
import { addDays, dayLabel, formatDateShort, todayStr } from '@/lib/dates';
import { computeStreaks } from '@/lib/streak';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { Truncate } from '@/components/ui/truncate';

export const dynamic = 'force-dynamic';

interface DaySummary {
  date: string;
  total: number;
  done: number;
  percent: number;
  emotions: { love: number; meh: number; hard: number };
  note: string | null;
  /** vài tiêu đề đầu — preview cho ngày tương lai */
  titles: string[];
}

const EMOTION_ICONS: Record<keyof DaySummary['emotions'], { icon: LucideIcon; className: string }> =
  {
    love: { icon: Smile, className: 'text-emerald-600 dark:text-emerald-400' },
    meh: { icon: Meh, className: 'text-amber-600 dark:text-amber-400' },
    hard: { icon: Frown, className: 'text-rose-600 dark:text-rose-400' },
  };

function EmotionSummary({ emotions }: { emotions: DaySummary['emotions'] }) {
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
            <Icon className={`size-3.5 ${className}`} />
            {emotions[k]}
          </span>
        );
      })}
    </span>
  );
}

function DayRow({ day, isFuture }: { day: DaySummary; isFuture: boolean }) {
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

export default async function HistoryPage() {
  const today = todayStr();
  const [tasks, notes] = await Promise.all([
    prisma.task.findMany({ orderBy: { date: 'asc' } }),
    prisma.dailyNote.findMany(),
  ]);
  const noteByDate = new Map(notes.map((n) => [n.date, n.note]));

  // Gom theo ngày
  const byDate = new Map<string, typeof tasks>();
  for (const t of tasks) {
    const arr = byDate.get(t.date) ?? [];
    arr.push(t);
    byDate.set(t.date, arr);
  }
  const days: DaySummary[] = [...byDate.entries()].map(([date, list]) => {
    const done = list.filter((t) => t.done).length;
    const emotions = { love: 0, meh: 0, hard: 0 };
    for (const t of list) {
      if (t.emotion && t.emotion in emotions) {
        emotions[t.emotion as keyof typeof emotions] += 1;
      }
    }
    return {
      date,
      total: list.length,
      done,
      percent: list.length ? Math.round((done / list.length) * 100) : 0,
      emotions,
      note: noteByDate.get(date) ?? null,
      titles: list.filter((t) => !t.done).map((t) => t.title),
    };
  });

  const future = days.filter((d) => d.date > today); // đã asc theo query
  const pastAndToday = days.filter((d) => d.date <= today).reverse(); // mới nhất trước

  // Chuỗi giữ lửa — tính động từ các ngày có ≥1 việc done
  const streak = computeStreaks(
    days.filter((d) => d.done > 0).map((d) => d.date),
    today,
  );

  // Dải hoạt động 14 ngày gần nhất (kết thúc hôm nay)
  const strip = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    const day = days.find((d) => d.date === date);
    return { date, percent: day?.percent ?? null };
  });

  return (
    <div className="py-8">
      <PageHeader eyebrow="Toàn cảnh các ngày" title="Lịch sử" />

      <div className="space-y-10">
        {/* Chuỗi giữ lửa */}
        <section aria-label="Chuỗi giữ lửa">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Flame className="size-3.5" /> Chuỗi giữ lửa
          </h2>
          <div className="mb-4 grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1 rounded-lg border border-border/70 p-4">
              <p className="text-xs text-muted-foreground">
                Hiện tại{streak.atRisk && ' · đang treo'}
              </p>
              <p className="flex items-baseline gap-1.5 text-xl font-semibold tracking-tight tabular-nums">
                {streak.current > 0 && (
                  <Flame
                    className={cn(
                      'size-4 self-center',
                      streak.atRisk ? 'text-muted-foreground' : 'text-amber-500',
                    )}
                  />
                )}
                {streak.current} ngày
              </p>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-border/70 p-4">
              <p className="text-xs text-muted-foreground">Kỷ lục</p>
              <p className="text-xl font-semibold tracking-tight tabular-nums">
                {streak.longest} ngày
              </p>
            </div>
          </div>

          {streak.runs.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="Chưa có chuỗi nào"
              description="Hoàn thành 1 việc mỗi ngày để nhóm lửa — lỡ một ngày vẫn được ân hạn."
              className="py-10"
            />
          ) : (
            // Các đợt giữ lửa gập lại — tránh lặp streak quá nhiều (mục giao diện)
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                Xem {streak.runs.length} đợt giữ lửa
              </summary>
              <ul className="mt-1">
                {streak.runs.map((run, i) => {
                  // run mới nhất (i===0) đang chạy khi current>0
                  const isLive = i === 0 && streak.current > 0;
                  return (
                    <li
                      key={run.start}
                      className="flex items-center justify-between border-b border-border/70 py-3 text-sm last:border-b-0"
                    >
                      <span className="text-muted-foreground tabular-nums">
                        {formatDateShort(run.start)}
                        {run.end !== run.start && ` – ${formatDateShort(run.end)}`}
                      </span>
                      <span className="flex items-center gap-2">
                        {isLive && (
                          <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                            <Flame className="size-3" />
                            {streak.atRisk ? 'đang treo' : 'đang chạy'}
                          </span>
                        )}
                        <span className="font-medium tabular-nums">{run.length} ngày</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </details>
          )}
        </section>

        {/* Dải hoạt động 14 ngày */}
        <section aria-label="Hoạt động 14 ngày gần nhất">
          <p className="mb-2 text-xs text-muted-foreground">Tỉ lệ hoàn thành · 14 ngày gần nhất</p>
          <div className="flex h-12 items-end gap-1">
            {strip.map((s) => (
              <Link
                key={s.date}
                href={`/?date=${s.date}`}
                title={`${formatDateShort(s.date)}${s.percent !== null ? ` — ${s.percent}%` : ' — không có dữ liệu'}`}
                className="flex h-full flex-1 items-end overflow-hidden rounded-sm bg-muted/50 transition-colors hover:bg-muted"
              >
                <div
                  className={cn(
                    'w-full rounded-sm',
                    s.date === today ? 'bg-foreground' : 'bg-foreground/35',
                  )}
                  style={{
                    height: `${Math.max(s.percent ?? 0, s.percent !== null ? 6 : 0)}%`,
                  }}
                />
              </Link>
            ))}
          </div>
          <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
            <span>{formatDateShort(strip[0].date)}</span>
            <span>hôm nay</span>
          </div>
        </section>

        {future.length > 0 && (
          <section>
            <h2 className="mb-1 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <CalendarRange className="size-3.5" /> Việc sắp tới
            </h2>
            {future.map((d) => (
              <DayRow key={d.date} day={d} isFuture />
            ))}
          </section>
        )}

        <section>
          <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Đã qua
          </h2>
          {pastAndToday.length === 0 ? (
            <EmptyState
              icon={Clock}
              title="Chưa có dữ liệu"
              description="Bắt đầu thêm việc cho hôm nay — lịch sử sẽ dần hiện ra ở đây."
            />
          ) : (
            pastAndToday.map((d) => <DayRow key={d.date} day={d} isFuture={false} />)
          )}
        </section>
      </div>
    </div>
  );
}
