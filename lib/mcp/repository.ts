import { z } from 'zod';
import { prisma } from '@/lib/db';
import { daysBetween, addDays } from '@/lib/dates';
import {
  blocksForDate,
  busyMinutes,
  computeFreeSlots,
  softBlocksForDate,
  softLoadMinutes,
} from '@/lib/schedule';
import { getScheduleSettings } from '@/lib/schedule-settings';
import { computeHabitStatus } from '@/lib/habits';
import { coerceToInstant, isDateOrIso, localDay, todayLocal } from '@/lib/mcp/tz';
import type {
  CommitmentDTO,
  Priority,
  ScheduleEventDTO,
  ScheduleKind,
  SoftBlockDTO,
} from '@/lib/types';
import type { Prisma } from '@prisma/client';

/**
 * Data layer for MCP (section 15) — wraps ALL DB operations, zod-validates, reuses lib/*.
 * SYNC RULES (so the old app doesn't break — the app filters by `done`/`date`, not by status):
 *  - setting `scheduledFor` ⇒ set `date` = its local day.
 *  - `status=DONE` (or completeTask) ⇒ `done=true` + `completedAt`. other status ⇒ `done=false`.
 *  - setting `priority` ⇒ map to `impact` (the app's 80/20 logic uses impact).
 */

// ---------- enums & schema ----------
export const PRIORITY = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
export const STATUS = z.enum(['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED']);
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Cần dạng YYYY-MM-DD');
// LENIENT: accept both "YYYY-MM-DD" dates and full ISO 8601 (coerced in deriveFields/createProject).
const flexibleDate = z.string().refine(isDateOrIso, 'Cần ngày YYYY-MM-DD hoặc thời điểm ISO 8601');

export const taskCreateSchema = z.object({
  title: z.string().min(1, 'Cần title'),
  description: z.string().optional(),
  date: isoDate.optional(),
  scheduledFor: flexibleDate.optional(),
  dueDate: flexibleDate.optional(),
  estimatedMinutes: z.number().int().min(0).optional(),
  deepWork: z.boolean().optional(), // prioritize a morning slot (section 14)
  priority: PRIORITY.optional(),
  status: STATUS.optional(),
  // attach the task to a long-term plan (section 10) — so it shows in /plans + gets fed by the AI
  planId: z.string().optional(),
  milestoneId: z.string().optional(),
  tags: z.array(z.string().min(1)).optional(),
});
export type TaskCreateInput = z.infer<typeof taskCreateSchema>;

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  done: z.boolean().optional(),
});
export type TaskUpdateInput = z.infer<typeof taskUpdateSchema>;

// ---------- mapping helpers ----------
const PRIORITY_TO_IMPACT: Record<string, Priority> = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'high',
};

/** Derive the DB fields from a shared create/update input (syncing done/date/impact). */
function deriveFields(
  input: Partial<TaskCreateInput> & { done?: boolean },
): Prisma.TaskUncheckedCreateInput {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title.trim();
  if (input.description !== undefined) out.description = input.description || null;
  if (input.estimatedMinutes !== undefined) out.estimatedMinutes = input.estimatedMinutes;
  if (input.deepWork !== undefined) out.deepWork = input.deepWork;
  if (input.planId !== undefined) out.planId = input.planId || null;
  if (input.milestoneId !== undefined) out.milestoneId = input.milestoneId || null;
  if (input.dueDate !== undefined) out.dueDate = coerceToInstant(input.dueDate);

  // scheduledFor ⇒ sync date
  if (input.scheduledFor !== undefined) {
    const sf = coerceToInstant(input.scheduledFor);
    out.scheduledFor = sf;
    out.date = localDay(sf);
  }
  if (input.date !== undefined) out.date = input.date;

  // priority ⇒ impact
  if (input.priority !== undefined) {
    out.priority = input.priority;
    out.impact = PRIORITY_TO_IMPACT[input.priority];
  }

  // status / done synced both ways
  const status = input.status;
  const done = input.done;
  if (status !== undefined || done !== undefined) {
    const isDone = status === 'DONE' || done === true;
    out.status = status ?? (isDone ? 'DONE' : 'TODO');
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
  include: { tags: true };
}>;

/** Serialize a task for MCP (compact, ISO 8601, with dynamic delayDays). */
export function serializeTask(t: TaskWithRel) {
  const today = todayLocal();
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status ?? (t.done ? 'DONE' : 'TODO'),
    done: t.done,
    priority: t.priority,
    impact: t.impact,
    date: t.date,
    scheduledFor: t.scheduledFor ? t.scheduledFor.toISOString() : null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    estimatedMinutes: t.estimatedMinutes,
    deepWork: t.deepWork,
    actualBucket: t.actualBucket, // "faster"|"asExpected"|"slower"|null (one-tap on completion)
    tags: t.tags.map((tag) => tag.name),
    cue: t.cue,
    planId: t.planId,
    milestoneId: t.milestoneId,
    delayDays: t.done ? 0 : Math.max(0, daysBetween(t.date, today)),
  };
}

