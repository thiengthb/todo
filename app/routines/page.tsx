import { prisma } from '@/lib/db';
import { todayStr } from '@/lib/dates';
import { computeHabitStatus } from '@/lib/habits';
import { getScheduleSettings } from '@/lib/schedule-settings';
import { PageHeader } from '@/components/page-header';
import { HabitManager, type HabitRow } from '@/components/schedule/habit-manager';
import { ScheduleSettingsForm } from '@/components/schedule/schedule-settings-form';

/**
 * Trang "Nhịp sống" (mục giao diện, đại tu 2026-06) — gom Thói quen + Giờ thức/quỹ thời gian
 * tách khỏi /schedule. Đây là các thiết lập NỀN cho nhịp sống hằng ngày, nuôi capacity của AI.
 */
export const dynamic = 'force-dynamic';

export default async function RoutinesPage() {
  const today = todayStr();
  const [habitRows, settings] = await Promise.all([
    prisma.habit.findMany({
      orderBy: { createdAt: 'asc' },
      include: { checks: { select: { date: true } } },
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
