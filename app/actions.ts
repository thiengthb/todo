'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { addDays, isValidDateStr, todayStr, tomorrowStr } from '@/lib/dates';
import { isValidHm } from '@/lib/notify/time';
import type { Emotion, Intensity, MilestoneDraft, PlanStatus } from '@/lib/types';

export async function addTask(title: string, date?: string): Promise<void> {
  const t = title.trim();
  if (!t) return;
  const d = date && isValidDateStr(date) ? date : todayStr();
  await prisma.task.create({ data: { title: t, date: d } });
  revalidatePath('/');
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  await prisma.task.update({
    where: { id },
    data: {
      done,
      completedAt: done ? new Date() : null,
      // unsetting done makes the emotion meaningless too
      ...(done ? {} : { emotion: null }),
    },
  });
  // "layout" so the streak chip in the menu bar (rendered in root layout) updates accordingly
  revalidatePath('/', 'layout');
}

export async function setEmotion(id: string, emotion: Emotion): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id } });
  // only rate the emotion for a done task (spec: rating an undone task is meaningless)
  if (!task?.done) return;
  await prisma.task.update({
    where: { id },
    // tapping the already-selected emotion again = deselect
    data: { emotion: task.emotion === emotion ? null : emotion },
  });
  revalidatePath('/');
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } });
  // deleting a done task can break the streak → revalidate the layout too for the menu chip
  revalidatePath('/', 'layout');
}

/** Set/clear the "when/where" cue (implementation intention, section 11) */
export async function setCue(id: string, cue: string): Promise<void> {
  const c = cue.trim();
  await prisma.task.update({ where: { id }, data: { cue: c || null } });
  revalidatePath('/');
}

/** Set the 80/20 impact level (section 11). null = clear the marker. */
export async function setImpact(
  id: string,
  impact: 'high' | 'medium' | 'low' | null,
): Promise<void> {
  await prisma.task.update({ where: { id }, data: { impact } });
  revalidatePath('/');
}

export type SlipReason = 'tired' | 'too_hard' | 'no_time' | 'unclear' | 'deprioritized';

/** Record the one-tap slip reason (section 11) — the AI learns to break down / reduce load. null = clear. */
export async function setSlipReason(id: string, reason: SlipReason | null): Promise<void> {
  await prisma.task.update({ where: { id }, data: { slipReason: reason } });
  revalidatePath('/');
}

/** Estimate the duration (minutes) — null = clear. The AI uses it to match time slots + compute overload (section 14). */
export async function setEstimate(id: string, minutes: number | null): Promise<void> {
  const m = minutes != null && minutes > 0 ? Math.min(600, Math.round(minutes)) : null;
  await prisma.task.update({ where: { id }, data: { estimatedMinutes: m } });
  revalidatePath('/');
}

/** "Deep-work task" flag → the AI prioritizes morning slots (section 14). */
export async function setDeepWork(id: string, value: boolean): Promise<void> {
  await prisma.task.update({ where: { id }, data: { deepWork: value } });
  revalidatePath('/');
}

export type ActualBucket = 'faster' | 'asExpected' | 'slower';

/** One-tap duration feedback on completion (section 14) — the AI calibrates the estimate. null = clear. */
export async function setActualBucket(id: string, bucket: ActualBucket | null): Promise<void> {
  await prisma.task.update({ where: { id }, data: { actualBucket: bucket } });
  revalidatePath('/');
}

/**
 * Add an AI suggestion to tomorrow.
 * For carry_over: find the original unfinished task (same title) to keep the carriedFrom chain —
 * the procrastination level keeps counting from the original date, no reset.
 * For plan_task: attach planId/milestoneId to show the chip + link progress.
 * For subtasks (section 11): create a "container" parent task + the child tasks (parentId);
 * the parent does not count toward stats, the children are the real tasks to tick step by step.
 */
export async function addTomorrowTask(
  title: string,
  isCarryOver: boolean,
  link?: { planId?: string | null; milestoneId?: string | null },
  subtasks?: string[],
  cue?: string | null,
  impact?: string | null,
  // scheduling (section 14) — the AI suggestion has already been server-validated
  extra?: {
    slotStart?: string | null;
    estimatedMinutes?: number | null;
    deepWork?: boolean;
  },
): Promise<void> {
  const t = title.trim();
  if (!t) return;

  let carriedFrom: string | null = null;
  if (isCarryOver) {
    const origin = await prisma.task.findFirst({
      where: { title: t, done: false, date: { lte: todayStr() } },
      orderBy: { createdAt: 'asc' },
    });
    if (origin) carriedFrom = origin.carriedFrom ?? origin.date;
  }

  const date = tomorrowStr();
  const planId = link?.planId ?? null;
  const milestoneId = link?.milestoneId ?? null;
  const steps = (subtasks ?? []).map((s) => s.trim()).filter(Boolean);
  // planned time (section 14): combine tomorrow's date + slotStart → local DateTime
  const scheduledFor =
    extra?.slotStart && isValidHm(extra.slotStart)
      ? new Date(`${date}T${extra.slotStart}:00`)
      : null;

  const parent = await prisma.task.create({
    data: {
      title: t,
      date,
      carriedFrom,
      planId,
      milestoneId,
      cue: cue?.trim() || null,
      // the suggestion's priority = an 80/20 signal → store it as impact (section 11)
      impact: impact ?? null,
      scheduledFor,
      estimatedMinutes:
        extra?.estimatedMinutes && extra.estimatedMinutes > 0
          ? Math.round(extra.estimatedMinutes)
          : null,
      deepWork: extra?.deepWork === true,
    },
  });

  // child steps inherit the plan link to feed progress; the parent becomes a container
  if (steps.length > 0) {
    await prisma.task.createMany({
      data: steps.map((s) => ({
        title: s,
        date,
        planId,
        milestoneId,
        parentId: parent.id,
      })),
    });
  }
  revalidatePath('/');
}

