import { z } from "zod";
import { prisma } from "@/lib/db";
import { daysBetween, addDays } from "@/lib/dates";
import { blocksForDate, busyMinutes, freeMinutes } from "@/lib/schedule";
import { localDay, parseIso, todayLocal } from "@/lib/mcp/tz";
import type {
  CommitmentDTO,
  Priority,
  ScheduleEventDTO,
  ScheduleKind,
} from "@/lib/types";
import type { Prisma } from "@prisma/client";

/**
 * Data layer cho MCP (mục 15) — đóng gói MỌI thao tác DB, zod-validate, tái dùng lib/*.
 * QUY TẮC ĐỒNG BỘ (để app cũ không vỡ — app lọc theo `done`/`date`, không theo status):
 *  - set `scheduledFor` ⇒ set `date` = ngày địa phương của nó.
 *  - `status=DONE` (hoặc completeTask) ⇒ `done=true` + `completedAt`. status khác ⇒ `done=false`.
 *  - set `priority` ⇒ map sang `impact` (logic 80/20 của app dùng impact).
 */

// ---------- enums & schema ----------
export const PRIORITY = z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]);
export const STATUS = z.enum(["TODO", "IN_PROGRESS", "DONE", "CANCELLED"]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Cần dạng YYYY-MM-DD");
const isoDateTime = z
  .string()
  .datetime({ offset: true })
  .or(z.string().datetime());

export const taskCreateSchema = z.object({
  title: z.string().min(1, "Cần title"),
  description: z.string().optional(),
  date: isoDate.optional(),
  scheduledFor: isoDateTime.optional(),
  dueDate: isoDateTime.optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  priority: PRIORITY.optional(),
  status: STATUS.optional(),
  projectId: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  done: z.boolean().optional(),
});
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

// ---------- mapping helpers ----------
const PRIORITY_TO_IMPACT: Record<string, Priority> = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "high",
};

/** Suy các field DB từ input chung cho create/update (đồng bộ done/date/impact). */
function deriveFields(
  input: Partial<TaskCreateInput> & { done?: boolean },
): Prisma.TaskUncheckedCreateInput {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title.trim();
  if (input.description !== undefined)
    out.description = input.description || null;
  if (input.estimatedMinutes !== undefined)
    out.estimatedMinutes = input.estimatedMinutes;
  if (input.projectId !== undefined) out.projectId = input.projectId || null;
  if (input.dueDate !== undefined) out.dueDate = parseIso(input.dueDate);

  // scheduledFor ⇒ đồng bộ date
  if (input.scheduledFor !== undefined) {
    const sf = parseIso(input.scheduledFor);
    out.scheduledFor = sf;
    out.date = localDay(sf);
  }
  if (input.date !== undefined) out.date = input.date;

  // priority ⇒ impact
  if (input.priority !== undefined) {
    out.priority = input.priority;
    out.impact = PRIORITY_TO_IMPACT[input.priority];
  }

  // status / done đồng bộ 2 chiều
  const status = input.status;
  const done = input.done;
  if (status !== undefined || done !== undefined) {
    const isDone = status === "DONE" || done === true;
    out.status = status ?? (isDone ? "DONE" : "TODO");
    out.done = isDone;
    out.completedAt = isDone ? new Date() : null;
  }
  return out as Prisma.TaskUncheckedCreateInput;
}

function tagsConnect(tags?: string[]) {
  if (!tags) return undefined;
  const names = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  return {
    connectOrCreate: names.map((name) => ({
      where: { name },
      create: { name },
    })),
  };
}

type TaskWithRel = Prisma.TaskGetPayload<{
  include: { tags: true; project: true };
}>;

/** Serialize task cho MCP (gọn, ISO 8601, kèm delayDays động). */
function serializeTask(t: TaskWithRel) {
  const today = todayLocal();
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status ?? (t.done ? "DONE" : "TODO"),
    done: t.done,
    priority: t.priority,
    impact: t.impact,
    date: t.date,
    scheduledFor: t.scheduledFor ? t.scheduledFor.toISOString() : null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    estimatedMinutes: t.estimatedMinutes,
    projectId: t.projectId,
    project: t.project ? { id: t.project.id, name: t.project.name } : null,
    tags: t.tags.map((tag) => tag.name),
    cue: t.cue,
    planId: t.planId,
    milestoneId: t.milestoneId,
    delayDays: t.done ? 0 : Math.max(0, daysBetween(t.date, today)),
  };
}

