'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { addDays, isValidDateStr, tomorrowStr, todayStr } from '@/lib/dates';
import { createPlan, type CreatePlanInput } from '@/app/actions';

/**
 * Server actions cho "Ấp ủ" (mục 17) — hàng đợi mục tiêu chưa cam kết.
 * Bắt giữ 1 chạm; ngõ ra: kéo thành Task hoặc nâng thành Plan (tái dùng máy cũ); buông không tội lỗi.
 */

/** Bắt giữ một mục tiêu mới (chỉ cần title; note tùy chọn) */
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
    if (!t) return; // không cho xoá trắng tiêu đề
    patch.title = t;
  }
  if (data.note !== undefined) patch.note = data.note?.trim() || null;
  await prisma.goal.update({ where: { id }, data: patch });
  revalidatePath('/incubating');
}

/** Buông (soft) — vào khối "Đã buông", khôi phục được */
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

/** Xoá hẳn (từ khối "Đã buông") */
export async function deleteGoal(id: string): Promise<void> {
  await prisma.goal.delete({ where: { id } });
  revalidatePath('/incubating');
}

/** Ghim "muốn làm sớm" → reset độ-cũ + bỏ snooze */
export async function pinGoal(id: string, pinned: boolean): Promise<void> {
  await prisma.goal.update({
    where: { id },
    data: { pinned, ...(pinned ? { snoozedUntil: null } : {}) },
  });
  revalidatePath('/incubating');
}

/** Hoãn nhắc/hỏi-cũ thêm n ngày (mặc định 30) — lòng trắc ẩn, không xoá */
export async function snoozeGoal(id: string, days = 30): Promise<void> {
  const until = addDays(todayStr(), Math.max(1, days));
  await prisma.goal.update({ where: { id }, data: { snoozedUntil: until } });
  revalidatePath('/incubating');
}

/**
 * Kéo mục tiêu vào một ngày → tạo Task (việc nhỏ). Đánh dấu goal `promoted` + truy ngược.
 * Task vào trang Hôm nay/Lịch sử như mọi việc thường; goal rời hàng đợi.
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
 * Nâng mục tiêu thành Kế hoạch (việc lớn, nhiều bước) — tái dùng `createPlan` (mục 10), KHÔNG
 * đẻ luồng riêng. Đánh dấu goal `promoted` + truy ngược. Trả planId để điều hướng.
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
