import Link from 'next/link';
import { CalendarRange, ChevronRight, Clock, Flame, TrendingDown, TrendingUp } from 'lucide-react';
import { prisma } from '@/lib/db';
import { addDays, formatDateShort, todayStr } from '@/lib/dates';
import { computeStreaks } from '@/lib/streak';
import { getActiveDoneDates } from '@/lib/streaks-query';
import { cn } from '@/lib/utils';
import { PageHeader } from '@/components/page-header';
import { EmptyState } from '@/components/empty-state';
import { ProgressBar } from '@/components/ui/progress-bar';
import { DayRow, type DaySummary } from '@/components/history/day-row';

export const dynamic = 'force-dynamic';

// The "looking back" list is bounded to the last ~6 months so the query stays cheap as history grows.
// The streak (current/longest) is computed from the FULL set of done-dates (getActiveDoneDates), not this window.
const HISTORY_WINDOW_DAYS = 180;

/** Avg tasks done per day-with-data over the last `windowDays` — same definition as lib/velocity. */
function paceOver(
  days: DaySummary[],
  today: string,
  windowDays: number,
): { avg: number; n: number } {
  const since = addDays(today, -(windowDays - 1));
  const win = days.filter((d) => d.date >= since && d.date <= today && d.total > 0);
  if (win.length === 0) return { avg: 0, n: 0 };
  const totalDone = win.reduce((s, d) => s + d.done, 0);
  return { avg: Math.round((totalDone / win.length) * 10) / 10, n: win.length };
}

/** Bucket a completion % into a semantic fill color (the 14-day heatmap). */
function stripColor(percent: number): string {
  if (percent >= 80) return 'var(--ok)';
  if (percent >= 40) return 'var(--warn)';
  return 'var(--alert)';
}

export default async function HistoryPage() {
  const today = todayStr();
  const since = addDays(today, -HISTORY_WINDOW_DAYS);
  const [tasks, notes, doneDates] = await Promise.all([
    prisma.task.findMany({
      where: { date: { gte: since } },
      orderBy: { date: 'asc' },
      select: { date: true, done: true, emotion: true, title: true },
    }),
    prisma.dailyNote.findMany({
      where: { date: { gte: since } },
      select: { date: true, note: true },
    }),
    getActiveDoneDates(),
  ]);
  const noteByDate = new Map(notes.map((n) => [n.date, n.note]));

  // Group by date
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

  const future = days.filter((d) => d.date > today); // already asc per query
  const pastAndToday = days.filter((d) => d.date <= today).reverse(); // most recent first

  // Streak — from the FULL set of done-dates (not the 180d window) so longest stays correct
  const streak = computeStreaks(doneDates, today);

  // Activity strip for the last 14 days (ending today)
  const strip = Array.from({ length: 14 }, (_, i) => {
    const date = addDays(today, i - 13);
    const day = days.find((d) => d.date === date);
    return { date, percent: day?.percent ?? null };
  });

  // Real pace (avg done / active day) — recent vs the wider trend
  const pace7 = paceOver(days, today, 7);
  const pace30 = paceOver(days, today, 30);
  const paceUp = pace7.avg > pace30.avg;

  return (
    <div className="py-8">
      <PageHeader eyebrow="Toàn cảnh các ngày" title="Lịch sử" />

      <div className="space-y-10">
        {/* Chuỗi giữ lửa */}
        <section aria-label="Chuỗi giữ lửa">
          <h2 className="mb-3 flex items-center gap-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            <Flame className="size-3.5" /> Chuỗi giữ lửa
          </h2>
          {/* current vs longest on one shared scale — the gap is visible at a glance */}
          <div className="mb-4 rounded-lg border border-border/70 p-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">
                  Hiện tại{streak.atRisk && ' · đang treo'}
                </p>
                <p className="flex items-baseline gap-1.5 text-2xl font-semibold tracking-tight tabular-nums">
                  {streak.current > 0 && (
                    <Flame
                      className={cn(
                        'size-5 self-center',
                        streak.atRisk ? 'text-muted-foreground' : 'text-warn',
                      )}
                    />
                  )}
                  {streak.current}
                  <span className="text-sm font-normal text-muted-foreground">ngày</span>
                </p>
              </div>
              <p className="text-right text-xs text-muted-foreground">
                Kỷ lục
                <br />
                <span className="text-base font-medium text-foreground tabular-nums">
                  {streak.longest} ngày
                </span>
              </p>
            </div>
            {streak.longest > 0 && (
              <ProgressBar
                className="mt-3"
                value={(streak.current / streak.longest) * 100}
                tone={streak.atRisk ? 'warn' : 'ok'}
                label={`Chuỗi hiện tại ${streak.current} trên kỷ lục ${streak.longest} ngày`}
              />
            )}
            {streak.current > 0 && streak.current >= streak.longest && (
              <p className="mt-1.5 text-[11px] font-medium text-ok">Đang ở mức kỷ lục! 🔥</p>
            )}
          </div>

          {streak.runs.length === 0 ? (
            <EmptyState
              icon={Flame}
              title="Chưa có chuỗi nào"
              description="Hoàn thành 1 việc mỗi ngày để nhóm lửa — lỡ một ngày vẫn được ân hạn."
              className="py-10"
            />
          ) : (
            // Collapsed streak runs — avoid repeating the streak too much (UI section)
            <details className="group">
              <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground">
                <ChevronRight className="size-3.5 transition-transform group-open:rotate-90" />
                Xem {streak.runs.length} đợt giữ lửa
              </summary>
              <ul className="mt-1">
                {streak.runs.map((run, i) => {
                  // the most recent run (i===0) is live when current>0
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
                          <span className="flex items-center gap-1 text-xs text-warn">
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

        {/* Dải hoạt động 14 ngày — heatmap theo tỉ lệ; ngày không có việc khác hẳn ngày 0% */}
        <section aria-label="Hoạt động 14 ngày gần nhất">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">Tỉ lệ hoàn thành · 14 ngày gần nhất</p>
            {pace7.n > 0 && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                {paceUp ? (
                  <TrendingUp className="size-3.5 text-ok" />
                ) : (
                  <TrendingDown className="size-3.5 text-muted-foreground" />
                )}
                <span className="tabular-nums">
                  ~<span className="font-medium text-foreground">{pace7.avg}</span> việc/ngày
                </span>
                {pace30.n > 0 && (
                  <span className="text-muted-foreground/70">· 30d {pace30.avg}</span>
                )}
              </p>
            )}
          </div>
          <div className="flex h-12 items-end gap-1">
            {strip.map((s) => {
              const hasData = s.percent !== null;
              const isToday = s.date === today;
              return (
                <Link
                  key={s.date}
                  href={`/?date=${s.date}`}
                  aria-label={`${formatDateShort(s.date)}${hasData ? ` — ${s.percent}% hoàn thành` : ' — không có việc'}`}
                  className={cn(
                    'flex h-full flex-1 items-end overflow-hidden rounded-sm transition-colors',
                    hasData ? 'bg-muted/50 hover:bg-muted' : 'bg-muted/20 hover:bg-muted/40',
                    isToday && 'ring-1 ring-foreground/40',
                  )}
                >
                  {hasData && (
                    <div
                      className="w-full rounded-sm"
                      style={{
                        height: `${Math.max(s.percent ?? 0, 6)}%`,
                        background: stripColor(s.percent ?? 0),
                      }}
                    />
                  )}
                </Link>
              );
            })}
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