export const INCLUDE = { tags: true } as const;

// ---------- Task CRUD ----------
export async function createTask(raw: unknown) {
  const input = taskCreateSchema.parse(raw);
  const base = deriveFields(input);
  if (base.date === undefined) base.date = todayLocal(); // always have a date for the app UI
  if (base.status === undefined) {
    base.status = 'TODO';
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
    data: { done: true, completedAt: new Date(), status: 'DONE' },
    include: INCLUDE,
  });
  return serializeTask(task);
}

/** HARD delete (decided: no soft-delete since the app filters by done/date, not by status). */
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
        base.status = 'TODO';
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
    orderBy: [{ date: 'asc' }, { scheduledFor: 'asc' }, { createdAt: 'asc' }],
    take: f.limit ?? 100,
  });
  return tasks.map(serializeTask);
}

// Project (generic grouping) has been REMOVED from MCP — it conflicted with Plan (§10) and had no UI.
// Any multi-step goal uses Plan/Milestone (lib/mcp/plan-repository.ts). The Project DB table is
// kept as-is (no migration) but no longer exposed via an MCP tool.

// ---------- schedule & workload (reusing lib/schedule) ----------
async function loadScheduleSources(from: string, to: string) {
  const [commitmentRows, softRows, eventRows] = await Promise.all([
    prisma.commitment.findMany({ where: { active: true } }),
    prisma.softBlock.findMany({ where: { active: true } }),
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
  const softBlocks: SoftBlockDTO[] = softRows.map((s) => ({
    id: s.id,
    title: s.title,
    dayOfWeek: s.dayOfWeek,
    startTime: s.startTime,
    endTime: s.endTime,
    kind: s.kind as ScheduleKind,
    active: s.active,
    validFrom: s.validFrom,
    validUntil: s.validUntil,
    weekParity: s.weekParity,
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
  return { commitments, softBlocks, events };
}

function* eachDay(from: string, to: string) {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

// `to` optional — defaults to `from` (to view 1 day, Claude only needs to pass `from`).
export const rangeSchema = z.object({ from: isoDate, to: isoDate.optional() });

/** Normalize a date range: default `to` = `from` if missing, ensure from ≤ to. */
function normalizeRange(raw: unknown): { from: string; to: string } {
  const { from, to } = rangeSchema.parse(raw);
  const end = to ?? from;
  if (from > end) throw new Error('`from` phải ≤ `to` (định dạng YYYY-MM-DD).');
  return { from, to: end };
}

export async function getScheduleRange(raw: unknown) {
  const { from, to } = normalizeRange(raw);
  const [{ commitments, softBlocks, events }, settings] = await Promise.all([
    loadScheduleSources(from, to),
    getScheduleSettings(),
  ]);
  const anchor = settings.termAnchorMonday;
  const tasks = await prisma.task.findMany({
    where: { date: { gte: from, lte: to } },
    include: INCLUDE,
    orderBy: [{ date: 'asc' }, { scheduledFor: 'asc' }],
  });
  const days = [];
  for (const date of eachDay(from, to)) {
    days.push({
      date,
      // lịch cứng (khoá) — lọc kỳ học + tuần chẵn/lẻ theo anchor
      blocks: blocksForDate(date, commitments, events, anchor),
      // khung mềm (time-blocking, dời được) — KHÔNG trừ quỹ rảnh cứng
      softBlocks: softBlocksForDate(date, softBlocks, events, anchor),
      tasks: tasks.filter((t) => t.date === date).map(serializeTask),
    });
  }
  return { from, to, days };
}

export async function getWorkloadSummary(raw: unknown) {
  const { from, to } = normalizeRange(raw);
  const [{ commitments, softBlocks, events }, settings] = await Promise.all([
    loadScheduleSources(from, to),
    getScheduleSettings(),
  ]);
  // Cấu hình quỹ giờ thật của người dùng (giờ thức/buffer/khe tối thiểu/anchor parity)
  const config = {
    wakeTime: settings.wakeTime,
    sleepTime: settings.sleepTime,
    bufferMin: settings.bufferMin,
    minSlotMin: settings.minSlotMin,
    termAnchorMonday: settings.termAnchorMonday,
  };
  const tasks = await prisma.task.findMany({
    where: { date: { gte: from, lte: to }, done: false },
    select: { date: true, estimatedMinutes: true },
  });
  const days = [];
  for (const date of eachDay(from, to)) {
    const dayTasks = tasks.filter((t) => t.date === date);
    const blocks = blocksForDate(date, commitments, events, settings.termAnchorMonday);
    const cap = computeFreeSlots(date, commitments, events, config);
    const softToday = softBlocksForDate(date, softBlocks, events, settings.termAnchorMonday);
    const softLoad = softLoadMinutes(cap.slots, softToday);
    days.push({
      date,
      taskCount: dayTasks.length,
      totalEstimatedMinutes: dayTasks.reduce((s, t) => s + (t.estimatedMinutes ?? 0), 0),
      committedMinutes: busyMinutes(blocks), // lịch cứng (học/làm), không kể buffer
      freeMinutes: cap.capacityMin, // quỹ rảnh thật theo ScheduleSettings (đã trừ buffer)
      softLoadMinutes: softLoad, // thời gian đã chủ ý dành cho khung mềm
      suggestedFreeMinutes: Math.max(0, cap.capacityMin - softLoad), // quỹ NÊN dùng xếp việc mới
      freeSlots: cap.slots, // danh sách khe trống {start,end,durationMin} để gắn scheduledFor
    });
  }
  return { from, to, days };
}

// ---------- habits (mục 11 — 1 chạm, streak ĐỘNG, KHÔNG điểm) ----------
export async function listHabits() {
  const today = todayLocal();
  const habits = await prisma.habit.findMany({
    where: { active: true },
    include: { checks: { select: { date: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return habits.map((h) => {
    const status = computeHabitStatus(
      { daysOfWeek: h.daysOfWeek },
      h.checks.map((c) => c.date),
      today,
    );
    return {
      id: h.id,
      title: h.title,
      daysOfWeek: h.daysOfWeek, // CSV "1,2,3" hoặc null = hằng ngày
      dueToday: status.dueToday,
      doneToday: status.doneToday,
      streak: status.streak, // thông tin, KHÔNG phải điểm số
    };
  });
}

export const habitCheckSchema = z.object({
  id: z.string(),
  date: isoDate.optional(), // mặc định hôm nay
  checked: z.boolean().optional(), // mặc định true (đánh dấu đã làm)
});

/** Tick/bỏ tick thói quen cho một ngày (idempotent qua @@unique([habitId, date])). */
export async function setHabitCheck(raw: unknown) {
  const { id, date, checked } = habitCheckSchema.parse(raw);
  const day = date ?? todayLocal();
  const want = checked ?? true;
  if (want) {
    await prisma.habitCheck.upsert({
      where: { habitId_date: { habitId: id, date: day } },
      create: { habitId: id, date: day },
      update: {},
    });
  } else {
    await prisma.habitCheck
      .delete({ where: { habitId_date: { habitId: id, date: day } } })
      .catch(() => {}); // chưa tick thì bỏ qua
  }
  return { id, date: day, checked: want };
}