const INCLUDE = { tags: true, project: true } as const;

// ---------- Task CRUD ----------
export async function createTask(raw: unknown) {
  const input = taskCreateSchema.parse(raw);
  const base = deriveFields(input);
  if (base.date === undefined) base.date = todayLocal(); // luôn có date cho UI app
  if (base.status === undefined) {
    base.status = "TODO";
    base.done = false;
  }
  const task = await prisma.task.create({
    data: { ...base, tags: tagsConnect(input.tags) },
    include: INCLUDE,
  });
  return serializeTask(task);
}

export async function updateTask(id: string, raw: unknown) {
  const input = taskUpdateSchema.parse(raw);
  const data = deriveFields(input) as Prisma.TaskUpdateInput;
  const task = await prisma.task.update({
    where: { id },
    data: {
      ...data,
      ...(input.tags ? { tags: { set: [], ...tagsConnect(input.tags) } } : {}),
    },
    include: INCLUDE,
  });
  return serializeTask(task);
}

export async function getTask(id: string) {
  const task = await prisma.task.findUnique({
    where: { id },
    include: INCLUDE,
  });
  return task ? serializeTask(task) : null;
}

export async function completeTask(id: string) {
  const task = await prisma.task.update({
    where: { id },
    data: { done: true, completedAt: new Date(), status: "DONE" },
    include: INCLUDE,
  });
  return serializeTask(task);
}

/** HARD delete (đã chốt: không soft-delete vì app lọc theo done/date, không theo status). */
export async function deleteTask(id: string) {
  await prisma.task.delete({ where: { id } });
  return { id, deleted: true };
}

export async function bulkCreateTasks(rawList: unknown) {
  const list = z.array(taskCreateSchema).min(1).max(100).parse(rawList);
  const created = await prisma.$transaction(
    list.map((input) => {
      const base = deriveFields(input);
      if (base.date === undefined) base.date = todayLocal();
      if (base.status === undefined) {
        base.status = "TODO";
        base.done = false;
      }
      return prisma.task.create({
        data: { ...base, tags: tagsConnect(input.tags) },
        include: INCLUDE,
      });
    }),
  );
  return { count: created.length, tasks: created.map(serializeTask) };
}

// ---------- list ----------
export const listFilterSchema = z.object({
  status: STATUS.optional(),
  priority: PRIORITY.optional(),
  projectId: z.string().optional(),
  tag: z.string().optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
  search: z.string().optional(),
  includeDone: z.boolean().optional(),
  limit: z.number().int().min(1).max(500).optional(),
});

export async function listTasks(raw: unknown) {
  const f = listFilterSchema.parse(raw ?? {});
  const where: Prisma.TaskWhereInput = {};
  if (f.status) where.status = f.status;
  if (f.priority) where.priority = f.priority;
  if (f.projectId) where.projectId = f.projectId;
  if (f.tag) where.tags = { some: { name: f.tag } };
  if (f.search) where.title = { contains: f.search };
  if (f.includeDone === false) where.done = false;
  if (f.from || f.to) {
    where.date = {};
    if (f.from) where.date.gte = f.from;
    if (f.to) where.date.lte = f.to;
  }
  const tasks = await prisma.task.findMany({
    where,
    include: INCLUDE,
    orderBy: [{ date: "asc" }, { scheduledFor: "asc" }, { createdAt: "asc" }],
    take: f.limit ?? 100,
  });
  return tasks.map(serializeTask);
}

// ---------- Project ----------
export const projectCreateSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  startDate: isoDateTime.optional(),
  targetEndDate: isoDateTime.optional(),
  status: z.enum(["active", "done", "archived"]).optional(),
});

export async function createProject(raw: unknown) {
  const p = projectCreateSchema.parse(raw);
  const project = await prisma.project.create({
    data: {
      name: p.name.trim(),
      description: p.description || null,
      startDate: p.startDate ? parseIso(p.startDate) : null,
      targetEndDate: p.targetEndDate ? parseIso(p.targetEndDate) : null,
      status: p.status ?? "active",
    },
  });
  return serializeProject(project, []);
}

