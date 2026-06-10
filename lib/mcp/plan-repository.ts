import { z } from "zod";
import { prisma } from "@/lib/db";
import { computePlanProgress, sortMilestones } from "@/lib/plan";
import { todayLocal } from "@/lib/mcp/tz";
import { INCLUDE, isoDate, serializeTask } from "@/lib/mcp/repository";
import type { Prisma } from "@prisma/client";

/**
 * Data layer Plan/Milestone cho MCP (mục 10 + 15) — roadmap dài hạn cuốn chiếu.
 * KHÁC `Project` generic: Plan hiện trong trang /plans, có tiến độ ĐỘNG (lib/plan.ts) và
 * được "Đề xuất ngày mai" rót task. Tiến độ KHÔNG lưu cứng — tính trên đường truyền.
 * BẤT BIẾN §10.8: AI chỉ GỢI Ý tick milestone; người dùng tự xác nhận.
 */

const PLAN_STATUS = z.enum(["active", "paused", "done", "archived"]);
const INTENSITY = z.enum(["nhẹ", "vừa", "dồn"]);

const milestoneInputSchema = z.object({
  title: z.string().min(1),
  order: z.number().int().optional(),
  targetDate: isoDate.optional(),
});

export const planCreateSchema = z.object({
  title: z.string().min(1),
  goal: z.string().min(1, "Cần `goal`: định nghĩa 'xong' + bối cảnh"),
  startDate: isoDate,
  endDate: isoDate,
  intensity: INTENSITY.optional(),
  milestones: z.array(milestoneInputSchema).optional(),
});

export const planUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  goal: z.string().min(1).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  status: PLAN_STATUS.optional(),
  intensity: INTENSITY.optional(),
});

export const addMilestonesSchema = z.object({
  planId: z.string(),
  milestones: z.array(milestoneInputSchema).min(1),
});

export const milestoneCheckSchema = z.object({
  id: z.string(),
  done: z.boolean().optional(), // mặc định true
});

export const planListSchema = z.object({ status: PLAN_STATUS.optional() });

type PlanWithMs = Prisma.PlanGetPayload<{ include: { milestones: true } }>;

/** Serialize plan + tiến độ động (progressPct/behindDays/currentMilestone/daysLeft). */
function serializePlan(
  plan: PlanWithMs,
  tasks?: ReturnType<typeof serializeTask>[],
) {
  const milestones = sortMilestones(plan.milestones);
  const progress = computePlanProgress(
    { startDate: plan.startDate, endDate: plan.endDate },
    milestones.map((m) => ({ order: m.order, done: m.done, title: m.title })),
    todayLocal(),
  );
  return {
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    startDate: plan.startDate,
    endDate: plan.endDate,
    status: plan.status,
    intensity: plan.intensity,
    ...progress, // total, done, progressPct, behindDays, daysLeft, currentMilestone
    milestones: milestones.map((m) => ({
      id: m.id,
      title: m.title,
      order: m.order,
      targetDate: m.targetDate,
      done: m.done,
    })),
    ...(tasks ? { tasks } : {}),
  };
}

export async function createPlan(raw: unknown) {
  const p = planCreateSchema.parse(raw);
  if (p.startDate > p.endDate) throw new Error("startDate phải ≤ endDate.");
  const ms = (p.milestones ?? []).map((m, i) => ({
    title: m.title.trim(),
    order: m.order ?? i + 1,
    targetDate: m.targetDate ?? null,
  }));
  const plan = await prisma.plan.create({
    data: {
      title: p.title.trim(),
      goal: p.goal.trim(),
      startDate: p.startDate,
      endDate: p.endDate,
      intensity: p.intensity ?? "vừa",
      status: "active",
      milestones: ms.length ? { create: ms } : undefined,
    },
    include: { milestones: true },
  });
  return serializePlan(plan);
}

export async function addMilestones(raw: unknown) {
  const { planId, milestones } = addMilestonesSchema.parse(raw);
  // ném P2025 nếu plan không tồn tại (guard ở server dịch thành thông báo rõ ràng)
  await prisma.plan.findUniqueOrThrow({ where: { id: planId } });
  const last = await prisma.milestone.findFirst({
    where: { planId },
    orderBy: { order: "desc" },
    select: { order: true },
  });
  let next = (last?.order ?? 0) + 1;
  await prisma.milestone.createMany({
    data: milestones.map((m) => ({
      planId,
      title: m.title.trim(),
      order: m.order ?? next++,
      targetDate: m.targetDate ?? null,
    })),
  });
  return getPlan(planId);
}

export async function updatePlan(id: string, raw: unknown) {
  const patch = planUpdateSchema.parse(raw);
  if (patch.startDate && patch.endDate && patch.startDate > patch.endDate) {
    throw new Error("startDate phải ≤ endDate.");
  }
  const plan = await prisma.plan.update({
    where: { id },
    data: {
      ...(patch.title !== undefined ? { title: patch.title.trim() } : {}),
      ...(patch.goal !== undefined ? { goal: patch.goal.trim() } : {}),
      ...(patch.startDate !== undefined ? { startDate: patch.startDate } : {}),
      ...(patch.endDate !== undefined ? { endDate: patch.endDate } : {}),
      ...(patch.status !== undefined ? { status: patch.status } : {}),
      ...(patch.intensity !== undefined ? { intensity: patch.intensity } : {}),
    },
    include: { milestones: true },
  });
  return serializePlan(plan);
}

/** Tick/bỏ tick một milestone (mặc định done=true). Trả lại plan với tiến độ mới. */
export async function checkMilestone(raw: unknown) {
  const { id, done } = milestoneCheckSchema.parse(raw);
  const m = await prisma.milestone.update({
    where: { id },
    data: { done: done ?? true },
    select: { planId: true },
  });
  return getPlan(m.planId);
}

export async function listPlans(raw: unknown) {
  const { status } = planListSchema.parse(raw ?? {});
  const plans = await prisma.plan.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    include: { milestones: true },
  });
  return plans.map((p) => serializePlan(p));
}

export async function getPlan(id: string) {
  const plan = await prisma.plan.findUnique({
    where: { id },
    include: { milestones: true },
  });
  if (!plan) return null;
  const tasks = await prisma.task.findMany({
    where: { planId: id },
    include: INCLUDE,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return serializePlan(plan, tasks.map(serializeTask));
}
