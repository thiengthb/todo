import { prisma } from '@/lib/db';
import { addDays, dayLabel, delayDays, formatDateVN, isValidDateStr, todayStr } from '@/lib/dates';
import { DayNav } from '@/components/day-nav';
import { pickMitId } from '@/lib/priority';
import { buildReflection } from '@/lib/reflection';
import { computeStreaks } from '@/lib/streak';
import { computeVelocity } from '@/lib/velocity';
import { computeDifficultyHints } from '@/lib/difficulty';
import { computePlanProgress } from '@/lib/plan';
import { computeCapacity } from '@/lib/capacity';
import { estimateGoalSize, rankGoalsForNudge } from '@/lib/queue';
import { habitDueOn } from '@/lib/habits';
import type {
  CommitmentDTO,
  Emotion,
  Priority,
  ScheduleEventDTO,
  ScheduleKind,
  SoftBlockDTO,
  TaskDTO,
} from '@/lib/types';
import { AddTask } from '@/components/today/add-task';
import { CheckinBox } from '@/components/today/checkin-box';
import { NoteBox } from '@/components/today/note-box';
import { StatsCards } from '@/components/today/stats-cards';
import { SuggestSheet } from '@/components/today/suggest-sheet';
import { TaskItem } from '@/components/today/task-item';
import { ScheduleStrip } from '@/components/today/schedule-strip';
import { StreakBanner } from '@/components/today/streak-banner';
import { PlanMomentum } from '@/components/today/plan-momentum';
import { IncubatingNudge } from '@/components/today/incubating-nudge';
import { HabitStrip } from '@/components/today/habit-strip';
import { FocusBar } from '@/components/today/focus-bar';
import { DayTimeline } from '@/components/today/day-timeline';
import { EmptyState } from '@/components/empty-state';
import { ListTodo } from 'lucide-react';
import { blocksForDate, computeFreeSlots, softBlocksForDate } from '@/lib/schedule';
import { getScheduleSettings } from '@/lib/schedule-settings';
import { toHm } from '@/lib/notify/time';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ date?: string; view?: string }>;
}

