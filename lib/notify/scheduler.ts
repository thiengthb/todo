import cron, { type ScheduledTask } from 'node-cron';
import { todayStr } from '@/lib/dates';
import { getSettings } from '@/lib/notify/settings';
import { runNotification } from '@/lib/notify/run';
import { toHm, minutesOfDay, randomNudgeTargetMinute } from '@/lib/notify/time';
import type { NotificationKind } from '@/lib/types';

// avoid registering multiple times during Next hot-reload in dev (like the Prisma singleton)
const g = globalThis as unknown as { __notifyCron?: ScheduledTask };

/**
 * Tick every minute: compare the current time with the config, fire whichever kind is due.
 * One DB query per minute (SQLite, very light) so config changes take effect immediately,
 * with no need to re-register the cron. runNotification handles idempotency + quiet hours + logging.
 */
async function tick(): Promise<void> {
  const settings = await getSettings();
  if (!settings.enabled || !settings.discordWebhookUrl) return;

  const now = new Date();
  const hm = toHm(now);
  const nowMin = minutesOfDay(now);

  const due: NotificationKind[] = [];
  if (settings.morningEnabled && hm === settings.morningTime) due.push('morning');
  if (settings.streakGuardEnabled && hm === settings.streakGuardTime) due.push('streak_guard');
  if (settings.eveningEnabled && hm === settings.eveningTime) due.push('evening');
  if (settings.randomNudgeEnabled) {
    const target = randomNudgeTargetMinute(
      todayStr(),
      settings.randomWindowStart,
      settings.randomWindowEnd,
    );
    if (target >= 0 && nowMin === target) due.push('random_nudge');
  }
  // "Incubating" reminder (section 17): same randomWindow window but a DIFFERENT day seed so it doesn't collide with the random_nudge minute
  if (settings.queueNudgeEnabled) {
    const target = randomNudgeTargetMinute(
      `${todayStr()}#queue`,
      settings.randomWindowStart,
      settings.randomWindowEnd,
    );
    if (target >= 0 && nowMin === target) due.push('queue_nudge');
  }

  for (const kind of due) {
    await runNotification(kind).catch(() => {});
  }
}

/** Start the scheduler once per server process (called from instrumentation.ts) */
export function startScheduler(): void {
  if (g.__notifyCron) return;
  g.__notifyCron = cron.schedule('* * * * *', () => {
    tick().catch(() => {});
  });
  // brief log to confirm the scheduler is alive (shows up in the container logs)
  console.log('[notify] scheduler started (tick mỗi phút)');
}