/** Schedule an existing task into a time slot (section 14): set scheduledFor based on the task's `date`. null = clear the time. */
export async function scheduleTaskAt(id: string, hm: string | null): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { date: true },
  });
  if (!task) return;
  const scheduledFor = hm && isValidHm(hm) ? new Date(`${task.date}T${hm}:00`) : null;
  await prisma.task.update({ where: { id }, data: { scheduledFor } });
  revalidatePath('/');
}

/** Personal OS check-in (section 11) — all optional; null clears that field. Upsert by today's date. */
export async function upsertCheckin(input: {
  energy?: number | null;
  mood?: number | null;
  stress?: number | null;
  sleepHours?: number | null;
}): Promise<void> {
  const date = todayStr();
  const data = {
    energy: input.energy ?? null,
    mood: input.mood ?? null,
    stress: input.stress ?? null,
    sleepHours: input.sleepHours ?? null,
  };
  await prisma.dayCheckin.upsert({
    where: { date },
    create: { date, ...data },
    update: data,
  });
  revalidatePath('/');
}

export async function saveNote(note: string): Promise<void> {
  const date = todayStr();
  const trimmed = note.trim();
  if (!trimmed) {
    // delete an empty note to keep the DB clean
    await prisma.dailyNote.deleteMany({ where: { date } });
  } else {
    await prisma.dailyNote.upsert({
      where: { date },
      create: { date, note: trimmed },
      update: { note: trimmed },
    });
  }
  revalidatePath('/');
}

// ---- Plans (section 10) ----

export interface CreatePlanInput {
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  intensity: Intensity;
  milestones: MilestoneDraft[];
}

/** Create a plan + roadmap milestones (previewed/edited in the dialog). Returns the id for navigation. */
export async function createPlan(input: CreatePlanInput): Promise<string> {
  const title = input.title.trim();
  const goal = input.goal.trim();
  if (!title || !goal) throw new Error('Thiếu tiêu đề hoặc mục tiêu');
  if (!isValidDateStr(input.startDate) || !isValidDateStr(input.endDate)) {
    throw new Error('Ngày không hợp lệ');
  }

  const milestones = input.milestones
    .map((m) => ({ ...m, title: m.title.trim() }))
    .filter((m) => m.title)
    .sort((a, b) => a.order - b.order)
    .map((m, i) => ({
      title: m.title,
      order: i + 1,
      targetDate: m.targetDate && isValidDateStr(m.targetDate) ? m.targetDate : null,
    }));

  const plan = await prisma.plan.create({
    data: {
      title,
      goal,
      startDate: input.startDate,
      endDate: input.endDate,
      intensity: input.intensity,
      milestones: { create: milestones },
    },
  });
  revalidatePath('/plans');
  return plan.id;
}

export async function toggleMilestone(id: string, done: boolean): Promise<void> {
  await prisma.milestone.update({ where: { id }, data: { done } });
  revalidatePath('/plans');
}

/** Drop a milestone (the "trim milestones" option when behind, section 10.4) */
export async function deleteMilestone(id: string): Promise<void> {
  await prisma.milestone.delete({ where: { id } });
  revalidatePath('/plans');
}

/** Add a milestone to the end of the roadmap */
export async function addMilestone(planId: string, title: string): Promise<void> {
  const t = title.trim();
  if (!t) return;
  const last = await prisma.milestone.findFirst({
    where: { planId },
    orderBy: { order: 'desc' },
  });
  await prisma.milestone.create({
    data: { planId, title: t, order: (last?.order ?? 0) + 1 },
  });
  revalidatePath('/plans');
}

export async function setPlanStatus(id: string, status: PlanStatus): Promise<void> {
  await prisma.plan.update({ where: { id }, data: { status } });
  revalidatePath('/plans');
}

/** Extend the plan deadline by n days (an option when behind schedule, section 10.4) */
export async function extendPlanDeadline(id: string, days: number): Promise<void> {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) return;
  await prisma.plan.update({
    where: { id },
    data: { endDate: addDays(plan.endDate, Math.max(1, days)) },
  });
  revalidatePath('/plans');
}

export async function deletePlan(id: string): Promise<void> {
  // unlink from tasks first (onDelete: SetNull handles this, but make the intent explicit)
  await prisma.plan.delete({ where: { id } });
  revalidatePath('/plans');
}
