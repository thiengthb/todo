import { prisma } from "@/lib/db";
import {
  addDays,
  formatDateShort,
  isValidDateStr,
  mondayOf,
  todayStr,
  weekdayShortVN,
} from "@/lib/dates";
import { blocksForDate, freeMinutes } from "@/lib/schedule";
import { PageHeader } from "@/components/page-header";
import { WeekView, type DayColumn } from "@/components/schedule/week-view";
import type {
  CommitmentDTO,
  ScheduleEventDTO,
  ScheduleKind,
} from "@/lib/types";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ start?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { start: raw } = await searchParams;
  const today = todayStr();
  const weekStart = mondayOf(raw && isValidDateStr(raw) ? raw : today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = dates[6];

  const [commitmentRows, eventRows] = await Promise.all([
    prisma.commitment.findMany({ orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }] }),
    prisma.scheduleEvent.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  const commitments: CommitmentDTO[] = commitmentRows.map((c) => ({
    id: c.id,
    title: c.title,
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    endTime: c.endTime,
    kind: c.kind as ScheduleKind,
    active: c.active,
  }));
  const events: ScheduleEventDTO[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    kind: e.kind as ScheduleKind,
    cancels: e.cancels,
  }));

  const days: DayColumn[] = dates.map((date) => ({
    date,
    dow: new Date(`${date}T00:00:00`).getDay(),
    label: weekdayShortVN(new Date(`${date}T00:00:00`).getDay()),
    dateShort: formatDateShort(date),
    isToday: date === today,
    blocks: blocksForDate(date, commitments, events),
    freeMin: freeMinutes(date, commitments, events),
  }));

  return (
    <div className="py-8">
      <PageHeader
        eyebrow="Lịch trình"
        title="Lịch tuần"
        description="Lịch cứng (học, làm) và việc đột xuất. Đây là bối cảnh để AI biết quỹ giờ rảnh thật của bạn và đề xuất việc vừa sức — lịch không phải việc cần làm nên không tính vào chuỗi hay thống kê."
      />
      <WeekView
        weekStart={weekStart}
        prevStart={addDays(weekStart, -7)}
        nextStart={addDays(weekStart, 7)}
        thisStart={mondayOf(today)}
        days={days}
        commitments={commitments}
        events={events}
      />
    </div>
  );
}