function serializeProject(
  p: Prisma.ProjectGetPayload<object>,
  tasks: ReturnType<typeof serializeTask>[],
) {
  const total = tasks.length;
  const done = tasks.filter((t) => t.done).length;
  return {
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    targetEndDate: p.targetEndDate ? p.targetEndDate.toISOString() : null,
    progressPct: total > 0 ? Math.round((done / total) * 100) : 0,
    taskCount: total,
    doneCount: done,
    tasks,
  };
}

export async function getProject(id: string) {
  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) return null;
  const tasks = await prisma.task.findMany({
    where: { projectId: id },
    include: INCLUDE,
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return serializeProject(project, tasks.map(serializeTask));
}

export async function listProjects(raw: unknown) {
  const f = z
    .object({ status: z.enum(["active", "done", "archived"]).optional() })
    .parse(raw ?? {});
  const projects = await prisma.project.findMany({
    where: f.status ? { status: f.status } : {},
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tasks: true } } },
  });
  // tiến độ nhẹ: đếm done qua group; ở đây trả gọn (không kèm tasks)
  const out = [];
  for (const p of projects) {
    const doneCount = await prisma.task.count({
      where: { projectId: p.id, done: true },
    });
    out.push({
      id: p.id,
      name: p.name,
      status: p.status,
      taskCount: p._count.tasks,
      doneCount,
      progressPct:
        p._count.tasks > 0 ? Math.round((doneCount / p._count.tasks) * 100) : 0,
      startDate: p.startDate ? p.startDate.toISOString() : null,
      targetEndDate: p.targetEndDate ? p.targetEndDate.toISOString() : null,
    });
  }
  return out;
}

// ---------- schedule & workload (tái dùng lib/schedule) ----------
async function loadScheduleSources(from: string, to: string) {
  const [commitmentRows, eventRows] = await Promise.all([
    prisma.commitment.findMany({ where: { active: true } }),
    prisma.scheduleEvent.findMany({ where: { date: { gte: from, lte: to } } }),
  ]);
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
  const events: ScheduleEventDTO[] = eventRows.map((e) => ({
    id: e.id,
    title: e.title,
    date: e.date,
    startTime: e.startTime,
    endTime: e.endTime,
    kind: e.kind as ScheduleKind,
    cancels: e.cancels,
  }));
  return { commitments, events };
}

function* eachDay(from: string, to: string) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

export const rangeSchema = z.object({ from: isoDate, to: isoDate });

export async function getScheduleRange(raw: unknown) {
  const { from, to } = rangeSchema.parse(raw);
  const { commitments, events } = await loadScheduleSources(from, to);
  const tasks = await prisma.task.findMany({
    where: { date: { gte: from, lte: to } },
    include: INCLUDE,
    orderBy: [{ date: "asc" }, { scheduledFor: "asc" }],
  });
  const days = [];
  for (const date of eachDay(from, to)) {
    days.push({
      date,
      blocks: blocksForDate(date, commitments, events),
      tasks: tasks.filter((t) => t.date === date).map(serializeTask),
    });
  }
  return { from, to, days };
}

export async function getWorkloadSummary(raw: unknown) {
  const { from, to } = rangeSchema.parse(raw);
  const { commitments, events } = await loadScheduleSources(from, to);
  const tasks = await prisma.task.findMany({
    where: { date: { gte: from, lte: to }, done: false },
    select: { date: true, estimatedMinutes: true },
  });
  const days = [];
  for (const date of eachDay(from, to)) {
    const dayTasks = tasks.filter((t) => t.date === date);
    const busy = busyMinutes(blocksForDate(date, commitments, events));
    days.push({
      date,
      taskCount: dayTasks.length,
      totalEstimatedMinutes: dayTasks.reduce(
        (s, t) => s + (t.estimatedMinutes ?? 0),
        0,
      ),
      committedMinutes: busy, // lịch cứng (học/làm)
      freeMinutes: freeMinutes(date, commitments, events),
    });
  }
  return { from, to, days };
}
