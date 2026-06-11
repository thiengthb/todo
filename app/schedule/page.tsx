import { prisma } from '@/lib/db';
import {
  addDays,
  formatDateShort,
  isValidDateStr,
  mondayOf,
  todayStr,
  weekdayShortVN,
} from '@/lib/dates';
import { blocksForDate, computeFreeSlots, softBlocksForDate } from '@/lib/schedule';
import { getScheduleSettings } from '@/lib/schedule-settings';
import { PageHeader } from '@/components/page-header';
import { WeekView, type DayColumn } from '@/components/schedule/week-view';
import type {
  CommitmentDTO,
  FreeSlot,
  ScheduleBlock,
  ScheduleEventDTO,
  ScheduleKind,
  SoftBlockDTO,
} from '@/lib/types';

/** focus → khac (ScheduleKind chỉ có hoc/lam/khac) */
function toScheduleKind(k: string): ScheduleKind {
  return k === 'hoc' || k === 'lam' ? k : 'khac';
}

/** Sắp khối theo giờ; khối cả ngày (null) lên đầu — "HH:MM" so lexical = thời gian */
function byStart(a: ScheduleBlock, b: ScheduleBlock): number {
  if (a.startTime === b.startTime) return 0;
  if (a.startTime === null) return -1;
  if (b.startTime === null) return 1;
  return a.startTime.localeCompare(b.startTime);
}

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ start?: string }>;
}

export default async function SchedulePage({ searchParams }: PageProps) {
  const { start: raw } = await searchParams;
  const today = todayStr();
  const weekStart = mondayOf(raw && isValidDateStr(raw) ? raw : today);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = dates[6];

  const [commitmentRows, softBlockRows, eventRows, settings] = await Promise.all([
    prisma.commitment.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.softBlock.findMany({
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    }),
    prisma.scheduleEvent.findMany({
      where: { date: { gte: weekStart, lte: weekEnd } },
      orderBy: { date: 'asc' },
    }),
    getScheduleSettings(),
  ]);

  const commitments: CommitmentDTO[] = commitmentRows.map((c) => ({
    id: c.id,
    title: c.title,
    dayOfWeek: c.dayOfWeek,
    startTime: c.startTime,
    endTime: c.endTime,
    kind: c.kind as ScheduleKind,
    active: c.active,
    validFrom: c.validFrom,
    validUntil: c.validUntil,
    weekParity: c.weekParity,
  }));
  const softBlocks: SoftBlockDTO[] = softBlockRows.map((s) => ({
    id: s.id,
    title: s.title,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    kind: toScheduleKind(s.kind),
    active: s.active,
    validFrom: s.validFrom,
    validUntil: s.validUntil,
    weekParity: s.weekParity,
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

  const freeSlotsByDate: Record<string, FreeSlot[]> = {};
  const days: DayColumn[] = dates.map((date) => {
    const cap = computeFreeSlots(date, commitments, events, settings);
    freeSlotsByDate[date] = cap.slots;
    return {
      date,
      dow: new Date(`${date}T00:00:00`).getDay(),
      label: weekdayShortVN(new Date(`${date}T00:00:00`).getDay()),
      dateShort: formatDateShort(date),
      isToday: date === today,
      // lưới hiển thị cả lịch cứng + khung mềm (soft); quỹ rảnh chỉ tính lịch cứng
      blocks: [
        ...blocksForDate(date, commitments, events, settings.termAnchorMonday),
        ...softBlocksForDate(date, softBlocks, events, settings.termAnchorMonday),
      ].sort(byStart),
      freeMin: cap.capacityMin,
    };
  });

  return (
    <div className="py-8">
      <PageHeader
        eyebrow="Lịch trình"
        title="Lịch tuần"
        info="Lịch cứng (học, làm), khung tập trung và việc đột xuất. Đây là bối cảnh để AI biết quỹ giờ rảnh thật của bạn và đề xuất việc vừa sức — lịch không phải việc cần làm nên không tính vào chuỗi hay thống kê."
      />
      <div className="space-y-10">
        <WeekView
          weekStart={weekStart}
          prevStart={addDays(weekStart, -7)}
          nextStart={addDays(weekStart, 7)}
          thisStart={mondayOf(today)}
          days={days}
          commitments={commitments}
          softBlocks={softBlocks}
          events={events}
          wake={settings.wakeTime}
          sleep={settings.sleepTime}
          freeSlotsByDate={freeSlotsByDate}
        />
      </div>
    </div>
  );
}
