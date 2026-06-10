"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { addDays, isValidDateStr, todayStr, tomorrowStr } from "@/lib/dates";
import { isValidHm } from "@/lib/notify/time";
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

/** Đặt/xoá gợi ý "khi nào/ở đâu" (implementation intention, mục 11) */
export async function setCue(id: string, cue: string): Promise<void> {
  const c = cue.trim();
  await prisma.task.update({ where: { id }, data: { cue: c || null } });
  revalidatePath("/");
}

/** Đặt mức tác động 80/20 (mục 11). null = bỏ đánh dấu. */
export async function setImpact(
  id: string,
  impact: "high" | "medium" | "low" | null,
): Promise<void> {
  await prisma.task.update({ where: { id }, data: { impact } });
  revalidatePath("/");
}

export type SlipReason =
  | "tired"
  | "too_hard"
  | "no_time"
  | "unclear"
  | "deprioritized";

/** Ghi lý do trượt 1 chạm (mục 11) — AI học để chia nhỏ / giảm tải. null = bỏ. */
export async function setSlipReason(
  id: string,
  reason: SlipReason | null,
): Promise<void> {
  await prisma.task.update({ where: { id }, data: { slipReason: reason } });
  revalidatePath("/");
}

/** Ước lượng thời lượng (phút) — null = bỏ. AI dùng để khớp khe giờ + tính quá tải (mục 14). */
export async function setEstimate(
  id: string,
  minutes: number | null,
): Promise<void> {
  const m =
    minutes != null && minutes > 0 ? Math.min(600, Math.round(minutes)) : null;
  await prisma.task.update({ where: { id }, data: { estimatedMinutes: m } });
  revalidatePath("/");
}

/** Cờ "việc cần tập trung sâu" → AI ưu tiên khe sáng (mục 14). */
export async function setDeepWork(id: string, value: boolean): Promise<void> {
  await prisma.task.update({ where: { id }, data: { deepWork: value } });
  revalidatePath("/");
}

export type ActualBucket = "faster" | "asExpected" | "slower";

/** Phản hồi thời lượng 1-chạm khi xong (mục 14) — AI hiệu chỉnh ước lượng. null = bỏ. */
export async function setActualBucket(
  id: string,
  bucket: ActualBucket | null,
): Promise<void> {
  await prisma.task.update({ where: { id }, data: { actualBucket: bucket } });
  revalidatePath("/");
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
  cue?: string | null,
  impact?: string | null,
  // xếp giờ (mục 14) — đề xuất của AI đã được server validate
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
      orderBy: { createdAt: "asc" },
    });
    if (origin) carriedFrom = origin.carriedFrom ?? origin.date;
  }

  const date = tomorrowStr();
  const planId = link?.planId ?? null;
  const milestoneId = link?.milestoneId ?? null;
  const steps = (subtasks ?? []).map((s) => s.trim()).filter(Boolean);
  // giờ dự kiến làm (mục 14): ghép date ngày mai + slotStart → DateTime địa phương
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
      // priority của đề xuất = tín hiệu 80/20 → lưu thành impact (mục 11)
      impact: impact ?? null,
      scheduledFor,
      estimatedMinutes:
        extra?.estimatedMinutes && extra.estimatedMinutes > 0
          ? Math.round(extra.estimatedMinutes)
          : null,
      deepWork: extra?.deepWork === true,
    },
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

/** Xếp một việc đã có vào khe giờ (mục 14): set scheduledFor theo `date` của task. null = bỏ giờ. */
export async function scheduleTaskAt(
  id: string,
  hm: string | null,
): Promise<void> {
  const task = await prisma.task.findUnique({
    where: { id },
    select: { date: true },
  });
  if (!task) return;
  const scheduledFor =
    hm && isValidHm(hm) ? new Date(`${task.date}T${hm}:00`) : null;
  await prisma.task.update({ where: { id }, data: { scheduledFor } });
  revalidatePath("/");
}

/** Check-in Personal OS (mục 11) — tất cả tùy chọn; null xoá field đó. Upsert theo ngày hôm nay. */
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
