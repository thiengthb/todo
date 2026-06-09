"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { addDays, isValidDateStr, todayStr, tomorrowStr } from "@/lib/dates";
import type {
  Emotion,
  Intensity,
  MilestoneDraft,
  PlanStatus,
} from "@/lib/types";

export async function addTask(title: string, date?: string): Promise<void> {
  const t = title.trim();
  if (!t) return;
  const d = date && isValidDateStr(date) ? date : todayStr();
  await prisma.task.create({ data: { title: t, date: d } });
  revalidatePath("/");
}

export async function toggleTask(id: string, done: boolean): Promise<void> {
  await prisma.task.update({
    where: { id },
    data: {
      done,
      completedAt: done ? new Date() : null,
      // bỏ done thì cảm xúc cũng không còn ý nghĩa
      ...(done ? {} : { emotion: null }),
    },
  });
  // "layout" để chip streak trên thanh menu (render ở root layout) cập nhật theo
  revalidatePath("/", "layout");
}

export async function setEmotion(id: string, emotion: Emotion): Promise<void> {
  const task = await prisma.task.findUnique({ where: { id } });
  // chỉ chấm cảm xúc cho task đã xong (spec: đánh giá việc chưa làm là vô nghĩa)
  if (!task?.done) return;
  await prisma.task.update({
    where: { id },
    // chạm lại cảm xúc đang chọn = bỏ chọn
    data: { emotion: task.emotion === emotion ? null : emotion },
  });
  revalidatePath("/");
}

export async function deleteTask(id: string): Promise<void> {
  await prisma.task.delete({ where: { id } });
  // xoá task done có thể làm đứt streak → revalidate cả layout cho chip trên menu
  revalidatePath("/", "layout");
}

/**
 * Thêm một đề xuất của AI vào ngày mai.
 * Với carry_over: tìm task dở gốc (cùng title) để giữ chuỗi carriedFrom —
 * mức trì hoãn tiếp tục tính từ ngày gốc, không reset.
 * Với plan_task: gắn planId/milestoneId để hiện chip + nối tiến độ.
 * Với subtasks (mục 11): tạo task cha "container" + các task con (parentId);
 * cha không tính vào stats, con là việc thật để tick từng bước.
 */
export async function addTomorrowTask(
  title: string,
  isCarryOver: boolean,
  link?: { planId?: string | null; milestoneId?: string | null },
  subtasks?: string[],
): Promise<void> {
  const t = title.trim();
  if (!t) return;

  let carriedFrom: string | null = null;
  if (isCarryOver) {
    const origin = await prisma.task.findFirst({
      where: { title: t, done: false, date: { lte: todayStr() } },
      orderBy: { createdAt: "asc" },
    });
    if (origin) carriedFrom = origin.carriedFrom ?? origin.date;
  }

  const date = tomorrowStr();
  const planId = link?.planId ?? null;
  const milestoneId = link?.milestoneId ?? null;
  const steps = (subtasks ?? []).map((s) => s.trim()).filter(Boolean);

  const parent = await prisma.task.create({
    data: { title: t, date, carriedFrom, planId, milestoneId },
  });

  // các bước con kế thừa liên kết plan để nối tiến độ; cha thành container
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
  revalidatePath("/");
}

export async function saveNote(note: string): Promise<void> {
  const date = todayStr();
  const trimmed = note.trim();
  if (!trimmed) {
    // xoá note rỗng để DB sạch
    await prisma.dailyNote.deleteMany({ where: { date } });
  } else {
    await prisma.dailyNote.upsert({
      where: { date },
      create: { date, note: trimmed },
      update: { note: trimmed },
    });
  }
  revalidatePath("/");
}

// ---- Kế hoạch (mục 10) ----

export interface CreatePlanInput {
  title: string;
  goal: string;
  startDate: string;
  endDate: string;
  intensity: Intensity;
  milestones: MilestoneDraft[];
}

/** Tạo plan + roadmap milestone (đã xem trước/chỉnh ở dialog). Trả id để điều hướng. */
export async function createPlan(input: CreatePlanInput): Promise<string> {
  const title = input.title.trim();
  const goal = input.goal.trim();
  if (!title || !goal) throw new Error("Thiếu tiêu đề hoặc mục tiêu");
  if (!isValidDateStr(input.startDate) || !isValidDateStr(input.endDate)) {
    throw new Error("Ngày không hợp lệ");
  }

  const milestones = input.milestones
    .map((m) => ({ ...m, title: m.title.trim() }))
    .filter((m) => m.title)
    .sort((a, b) => a.order - b.order)
    .map((m, i) => ({
      title: m.title,
      order: i + 1,
      targetDate:
        m.targetDate && isValidDateStr(m.targetDate) ? m.targetDate : null,
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
  revalidatePath("/plans");
  return plan.id;
}

export async function toggleMilestone(
  id: string,
  done: boolean,
): Promise<void> {
  await prisma.milestone.update({ where: { id }, data: { done } });
  revalidatePath("/plans");
}

/** Bỏ một cột mốc (lựa chọn "bỏ bớt milestone" khi chậm, mục 10.4) */
export async function deleteMilestone(id: string): Promise<void> {
  await prisma.milestone.delete({ where: { id } });
  revalidatePath("/plans");
}

/** Thêm một cột mốc vào cuối roadmap */
export async function addMilestone(
  planId: string,
  title: string,
): Promise<void> {
  const t = title.trim();
  if (!t) return;
  const last = await prisma.milestone.findFirst({
    where: { planId },
    orderBy: { order: "desc" },
  });
  await prisma.milestone.create({
    data: { planId, title: t, order: (last?.order ?? 0) + 1 },
  });
  revalidatePath("/plans");
}

export async function setPlanStatus(
  id: string,
  status: PlanStatus,
): Promise<void> {
  await prisma.plan.update({ where: { id }, data: { status } });
  revalidatePath("/plans");
}

/** Giãn deadline plan thêm n ngày (lựa chọn khi chậm tiến độ, mục 10.4) */
export async function extendPlanDeadline(
  id: string,
  days: number,
): Promise<void> {
  const plan = await prisma.plan.findUnique({ where: { id } });
  if (!plan) return;
  await prisma.plan.update({
    where: { id },
    data: { endDate: addDays(plan.endDate, Math.max(1, days)) },
  });
  revalidatePath("/plans");
}

export async function deletePlan(id: string): Promise<void> {
  // gỡ liên kết ở task trước (onDelete: SetNull lo phần này, nhưng làm rõ ý định)
  await prisma.plan.delete({ where: { id } });
  revalidatePath("/plans");
}