export default async function DayPage({ searchParams }: PageProps) {
  const { date: raw, view: rawView } = await searchParams;
  const today = todayStr();
  const date = raw && isValidDateStr(raw) ? raw : today;
  // lexical comparison of ISO strings = time comparison
  const isToday = date === today;
  const isPast = date < today;

  const [
    tasks,
    dailyNote,
    checkin,
    recentDone7,
    commitmentRows,
    eventRows,
    softBlockRows,
    scheduleSettings,
    activeDayRows,
    weekTaskRows,
    ratedRows,
    activePlanRows,
    habitRows,
    habitCheckRows,
    incubatingGoalRows,
  ] = await Promise.all([
    // only fetch the day's root tasks; child tasks (broken down) live in subtasks (section 11)
    prisma.task.findMany({
      where: { date, parentId: null },
      orderBy: { createdAt: 'asc' },
      include: {
        plan: { select: { title: true } },
        subtasks: {
          orderBy: { createdAt: 'asc' },
          include: { plan: { select: { title: true } } },
        },
      },
    }),
    prisma.dailyNote.findUnique({ where: { date } }),
    // check-in only needed for today (Personal OS, section 11)
    isToday ? prisma.dayCheckin.findUnique({ where: { date } }) : Promise.resolve(null),
    // tasks done in the last 7 days (excluding containers) to reflect identity (section 11)
    isToday
      ? prisma.task.findMany({
          where: {
            done: true,
            date: { gte: addDays(today, -6), lte: today },
            subtasks: { none: {} },
          },
          select: { date: true, emotion: true },
        })
      : Promise.resolve([]),
    // schedule (section 14): active commitments + events of the viewed day + soft blocks + settings
    prisma.commitment.findMany({ where: { active: true } }),
    prisma.scheduleEvent.findMany({ where: { date } }),
    prisma.softBlock.findMany({ where: { active: true } }),
    getScheduleSettings(),
    // the "smart" signals — only needed for today (sections 11/12)
    // "active" days → compute streak (banner reminds when about to break)
    isToday
      ? prisma.task.findMany({
          where: { done: true },
          select: { date: true },
          distinct: ['date'],
        })
      : Promise.resolve([]),
    // leaf tasks ~last 7 days → real velocity (matches weeklyAvg of /api/suggest)
    isToday
      ? prisma.task.findMany({
          where: {
            date: { gte: addDays(today, -7), lt: today },
            subtasks: { none: {} },
          },
          select: { date: true, done: true },
        })
      : Promise.resolve([]),
    // leaf tasks rated with an emotion ~14 days → infer "often tiring" topics (difficulty hints)
    isToday
      ? prisma.task.findMany({
          where: {
            date: { gte: addDays(today, -13), lte: today },
            emotion: { not: null },
            subtasks: { none: {} },
          },
          select: { title: true, emotion: true },
        })
      : Promise.resolve([]),
    // active plans → momentum card + dynamic progress
    isToday
      ? prisma.plan.findMany({
          where: { status: 'active' },
          include: { milestones: { orderBy: { order: 'asc' } } },
        })
      : Promise.resolve([]),
    // active habits + today's ticks (section 11) — only for today
    isToday ? prisma.habit.findMany({ where: { active: true } }) : Promise.resolve([]),
    isToday
      ? prisma.habitCheck.findMany({
          where: { date },
          select: { habitId: true },
        })
      : Promise.resolve([]),
    // "Incubating" goals still in the queue (section 17) — to suggest pulling out when free
    isToday ? prisma.goal.findMany({ where: { status: 'incubating' } }) : Promise.resolve([]),
  ]);

  // the viewed day's hard-schedule strip (read-only) + dynamic free time
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
  const scheduleEvents: ScheduleEventDTO[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    kind: e.kind as ScheduleKind,
    cancels: e.cancels,
  }));
  const softBlocks: SoftBlockDTO[] = softBlockRows.map((s) => ({
    id: s.id,
    title: s.title,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    kind: (['hoc', 'lam', 'khac'].includes(s.kind) ? s.kind : 'khac') as ScheduleKind,
    active: s.active,
    validFrom: s.validFrom,
    validUntil: s.validUntil,
    weekParity: s.weekParity,
  }));
  const anchor = scheduleSettings.termAnchorMonday;
  // free slots + dynamic free time (section 14) for the viewed day
  const capacity = computeFreeSlots(date, commitments, scheduleEvents, scheduleSettings);
  const scheduleFree = capacity.capacityMin;
  // display blocks: hard commitments + soft blocks (for the chip strip + timeline)
  const scheduleBlocks = [
    ...blocksForDate(date, commitments, scheduleEvents, anchor),
    ...softBlocksForDate(date, softBlocks, scheduleEvents, anchor),
  ].sort((a, b) => {
    if (a.startTime === b.startTime) return 0;
    if (a.startTime === null) return -1;
    if (b.startTime === null) return 1;
    return a.startTime.localeCompare(b.startTime);
  });

  const dtos: TaskDTO[] = tasks.map((t) => {
    const subtasks: TaskDTO[] = t.subtasks.map((c) => ({
      id: c.id,
      title: c.title,
      done: c.done,
      emotion: c.emotion as Emotion | null,
      delay: c.done || isPast ? 0 : delayDays(c),
      planTitle: c.plan?.title ?? null,
      cue: c.cue,
      impact: c.impact as Priority | null,
      slipReason: c.slipReason,
      estimatedMinutes: c.estimatedMinutes,
      deepWork: c.deepWork,
      actualBucket: c.actualBucket,
      scheduledFor: c.scheduledFor ? toHm(c.scheduledFor) : null,
    }));
    const isContainer = subtasks.length > 0;
    return {
      id: t.id,
      title: t.title,
      // "container" parent task: done = all child steps done; no emotion rating / no delay badge
      done: isContainer ? subtasks.every((s) => s.done) : t.done,
      emotion: isContainer ? null : (t.emotion as Emotion | null),
      delay: isContainer || t.done || isPast ? 0 : delayDays(t),
      planTitle: t.plan?.title ?? null,
      subtasks: isContainer ? subtasks : undefined,
      cue: t.cue,
      impact: t.impact as Priority | null,
      slipReason: t.slipReason,
      estimatedMinutes: t.estimatedMinutes,
      deepWork: t.deepWork,
      actualBucket: t.actualBucket,
      scheduledFor: t.scheduledFor ? toHm(t.scheduledFor) : null,
    };
  });

  // stats count real tasks (child steps + single tasks), skipping containers — section 11
  const leaves = dtos.flatMap((t) => t.subtasks ?? [t]);
  const doneCount = leaves.filter((t) => t.done).length;
  // today's "main task" (MIT, 80/20) — only highlights it, does not reorder
  const mitId = isToday ? pickMitId(leaves) : null;

  // identity reflection + informational feedback (section 11) — inferred from the last 7 days
  const reflection = isToday
    ? buildReflection({
        activeDays7: new Set(recentDone7.map((t) => t.date)).size,
        hardDone7: recentDone7.filter((t) => t.emotion === 'hard').length,
        done7: recentDone7.length,
      })
    : null;

  // Other "smart" signals (today only) — each one self-hides when data is missing (sections 11/12)
  const streak = isToday
    ? computeStreaks(
        activeDayRows.map((r) => r.date),
        today,
      )
    : null;
  const velocity = isToday ? computeVelocity(weekTaskRows) : null;
  const hardTopics = isToday ? computeDifficultyHints(ratedRows).hardTopics : [];
  const planMomentum = isToday
    ? activePlanRows.map((p) => {
        const prog = computePlanProgress(p, p.milestones, today);
        return {
          id: p.id,
          title: p.title,
          currentMilestone: prog.currentMilestone,
          progressPct: prog.progressPct,
          behindDays: prog.behindDays,
        };
      })
    : [];
  // streak reminder banner: only when the streak is about to break AND nothing is done today
  const showStreakBanner = isToday && !!streak?.atRisk && doneCount === 0;

  // habits due today (section 11) — one tap, no points
  const checkedHabitIds = new Set(habitCheckRows.map((r) => r.habitId));
  const todayHabits = isToday
    ? habitRows
        .filter((h) => habitDueOn(h, today))
        .map((h) => ({
          id: h.id,
          title: h.title,
          doneToday: checkedHabitIds.has(h.id),
        }))
    : [];

  // Incubating (section 17): when free time is high & there are queued items → gently suggest pulling one out
  const nudgeCapacity = isToday
    ? computeCapacity(
        checkin
          ? {
              energy: checkin.energy,
              mood: checkin.mood,
              stress: checkin.stress,
              sleepHours: checkin.sleepHours,
            }
          : null,
      )
    : null;
  const rankedGoals = isToday
    ? rankGoalsForNudge(incubatingGoalRows, capacity.slots, nudgeCapacity, today)
    : [];
  const topNudgeGoal =
    rankedGoals.length > 0 && scheduleFree >= 90
      ? {
          id: rankedGoals[0].id,
          title: rankedGoals[0].title,
          approach: (estimateGoalSize(rankedGoals[0]) === 'large' ? 'plan' : 'task') as
            | 'task'
            | 'plan',
        }
      : null;

  // ── Timeline (section 14): split scheduled vs unscheduled tasks; pick the view mode ──
  const timelineTasks = dtos.filter((t) => !t.subtasks && t.scheduledFor);
  const unscheduledTasks = dtos.filter((t) => t.subtasks || !t.scheduledFor);
  // total estimate of unfinished tasks (for the overload warning)
  const plannedMin = leaves
    .filter((t) => !t.done && t.estimatedMinutes)
    .reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0);
  // default: has schedule/scheduled-task data → timeline; past → force list
  const hasTimelineData = scheduleBlocks.length > 0 || timelineTasks.length > 0;
  const view: 'list' | 'timeline' = isPast
    ? 'list'
    : rawView === 'list' || rawView === 'timeline'
      ? rawView
      : hasTimelineData
        ? 'timeline'
        : 'list';

  return (
    <div className="py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground capitalize">{formatDateVN(date)}</p>
          <h1 className="mt-1 text-xl font-semibold tracking-tight capitalize sm:text-2xl">
            {dayLabel(date)}
          </h1>
          {/* phản chiếu danh tính — feedback thông tin, không điểm số (mục 11) */}
          {reflection && <p className="mt-2 text-xs text-muted-foreground">{reflection}</p>}
        </div>
        <DayNav date={date} today={today} />
      </header>

      {/* Nhắc giữ lửa khi chuỗi sắp đứt (mục 11) — full-width trên dashboard */}
      {showStreakBanner && streak && <StreakBanner current={streak.current} />}

      {/* Dashboard 2 cột: việc (trái) · thống kê/check-in/đề xuất (phải) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section aria-label="Danh sách việc" className="min-w-0">
          {/* thanh tiêu điểm: quỹ giờ + toggle Danh sách/Dòng giờ (gộp 2 dải cũ) */}
          {!isPast && (
            <FocusBar
              date={date}
              view={view}
              freeMin={scheduleFree}
              slotCount={capacity.slots.length}
              plannedMin={plannedMin}
            />
          )}
          {/* dải chip lịch chỉ ở chế độ Danh sách (timeline đã vẽ khối) */}
          {view === 'list' && <ScheduleStrip blocks={scheduleBlocks} />}
          {isToday && <HabitStrip habits={todayHabits} />}

          {view === 'timeline' && !isPast ? (
            <>
              <DayTimeline
                isToday={isToday}
                wake={scheduleSettings.wakeTime}
                sleep={scheduleSettings.sleepTime}
                blocks={scheduleBlocks}
                freeSlots={capacity.slots}
                tasks={timelineTasks}
                mitId={mitId}
              />
              {unscheduledTasks.length > 0 && (
                <div className="mt-6">
                  <p className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    Chưa xếp giờ ({unscheduledTasks.length})
                  </p>
                  {unscheduledTasks.map((t) => (
                    <TaskItem key={t.id} task={t} mitId={mitId} freeSlots={capacity.slots} />
                  ))}
                </div>
              )}
            </>
          ) : dtos.length === 0 ? (
            <EmptyState
              icon={ListTodo}
              title={
                isPast
                  ? 'Ngày này không có việc nào'
                  : isToday
                    ? 'Chưa có việc nào hôm nay'
                    : 'Chưa có kế hoạch cho ngày này'
              }
              description={isPast ? undefined : 'Thêm việc đầu tiên ở ô bên dưới.'}
              className="py-10"
            />
          ) : (
            <div>
              {dtos.map((t) => (
                <TaskItem key={t.id} task={t} mitId={mitId} />
              ))}
            </div>
          )}
          {/* Quá khứ chỉ để quan sát — không thêm việc ngược thời gian */}
          {!isPast && (
            <div className="mt-1">
              <AddTask date={date} isToday={isToday} hardTopics={hardTopics} />
            </div>
          )}

          {/* Ghi chú nằm CUỐI cột việc → thẳng hàng đúng bằng các thanh todo phía trên */}
          {isToday && (
            <div className="mt-6">
              <NoteBox initialNote={dailyNote?.note ?? ''} />
            </div>
          )}

          {isPast && dailyNote?.note && (
            <div className="mt-6">
              <p className="mb-2 text-sm font-medium">Ghi chú của ngày này</p>
              <blockquote className="rounded-lg border border-border/70 bg-muted/40 p-4 text-sm text-muted-foreground italic">
                “{dailyNote.note}”
              </blockquote>
            </div>
          )}
        </section>

        <aside className="flex flex-col gap-4">
          <StatsCards done={doneCount} total={leaves.length} velocity={velocity} />
          {isToday && (
            <CheckinBox
              initial={{
                energy: checkin?.energy ?? null,
                mood: checkin?.mood ?? null,
                stress: checkin?.stress ?? null,
                sleepHours: checkin?.sleepHours ?? null,
              }}
            />
          )}
          {isToday && planMomentum.length > 0 && <PlanMomentum plans={planMomentum} />}
          {topNudgeGoal && (
            <IncubatingNudge
              goal={topNudgeGoal}
              moreCount={rankedGoals.length - 1}
              freeMin={scheduleFree}
            />
          )}
          {isToday && <SuggestSheet />}
        </aside>
      </div>
    </div>
  );
}
