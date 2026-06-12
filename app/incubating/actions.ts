'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { addDays, isValidDateStr, tomorrowStr, todayStr } from '@/lib/dates';
import { createPlan, type CreatePlanInput } from '@/app/actions';

/**
 * Server actions for "Incubating" (section 17) — the queue of uncommitted goals.
 * One-tap capture; exits: drag into a Task or promote to a Plan (reusing the existing machinery); guilt-free drop.
 */

/** Capture a new goal (title only; note optional) */
export async function addGoal(title: string, note?: string): Promise<void> {
  const t = title.trim();
  if (!t) return;
  await prisma.goal.create({ data: { title: t, note: note?.trim() || null } });
  revalidatePath('/incubating');
}

export async function updateGoal(
  id: string,
  data: { title?: string; note?: string | null },
): Promise<void> {
  const patch: { title?: string; note?: string | null } = {};
  if (data.title !== undefined) {
    const t = data.title.trim();
    if (!t) return; // don't allow blanking out the title
    patch.title = t;
  }
  if (data.note !== undefined) patch.note = data.note?.trim() || null;
  await prisma.goal.update({ where: { id }, data: patch });
  revalidatePath('/incubating');
}

/** Drop (soft) — moves to the "Dropped" block, recoverable */
export async function dropGoal(id: string): Promise<void> {
  await prisma.goal.update({ where: { id }, data: { status: 'dropped' } });
  revalidatePath('/incubating');
}

export async function restoreGoal(id: string): Promise<void> {
  await prisma.goal.update({
    where: { id },
    data: { status: 'incubating', snoozedUntil: null },
  });
  revalidatePath('/incubating');
}

/** Permanently delete (from the "Dropped" block) */
export async function deleteGoal(id: string): Promise<void> {
  await prisma.goal.delete({ where: { id } });
  revalidatePath('/incubating');
}

/** Pin "want to do soon" → reset staleness + clear snooze */
export async function pinGoal(id: string, pinned: boolean): Promise<void> {
  await prisma.goal.update({
    where: { id },
    data: { pinned, ...(pinned ? { snoozedUntil: null } : {}) },
  });
  revalidatePath('/incubating');
}

/** Snooze the reminder/stale-prompt by n days (default 30) — compassion, not deletion */
export async function snoozeGoal(id: string, days = 30): Promise<void> {
  const until = addDays(todayStr(), Math.max(1, days));
  await prisma.goal.update({ where: { id }, data: { snoozedUntil: until } });
  revalidatePath('/incubating');
}

/**
 * Drag a goal into a day → create a Task (small task). Mark the goal `promoted` + traceable.
 * The task appears on Today/History like any normal task; the goal leaves the queue.
 */
export async function promoteGoalToTask(
  id: string,
  opts: { date: string; estimatedMinutes?: number | null; deepWork?: boolean },
): Promise<void> {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.status !== 'incubating') return;

  const date = isValidDateStr(opts.date) ? opts.date : tomorrowStr();
  const task = await prisma.task.create({
    data: {
      title: goal.title,
      date,
      estimatedMinutes:
        opts.estimatedMinutes && opts.estimatedMinutes > 0
          ? Math.min(600, Math.round(opts.estimatedMinutes))
          : null,
      deepWork: opts.deepWork === true,
    },
  });

  await prisma.goal.update({
    where: { id },
    data: { status: 'promoted', promotedTaskId: task.id },
  });
  revalidatePath('/incubating');
  revalidatePath('/', 'layout');
}

/**
 * Promote a goal to a Plan (big, multi-step work) — reuses `createPlan` (section 10), does NOT
 * spawn a separate flow. Mark the goal `promoted` + traceable. Returns the planId for navigation.
 */
export async function promoteGoalToPlan(id: string, input: CreatePlanInput): Promise<string> {
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.status !== 'incubating') {
    throw new Error('Mục tiêu không còn trong hàng đợi');
  }
  const planId = await createPlan(input);
  await prisma.goal.update({
    where: { id },
    data: { status: 'promoted', promotedPlanId: planId },
  });
  revalidatePath('/incubating');
  return planId;
}
