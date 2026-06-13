import { cache } from 'react';
import { prisma } from '@/lib/db';
import type { ScheduleSettingsDTO } from '@/lib/types';

const SINGLETON_ID = 'singleton';

/** Defaults when there is no row yet (matches the schema defaults + the old 07–23h constants) */
export const DEFAULT_SCHEDULE_SETTINGS: ScheduleSettingsDTO = {
  wakeTime: '07:00',
  sleepTime: '23:00',
  bufferMin: 15,
  minSlotMin: 30,
  termAnchorMonday: null,
};

/**
 * Read the schedule config (1 singleton row). None → return defaults.
 * Wrapped in React `cache()` so the Today page, the Schedule page and the suggest route each
 * de-duplicate the lookup within a single render (the row almost never changes).
 */
export const getScheduleSettings = cache(async (): Promise<ScheduleSettingsDTO> => {
  const row = await prisma.scheduleSettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!row) return { ...DEFAULT_SCHEDULE_SETTINGS };
  return {
    wakeTime: row.wakeTime,
    sleepTime: row.sleepTime,
    bufferMin: row.bufferMin,
    minSlotMin: row.minSlotMin,
    termAnchorMonday: row.termAnchorMonday,
  };
});

/** Save the schedule config (upsert the singleton row). */
export async function saveScheduleSettings(data: ScheduleSettingsDTO): Promise<void> {
  const payload = {
    wakeTime: data.wakeTime,
    sleepTime: data.sleepTime,
    bufferMin: data.bufferMin,
    minSlotMin: data.minSlotMin,
    termAnchorMonday: data.termAnchorMonday?.trim() || null,
  };
  await prisma.scheduleSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...payload },
    update: payload,
  });
}
