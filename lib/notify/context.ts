import { prisma } from '@/lib/db';
import { computeStreaks } from '@/lib/streak';
import { computePlanProgress } from '@/lib/plan';
import { estimateGoalSize, rankGoalsForNudge } from '@/lib/queue';
import { todayStr } from '@/lib/dates';
import { blocksForDate, computeFreeSlots } from '@/lib/schedule';
import type { NotificationFacts } from '@/lib/ai';
import type { CommitmentDTO, NotificationKind, ScheduleEventDTO, ScheduleKind } from '@/lib/types';

// a "container" task (with ≥1 child) is a group, not counted in stats/streak (section 11)
const NOT_CONTAINER = { subtasks: { none: {} } };

const IMPACT_RANK: Record<string, number> = { high: 3, medium: 2, low: 1 };

/**
 * Assemble the REAL FACTS for a notification (section 13). This is the "code" part — every number/task name
 * is traceable back to the DB; the AI only writes the voice around it, making nothing up.
 */
export async function buildNotificationFacts(kind: NotificationKind): Promise<NotificationFacts> {
  const today = todayStr();

  const [todayLeaves, undoneLeaves, activeDayRows, plans, commitmentRows, eventRows, goalRows] =
    await Promise.all([
      // today's leaf tasks (excluding containers)
      prisma.task.findMany({ where: { date: today, ...NOT_CONTAINER } }),
      // tasks unfinished as of today (excluding containers) — for the nudge to ground on
      prisma.task.findMany({
        where: { done: false, date: { lte: today }, ...NOT_CONTAINER },
        orderBy: { createdAt: 'asc' },
      }),
      // days with a done task → compute the dynamic streak
      prisma.task.findMany({
        where: { done: true },
        select: { date: true },
        distinct: ['date'],
      }),
      prisma.plan.findMany({
        where: { status: 'active' },
        include: { milestones: { orderBy: { order: 'asc' } } },
      }),
      prisma.commitment.findMany({ where: { active: true } }),
      prisma.scheduleEvent.findMany({ where: { date: today } }),
      // "Incubating" goals still in the queue (section 17) — to nudge pulling one out when free
      prisma.goal.findMany({ where: { status: 'incubating' } }),
    ]);

  // today's hard schedule → free-time budget + a summary for the voice (section 14)
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
  const todayBlocks = blocksForDate(today, commitments, scheduleEvents);
  const todaySchedule = todayBlocks.map((b) =>
    b.startTime && b.endTime ? `${b.startTime}–${b.endTime} ${b.title}` : `Cả ngày ${b.title}`,
  );
  const todayCap = computeFreeSlots(today, commitments, scheduleEvents);
  const freeMinutesToday = todayCap.capacityMin;

  const streak = computeStreaks(
    activeDayRows.map((r) => r.date),
    today,
  );

  const doneToday = todayLeaves.filter((t) => t.done);

  // the "main task" (MIT): the NOT-done task with the highest impact score — prefer today's tasks,
  // and if there are none today, take from the general pool of unfinished tasks.
  const undoneToday = todayLeaves.filter((t) => !t.done);
  const mitPool = undoneToday.length > 0 ? undoneToday : undoneLeaves;
  let mit = mitPool[0] ?? null;
  for (const t of mitPool) {
    const score = (t.impact ? IMPACT_RANK[t.impact] : 0) + (t.planId ? 1 : 0);
    const bestScore = mit ? (mit.impact ? IMPACT_RANK[mit.impact] : 0) + (mit.planId ? 1 : 0) : -1;
    if (score > bestScore) mit = t;
  }

  // plans behind schedule (behindDays ≥ 1) — computed dynamically
  const behindPlans = plans
    .filter((p) => computePlanProgress(p, p.milestones, today).behindDays >= 1)
    .map((p) => p.title);

  // today's capacity if there's a check-in
  const checkin = await prisma.dayCheckin.findUnique({
    where: { date: today },
  });
  let capacityScore: number | null = null;
  if (checkin) {
    const { computeCapacity } = await import('@/lib/capacity');
    capacityScore = computeCapacity(checkin);
  }

  // Incubating (section 17): sort by fit to today's free budget + energy; the first one is the suggestion to pull out
  const rankedGoals = rankGoalsForNudge(goalRows, todayCap.slots, capacityScore, today);
  const topGoal = rankedGoals[0] ?? null;

  return {
    kind,
    streakCurrent: streak.current,
    streakAtRisk: streak.atRisk,
    doneCount: doneToday.length,
    totalCount: todayLeaves.length,
    undoneCount: undoneLeaves.length,
    mitTitle: mit?.title ?? null,
    sampleUndone: undoneLeaves.slice(0, 3).map((t) => t.title),
    behindPlans,
    capacityScore,
    todaySchedule,
    freeMinutesToday,
    incubatingCount: rankedGoals.length,
    topIncubatingGoal: topGoal?.title ?? null,
    topIncubatingGoalId: topGoal?.id ?? null,
    topIncubatingApproach: topGoal
      ? estimateGoalSize(topGoal) === 'large'
        ? 'plan'
        : 'task'
      : null,
  };
}
