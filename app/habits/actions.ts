'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { todayStr } from '@/lib/dates';

function revalidate() {
  revalidatePath('/'); // Today shows the habit strip
  revalidatePath('/routines'); // the habit management page
}

/** Normalize the weekday CSV ("1,2,3"), drop values outside 0..6; empty → null (daily) */
function normalizeDays(daysOfWeek: string | null | undefined): string | null {
  if (!daysOfWeek) return null;
  const days = [
    ...new Set(
      daysOfWeek
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6),
    ),
  ].sort((a, b) => a - b);
  return days.length > 0 ? days.join(',') : null;
}

export interface HabitInput {
  title: string;
  daysOfWeek: string | null;
}

export async function addHabit(input: HabitInput): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Cần tên thói quen' };
  await prisma.habit.create({
    data: { title, daysOfWeek: normalizeDays(input.daysOfWeek) },
  });
  revalidate();
  return { ok: true };
}

export async function updateHabit(
  id: string,
  input: HabitInput,
): Promise<{ ok: boolean; error?: string }> {
  const title = input.title.trim();
  if (!title) return { ok: false, error: 'Cần tên thói quen' };
  await prisma.habit.update({
    where: { id },
    data: { title, daysOfWeek: normalizeDays(input.daysOfWeek) },
  });
  revalidate();
  return { ok: true };
}

export async function setHabitActive(id: string, active: boolean): Promise<void> {
  await prisma.habit.update({ where: { id }, data: { active } });
  revalidate();
}

export async function deleteHabit(id: string): Promise<void> {
  await prisma.habit.delete({ where: { id } });
  revalidate();
}

/** Tick/untick a habit for TODAY — idempotent via unique (habitId, date), one tap. */
export async function toggleHabitToday(id: string): Promise<void> {
  const date = todayStr();
  const existing = await prisma.habitCheck.findUnique({
    where: { habitId_date: { habitId: id, date } },
  });
  if (existing) {
    await prisma.habitCheck.delete({ where: { id: existing.id } });
  } else {
    await prisma.habitCheck.create({ data: { habitId: id, date } });
  }
  revalidate();
}
