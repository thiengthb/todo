import { prisma } from '@/lib/db';
import { addDays, todayStr } from '@/lib/dates';
import { computeHabitStatus } from '@/lib/habits';
import { getScheduleSettings } from '@/lib/schedule-settings';
import { PageHeader } from '@/components/page-header';
import { HabitManager, type HabitRow } from '@/components/schedule/habit-manager';
import { ScheduleSettingsForm } from '@/components/schedule/schedule-settings-form';

/**
 * "Routines" page (UI section, 2026-06 overhaul) — groups Habits + Wake hours/time budget,
 * split out from /schedule. These are the FOUNDATIONAL settings for the daily rhythm, feeding the AI's capacity.
 */
export const dynamic = 'force-dynamic';

export default async function RoutinesPage() {
  const today = todayStr();
  const [habitRows, settings] = await Promise.all([
    prisma.habit.findMany({
      orderBy: { createdAt: 'asc' },
      // computeHabitStatus only looks back 366d — don't load every check ever recorded
      include: {
        checks: { where: { date: { gte: addDays(today, -366) } }, select: { date: true } },
      },
    }),
    getScheduleSettings(),
  ]);

  const habits: HabitRow[] = habitRows.map((h) => ({
    id: h.id,
    title: h.title,
    daysOfWeek: h.daysOfWeek,
    active: h.active,
    streak: computeHabitStatus(
      h,
      h.checks.map((c) => c.date),
      today,
    ).streak,
  }));

  return (
    <div className="py-8">
      <PageHeader
        eyebrow="Cài đặt"
        title="Nhịp sống"
        info={
          <>
            Thói quen lặp lại và quỹ thời gian thật mỗi ngày. Đây là{' '}
            <strong className="font-medium text-foreground">nền</strong> để AI đề xuất việc vừa sức
            — không phải việc cần làm, nên không tính vào chuỗi hay thống kê.
          </>
        }
      />
      <div className="space-y-10">
        <HabitManager habits={habits} />
        <ScheduleSettingsForm initial={settings} />
      </div>
    </div>
  );
}
