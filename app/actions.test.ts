import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mockDeep, mockReset, type DeepMockProxy } from 'vitest-mock-extended';
import type { PrismaClient } from '@prisma/client';

// Hoisted mocks MUST precede importing the actions under test.
vi.mock('@/lib/db', () => ({ prisma: mockDeep<PrismaClient>() }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
// Stub only the clock helpers; keep isValidDateStr / isValidHm / addDays real.
vi.mock('@/lib/dates', async (importActual) => {
  const actual = await importActual<typeof import('@/lib/dates')>();
  return { ...actual, todayStr: () => '2026-06-14', tomorrowStr: () => '2026-06-15' };
});

import { prisma } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import {
  addTask,
  toggleTask,
  deleteTask,
  setEmotion,
  setEstimate,
  saveNote,
  scheduleTaskAt,
  addTomorrowTask,
  createPlan,
} from '@/app/actions';

const db = prisma as unknown as DeepMockProxy<PrismaClient>;

beforeEach(() => {
  mockReset(db);
  vi.clearAllMocks();
});

describe('addTask', () => {
  it('creates with the given valid date and revalidates /', async () => {
    await addTask('Buy milk', '2025-06-15');
    expect(db.task.create).toHaveBeenCalledWith({
      data: { title: 'Buy milk', date: '2025-06-15' },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('ignores an empty/whitespace title (guard)', async () => {
    await addTask('   ');
    expect(db.task.create).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('falls back to today on a missing or invalid date', async () => {
    await addTask('Plan day', 'bad-date');
    expect(db.task.create).toHaveBeenCalledWith({
      data: { title: 'Plan day', date: '2026-06-14' },
    });
  });
});

describe('toggleTask', () => {
  it('marks done with a completedAt and revalidates the layout (streak chip)', async () => {
    await toggleTask('t1', true);
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { done: true, completedAt: expect.any(Date) },
    });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });

  it('un-checking clears completedAt and emotion', async () => {
    await toggleTask('t1', false);
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { done: false, completedAt: null, emotion: null },
    });
  });
});

describe('deleteTask', () => {
  it('hard-deletes and revalidates the layout', async () => {
    await deleteTask('t1');
    expect(db.task.delete).toHaveBeenCalledWith({ where: { id: 't1' } });
    expect(revalidatePath).toHaveBeenCalledWith('/', 'layout');
  });
});

describe('setEmotion', () => {
  it('does nothing when the task is not found', async () => {
    db.task.findUnique.mockResolvedValue(null as never);
    await setEmotion('t1', 'hard' as never);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it('refuses to score a task that is not done (spec guard)', async () => {
    db.task.findUnique.mockResolvedValue({ done: false, emotion: null } as never);
    await setEmotion('t1', 'hard' as never);
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it('sets the emotion on a done task', async () => {
    db.task.findUnique.mockResolvedValue({ done: true, emotion: null } as never);
    await setEmotion('t1', 'hard' as never);
    expect(db.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { emotion: 'hard' } });
  });

  it('toggles the same emotion back off', async () => {
    db.task.findUnique.mockResolvedValue({ done: true, emotion: 'hard' } as never);
    await setEmotion('t1', 'hard' as never);
    expect(db.task.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { emotion: null } });
  });
});

describe('setEstimate', () => {
  it('clamps and rounds a positive estimate, nulls a non-positive one', async () => {
    await setEstimate('t1', 30.7);
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { estimatedMinutes: 31 },
    });
    mockReset(db);
    await setEstimate('t1', 0);
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { estimatedMinutes: null },
    });
    mockReset(db);
    await setEstimate('t1', 601);
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { estimatedMinutes: 600 },
    });
  });
});

describe('saveNote', () => {
  it('deletes the note when the text is empty', async () => {
    await saveNote('   ');
    expect(db.dailyNote.deleteMany).toHaveBeenCalledWith({ where: { date: '2026-06-14' } });
    expect(db.dailyNote.upsert).not.toHaveBeenCalled();
  });

  it('upserts the trimmed note when non-empty', async () => {
    await saveNote('  Great day  ');
    expect(db.dailyNote.upsert).toHaveBeenCalledWith({
      where: { date: '2026-06-14' },
      create: { date: '2026-06-14', note: 'Great day' },
      update: { note: 'Great day' },
    });
  });
});

describe('scheduleTaskAt', () => {
  it('does nothing when the task is not found', async () => {
    db.task.findUnique.mockResolvedValue(null as never);
    await scheduleTaskAt('t1', '09:30');
    expect(db.task.update).not.toHaveBeenCalled();
  });

  it('clears the slot on a null or invalid time', async () => {
    db.task.findUnique.mockResolvedValue({ date: '2026-06-14' } as never);
    await scheduleTaskAt('t1', 'nope');
    expect(db.task.update).toHaveBeenCalledWith({
      where: { id: 't1' },
      data: { scheduledFor: null },
    });
  });

  it('sets a Date from a valid HH:MM', async () => {
    db.task.findUnique.mockResolvedValue({ date: '2026-06-14' } as never);
    await scheduleTaskAt('t1', '09:30');
    const arg = db.task.update.mock.calls[0][0] as { data: { scheduledFor: Date } };
    expect(arg.data.scheduledFor).toBeInstanceOf(Date);
  });
});

describe('addTomorrowTask', () => {
  it('ignores an empty title', async () => {
    await addTomorrowTask('   ', false);
    expect(db.task.create).not.toHaveBeenCalled();
  });

  it('creates a fresh tomorrow task with no carry-over lookup', async () => {
    db.task.create.mockResolvedValue({ id: 'parent1' } as never);
    await addTomorrowTask('Write report', false);
    expect(db.task.findFirst).not.toHaveBeenCalled();
    const arg = db.task.create.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(arg.data.title).toBe('Write report');
    expect(arg.data.date).toBe('2026-06-15');
    expect(arg.data.carriedFrom).toBeNull();
    expect(db.task.createMany).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/');
  });

  it('creates subtasks under the parent when provided', async () => {
    db.task.create.mockResolvedValue({ id: 'parent1' } as never);
    await addTomorrowTask('Big task', false, undefined, ['step one', 'step two']);
    expect(db.task.createMany).toHaveBeenCalledTimes(1);
    const arg = db.task.createMany.mock.calls[0][0] as { data: Array<{ parentId: string }> };
    expect(arg.data).toHaveLength(2);
    expect(arg.data[0].parentId).toBe('parent1');
  });
});

describe('createPlan', () => {
  const valid = {
    title: 'Learn Go',
    goal: 'Ship a service',
    startDate: '2026-06-14',
    endDate: '2026-08-14',
    intensity: 'normal',
    milestones: [],
  };

  it('throws when the title or goal is missing', async () => {
    await expect(createPlan({ ...valid, title: '' } as never)).rejects.toThrow();
    await expect(createPlan({ ...valid, goal: '' } as never)).rejects.toThrow();
  });

  it('throws on an invalid date', async () => {
    await expect(createPlan({ ...valid, startDate: 'bad' } as never)).rejects.toThrow();
  });

  it('creates the plan and returns its id', async () => {
    db.plan.create.mockResolvedValue({ id: 'p1' } as never);
    const id = await createPlan(valid as never);
    expect(id).toBe('p1');
    expect(db.plan.create).toHaveBeenCalledTimes(1);
    expect(revalidatePath).toHaveBeenCalledWith('/plans');
  });
});
