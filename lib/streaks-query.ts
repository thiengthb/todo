import { cache } from 'react';
import { prisma } from '@/lib/db';

/**
 * Distinct dates that have ≥1 done task — the raw input for `computeStreaks`.
 * Wrapped in React `cache()` so the root layout (streak chip) and the Today/History pages share a
 * SINGLE query per request instead of each re-running the same `done` table scan.
 */
export const getActiveDoneDates = cache(async (): Promise<string[]> => {
  const rows = await prisma.task.findMany({
    where: { done: true },
    select: { date: true },
    distinct: ['date'],
  });
  return rows.map((r) => r.date);
});
