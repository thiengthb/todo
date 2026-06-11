import cron, { type ScheduledTask } from 'node-cron';
import { todayStr } from '@/lib/dates';
import { getSettings } from '@/lib/notify/settings';
import { runNotification } from '@/lib/notify/run';
import { toHm, minutesOfDay, randomNudgeTargetMinute } from '@/lib/notify/time';
import type { NotificationKind } from '@/lib/types';

// tránh đăng ký nhiều lần khi Next hot-reload ở dev (giống singleton Prisma)
const g = globalThis as unknown as { __notifyCron?: ScheduledTask };

/**
 * Tick mỗi phút: so giờ hiện tại với cấu hình, bắn loại nào tới giờ.
 * Mỗi phút query DB một lần (SQLite, rất nhẹ) nên đổi cấu hình có hiệu lực ngay,
 * không cần đăng ký lại cron. runNotification tự lo idempotency + giờ yên + log.
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
  // nhắc "Ấp ủ" (mục 17): cùng cửa randomWindow nhưng seed KHÁC ngày để không trùng phút random_nudge
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

/** Khởi động scheduler một lần cho mỗi tiến trình server (gọi từ instrumentation.ts) */
export function startScheduler(): void {
  if (g.__notifyCron) return;
  g.__notifyCron = cron.schedule('* * * * *', () => {
    tick().catch(() => {});
  });
  // log gọn để biết scheduler đã sống (xuất hiện trong log container)
  console.log('[notify] scheduler started (tick mỗi phút)');
}
