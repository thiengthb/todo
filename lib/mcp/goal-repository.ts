import { z } from 'zod';
import { prisma } from '@/lib/db';
import { goalAgeDays } from '@/lib/queue';
import { isDateOrIso, todayLocal } from '@/lib/mcp/tz';
import { PRIORITY, createTask, isoDate } from '@/lib/mcp/repository';
import { createPlan } from '@/lib/mcp/plan-repository';
import type { Prisma } from '@prisma/client';

/**
 * Data layer "Ấp ủ" cho MCP (mục 17) — hàng đợi mục tiêu CHƯA cam kết (Someday/Maybe).
 * KHÁC Task (đã có ngày) và Plan (đã có roadmap): goal là giai đoạn tiền-cam-kết. Ngõ ra:
 * promote_to_task (kéo thành việc 1 ngày) hoặc promote_to_plan (nâng thành kế hoạch nhiều bước).
 * AI KHÔNG tự buông. Tuổi (ageDays) suy ĐỘNG ở lib/queue, không lưu cứng.
 */

const GOAL_STATUS = z.enum(['incubating', 'promoted', 'dropped']);

const flexibleDate = z.string().refine(isDateOrIso, 'Cần ngày YYYY-MM-DD hoặc thời điểm ISO 8601');

export const goalCreateSchema = z.object({
  title: z.string().min(1, 'Cần title'),
  note: z.string().optional(), // bối cảnh / vì sao muốn (tùy chọn)
});

export const goalUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  note: z.string().nullable().optional(),
  pinned: z.boolean().optional(),
  snoozedUntil: isoDate.nullable().optional(), // "YYYY-MM-DD"; null = bỏ hoãn
});

export const goalListSchema = z.object({
  status: GOAL_STATUS.optional(), // mặc định incubating
});

export const promoteToTaskSchema = z.object({
  goalId: z.string(),
  scheduledFor: flexibleDate.optional(), // lúc dự định làm (set kèm date)
  date: isoDate.optional(), // ngày gắn việc (mặc định hôm nay nếu cả 2 trống)
  estimatedMinutes: z.number().int().min(0).optional(),
  deepWork: z.boolean().optional(),
  priority: PRIORITY.optional(),
});

const milestoneInput = z.object({
  title: z.string().min(1),
  order: z.number().int().optional(),
  targetDate: isoDate.optional(),
});

export const promoteToPlanSchema = z.object({
  goalId: z.string(),
  title: z.string().min(1).optional(), // mặc định lấy từ goal.title
  goal: z.string().min(1).optional(), // mặc định goal.note ?? goal.title
  startDate: isoDate,
  endDate: isoDate,
  intensity: z.enum(['nhẹ', 'vừa', 'dồn']).optional(),
  milestones: z.array(milestoneInput).optional(),
});

type GoalRow = Prisma.GoalGetPayload<Record<string, never>>;

/** Serialize goal cho MCP — kèm ageDays động (mục 17). */
function serializeGoal(g: GoalRow) {
  return {
    id: g.id,
    title: g.title,
    note: g.note,
    status: g.status,
    pinned: g.pinned,
    snoozedUntil: g.snoozedUntil,
    ageDays: goalAgeDays(g, todayLocal()),
    promotedTaskId: g.promotedTaskId,
    promotedPlanId: g.promotedPlanId,
    createdAt: g.createdAt.toISOString(),
  };
}

export async function addToQueue(raw: unknown) {
  const { title, note } = goalCreateSchema.parse(raw);
  const g = await prisma.goal.create({
    data: { title: title.trim(), note: note?.trim() || null },
  });
  return serializeGoal(g);
}

export async function listQueue(raw: unknown) {
  const { status } = goalListSchema.parse(raw ?? {});
  const goals = await prisma.goal.findMany({
    where: { status: status ?? 'incubating' },
    orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
  });
  return goals.map(serializeGoal);
}

export async function updateGoal(id: string, raw: unknown) {
  const patch = goalUpdateSchema.parse(raw);
  const data: Prisma.GoalUpdateInput = {};
  if (patch.title !== undefined) data.title = patch.title.trim();
  if (patch.note !== undefined) data.note = patch.note?.trim() || null;
  if (patch.pinned !== undefined) data.pinned = patch.pinned;
  if (patch.snoozedUntil !== undefined) data.snoozedUntil = patch.snoozedUntil;
  const g = await prisma.goal.update({ where: { id }, data });
  return serializeGoal(g);
}

/** Buông (soft) — vào trạng thái dropped. AI chỉ làm khi người dùng đồng ý (§17). */
export async function dropGoal(id: string) {
  const g = await prisma.goal.update({ where: { id }, data: { status: 'dropped' } });
  return serializeGoal(g);
}

/** Kéo mục tiêu thành Task (việc 1 ngày) — tái dùng createTask, đánh dấu promoted. */
export async function promoteToTask(raw: unknown) {
  const input = promoteToTaskSchema.parse(raw);
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: input.goalId } });
  if (goal.status !== 'incubating') {
    throw new Error('Mục tiêu không còn trong hàng đợi (đã promoted hoặc dropped).');
  }
  const task = await createTask({
    title: goal.title,
    scheduledFor: input.scheduledFor,
    date: input.date,
    estimatedMinutes: input.estimatedMinutes,
    deepWork: input.deepWork,
    priority: input.priority,
  });
  await prisma.goal.update({
    where: { id: goal.id },
    data: { status: 'promoted', promotedTaskId: task.id },
  });
  return { promoted: true, goalId: goal.id, task };
}

/** Nâng mục tiêu thành Plan (mục tiêu nhiều bước) — tái dùng createPlan, đánh dấu promoted. */
export async function promoteToPlan(raw: unknown) {
  const input = promoteToPlanSchema.parse(raw);
  const goal = await prisma.goal.findUniqueOrThrow({ where: { id: input.goalId } });
  if (goal.status !== 'incubating') {
    throw new Error('Mục tiêu không còn trong hàng đợi (đã promoted hoặc dropped).');
  }
  const plan = await createPlan({
    title: input.title ?? goal.title,
    goal: input.goal ?? goal.note ?? goal.title,
    startDate: input.startDate,
    endDate: input.endDate,
    intensity: input.intensity,
    milestones: input.milestones,
  });
  await prisma.goal.update({
    where: { id: goal.id },
    data: { status: 'promoted', promotedPlanId: plan.id },
  });
  return { promoted: true, goalId: goal.id, plan };
}
