import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { suggestTomorrow, type ActivePlanContext, type SuggestContext } from '@/lib/ai';
import { daysBetween, delayDays, toDateStr, todayStr, tomorrowStr } from '@/lib/dates';
import { computePlanProgress } from '@/lib/plan';
import { computeDifficultyHints } from '@/lib/difficulty';
import { computeCapacity } from '@/lib/capacity';
import { goalAgeDays, rankGoalsForNudge } from '@/lib/queue';
import {
  blocksForDate,
  computeFreeSlots,
  softBlocksForDate,
  softLoadMinutes,
} from '@/lib/schedule';
import { getScheduleSettings } from '@/lib/schedule-settings';
import { habitDueOn } from '@/lib/habits';
import { hmToMinutes } from '@/lib/notify/time';
import type {
  CommitmentDTO,
  PlanAlert,
  ScheduleEventDTO,
  ScheduleKind,
  SoftBlockDTO,
} from '@/lib/types';

export const dynamic = 'force-dynamic';

// a "container" task (with ≥1 child) is a group, not counted toward stats/real velocity (section 11)
const NOT_CONTAINER = { subtasks: { none: {} } };

export async function POST(): Promise<NextResponse> {
  try {
    const today = todayStr();

    // the last 7 days (excluding today) to compute real velocity
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = toDateStr(weekAgo);

    // 14 days to assemble the difficulty "reference class" (section 11)
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const twoWeeksAgoStr = toDateStr(twoWeeksAgo);

    const tomorrow = tomorrowStr();

    const [
      todayTasks,
      undoneTasks,
      recentTasks,
      ratedTasks,
      note,
      plans,
      checkin,
      commitmentRows,
      softBlockRows,
      tomorrowEventRows,
      scheduleSettings,
      habitRows,
      habitCheckRows,
      incubatingGoalRows,
    ] = await Promise.all([
      prisma.task.findMany({ where: { date: today, ...NOT_CONTAINER } }),
      // unfinished tasks: all not-done tasks with a date up to today (excluding containers)
      prisma.task.findMany({
        where: { done: false, date: { lte: today }, ...NOT_CONTAINER },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.task.findMany({
        where: { date: { gte: weekAgoStr, lt: today }, ...NOT_CONTAINER },
      }),
      // tasks rated with emotion/duration ~14 days → infer difficulty + slower/faster (sections 11/14)
      prisma.task.findMany({
        where: {
          date: { gte: twoWeeksAgoStr, lte: today },
          OR: [{ emotion: { not: null } }, { actualBucket: { not: null } }],
          ...NOT_CONTAINER,
        },
        select: { title: true, emotion: true, actualBucket: true },
      }),
      prisma.dailyNote.findUnique({ where: { date: today } }),
      prisma.plan.findMany({
        where: { status: 'active' },
        include: { milestones: { orderBy: { order: 'asc' } } },
      }),
      prisma.dayCheckin.findUnique({ where: { date: today } }),
      prisma.commitment.findMany({ where: { active: true } }),
      prisma.softBlock.findMany({ where: { active: true } }),
      prisma.scheduleEvent.findMany({ where: { date: tomorrow } }),
      getScheduleSettings(),
      prisma.habit.findMany({ where: { active: true } }),
      prisma.habitCheck.findMany({
        where: { date: today },
        select: { habitId: true },
      }),
      // "Incubating" goals still in the queue (section 17) — to suggest pulling out when free
      prisma.goal.findMany({ where: { status: 'incubating' } }),
    ]);

    // Tomorrow's hard commitments → real free time (section 14)
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
    const tomorrowEvents: ScheduleEventDTO[] = tomorrowEventRows.map((e) => ({
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
    const tomorrowBlocks = blocksForDate(tomorrow, commitments, tomorrowEvents, anchor);
    // tomorrow's free slots + time budget (section 14)
    const capacity = computeFreeSlots(tomorrow, commitments, tomorrowEvents, scheduleSettings);
    // tomorrow's soft blocks → reduce the "suggested budget" + serve as preferred windows for the AI
    const tomorrowSoft = softBlocksForDate(tomorrow, softBlocks, tomorrowEvents, anchor);
    const suggestedCapacityMin = Math.max(
      0,
      capacity.capacityMin - softLoadMinutes(capacity.slots, tomorrowSoft),
    );
    // today's habits (informational) — only habits that are due
    const checkedHabitIds = new Set(habitCheckRows.map((r) => r.habitId));
    const habitsToday = habitRows
      .filter((h) => habitDueOn(h, today))
      .map((h) => ({ title: h.title, doneToday: checkedHabitIds.has(h.id) }));

    // ~7-day average: only count days that actually have tasks
    const byDate = new Map<string, { done: number; total: number }>();
    for (const t of recentTasks) {
      const d = byDate.get(t.date) ?? { done: 0, total: 0 };
      d.total += 1;
      if (t.done) d.done += 1;
      byDate.set(t.date, d);
    }
    const daysWithData = byDate.size;
    const weeklyAvg =
      daysWithData > 0
        ? {
            avgDonePerDay:
              Math.round(
                ([...byDate.values()].reduce((s, d) => s + d.done, 0) / daysWithData) * 10,
              ) / 10,
            avgPercent: Math.round(
              ([...byDate.values()].reduce((s, d) => s + (d.total ? d.done / d.total : 0), 0) /
                daysWithData) *
                100,
            ),
            daysWithData,
          }
        : null;

    const doneToday = todayTasks
      .filter((t) => t.done)
      .map((t) => ({ title: t.title, emotion: t.emotion }));

    // Active plans + dynamic progress → context for the model to feed the next task
    const progressById = new Map(
      plans.map((p) => [p.id, computePlanProgress(p, p.milestones, today)]),
    );
    const activePlans: ActivePlanContext[] = plans.map((p) => {
      const prog = progressById.get(p.id)!;
      const next = p.milestones.find((m) => !m.done);
      return {
        id: p.id,
        title: p.title,
        goal: p.goal,
        currentMilestone: next ? { id: next.id, title: next.title } : null,
        progressPct: prog.progressPct,
        behindDays: prog.behindDays,
        totalMilestones: prog.total,
        doneMilestones: prog.done,
      };
    });

    // dynamically derived capacity/day (section 11) — used for both ctx and ranking Incubating goals
    const capacityScore = computeCapacity(
      checkin
        ? {
            energy: checkin.energy,
            mood: checkin.mood,
            stress: checkin.stress,
            sleepHours: checkin.sleepHours,
          }
        : null,
    );

    // Incubating (section 17): rank by fit to free time + tomorrow's capacity (excluding snoozed items); cap 8 for brevity
    const incubatingGoals = rankGoalsForNudge(
      incubatingGoalRows,
      capacity.slots,
      capacityScore,
      today,
    )
      .slice(0, 8)
      .map((g) => ({ id: g.id, title: g.title, note: g.note, ageDays: goalAgeDays(g, today) }));

    const ctx: SuggestContext = {
      today,
      tomorrow,
      doneToday,
      undone: undoneTasks.map((t) => ({
        title: t.title,
        delayDays: Math.max(delayDays(t), daysBetween(t.date, today)),
        slipReason: t.slipReason,
      })),
      todayRate: { done: doneToday.length, total: todayTasks.length },
      weeklyAvg,
      note: note?.note ?? null,
      activePlans,
      // difficulty reference class (section 11): cap ~40 most recent items to keep the prompt short
      recentDone: ratedTasks.slice(-40).map((t) => ({ title: t.title, emotion: t.emotion })),
      difficultyHints: computeDifficultyHints(ratedTasks),
      // Personal OS (section 11): today's check-in + dynamic capacity
      todayCheckin: checkin
        ? {
            energy: checkin.energy,
            mood: checkin.mood,
            stress: checkin.stress,
            sleepHours: checkin.sleepHours,
          }
        : null,
      capacityScore,
      // tomorrow's hard commitments (section 14) → the AI calibrates the load to free time
      tomorrowSchedule: tomorrowBlocks.map((b) => ({
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
        kind: b.kind,
      })),
      freeMinutesTomorrow: capacity.capacityMin,
      freeSlotsTomorrow: capacity.slots,
      suggestedCapacityMin,
      preferredWindowsTomorrow: tomorrowSoft.map((b) => ({
        title: b.title,
        startTime: b.startTime,
        endTime: b.endTime,
      })),
      habitsToday,
      incubatingGoals,
    };

    const result = await suggestTomorrow(ctx);

    // TRUST BOUNDARY (section 14): reject slotStart the model placed OUTSIDE a real free slot (e.g. overlapping a hard commitment).
    // The server recomputes slots, keeping only slotStart that falls inside a slot; invalid → drop (no time set).
    const slotRanges = capacity.slots.map(
      (s) => [hmToMinutes(s.start), hmToMinutes(s.end)] as const,
    );
    const slotOk = (hm: string | undefined): boolean => {
      if (!hm) return false;
      const t = hmToMinutes(hm);
      return slotRanges.some(([s, e]) => t >= s && t < e);
    };
    for (const item of [...result.carry_over, ...result.suggested_tasks, ...result.plan_tasks]) {
      if (item.slotStart && !slotOk(item.slotStart)) item.slotStart = undefined;
    }

    // Keep only plan_tasks with a valid planId (prevent the model from fabricating ids)
    const validPlanIds = new Set(plans.map((p) => p.id));
    result.plan_tasks = result.plan_tasks.filter((t) => validPlanIds.has(t.planId));

    // TRUST BOUNDARY (section 17): keep only queue_pulls pointing at a goal still in the queue (prevent fabricated goalId)
    const validGoalIds = new Set(incubatingGoalRows.map((g) => g.id));
    result.queue_pulls = result.queue_pulls.filter((q) => validGoalIds.has(q.goalId));

    // Behind-schedule alert: computed dynamically on the server, never let the model fabricate numbers (section 10.4)
    result.plan_alerts = plans
      .map((p): PlanAlert | null => {
        const prog = progressById.get(p.id)!;
        if (prog.behindDays < 1) return null;
        return {
          planId: p.id,
          planTitle: p.title,
          behindDays: prog.behindDays,
          options: [
            `Giãn deadline thêm ~${prog.behindDays} ngày`,
            'Bỏ bớt một cột mốc chưa quan trọng',
            'Giữ nguyên và tăng tốc',
          ],
        };
      })
      .filter((a): a is PlanAlert => a !== null);

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
