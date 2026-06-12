import { prisma } from '@/lib/db';
import { todayStr } from '@/lib/dates';
import { getSettings } from '@/lib/notify/settings';
import { buildNotificationFacts } from '@/lib/notify/context';
import { compose } from '@/lib/notify/compose';
import { sendDiscord } from '@/lib/notify/discord';
import { isWithinWindow, minutesOfDay } from '@/lib/notify/time';
import type { NotificationKind } from '@/lib/types';

export interface RunResult {
  kind: NotificationKind;
  status: 'sent' | 'skipped' | 'error';
  detail: string;
}

/** Whether this kind is enabled in the config */
function isKindEnabled(
  kind: NotificationKind,
  s: Awaited<ReturnType<typeof getSettings>>,
): boolean {
  switch (kind) {
    case 'morning':
      return s.morningEnabled;
    case 'streak_guard':
      return s.streakGuardEnabled;
    case 'random_nudge':
      return s.randomNudgeEnabled;
    case 'evening':
      return s.eveningEnabled;
    case 'queue_nudge':
      return s.queueNudgeEnabled;
  }
}

/**
 * Run ONE notification (section 13). Shared by the cron and the "Test send" button.
 * - force = true (test send): bypass enabled/quiet-hours/idempotency and the natural gating.
 * - force = false (cron): check all conditions before sending, log to avoid duplicate sends.
 * Never throws — always returns a RunResult + writes a NotificationLog.
 */
export async function runNotification(
  kind: NotificationKind,
  opts: { force?: boolean } = {},
): Promise<RunResult> {
  const force = opts.force ?? false;
  const today = todayStr();

  const log = async (status: RunResult['status'], detail: string): Promise<RunResult> => {
    // don't let repeated successful "test sends" clutter the history —
    // still log for transparency, but mark it clearly in the detail
    await prisma.notificationLog
      .create({ data: { kind, date: today, status, detail: detail.slice(0, 500) } })
      .catch(() => {});
    return { kind, status, detail };
  };

  const settings = await getSettings();

  // ----- Pre-checks (only when not forced) -----
  if (!force) {
    if (!settings.enabled) return { kind, status: 'skipped', detail: 'Thông báo đang tắt' };
    if (!isKindEnabled(kind, settings))
      return { kind, status: 'skipped', detail: 'Loại này đang tắt' };

    // quiet hours — send nothing
    if (isWithinWindow(minutesOfDay(new Date()), settings.quietStart, settings.quietEnd)) {
      return { kind, status: 'skipped', detail: 'Đang trong giờ yên' };
    }

    // idempotency: if this kind was already sent successfully today, stop
    const already = await prisma.notificationLog.findFirst({
      where: { kind, date: today, status: 'sent' },
    });
    if (already) return { kind, status: 'skipped', detail: 'Đã gửi hôm nay' };
  }

  if (!settings.discordWebhookUrl) {
    return log('error', 'Chưa cấu hình webhook Discord');
  }

  // ----- Compose the content -----
  const facts = await buildNotificationFacts(kind);

  // fetch a few recently sent items so the AI avoids repeating a quote/tip
  const recent = await prisma.notificationLog.findMany({
    where: { status: 'sent' },
    orderBy: { sentAt: 'desc' },
    take: 12,
    select: { detail: true },
  });
  const recentMessages = recent.map((r) => r.detail).filter((d): d is string => !!d);

  const composed = await compose(facts, settings, recentMessages, force);

  if (!composed.shouldSend) {
    return log('skipped', composed.skipReason ?? 'Không cần gửi lúc này');
  }

  // ----- Send -----
  const res = await sendDiscord(settings.discordWebhookUrl, composed.message);
  if (!res.ok) {
    return log('error', res.error ?? `Gửi thất bại (HTTP ${res.status})`);
  }
  // cooldown the "Incubating" goal just nudged (section 17) → ranked lower next round, no back-to-back repeats
  if (kind === 'queue_nudge' && facts.topIncubatingGoalId) {
    await prisma.goal
      .update({ where: { id: facts.topIncubatingGoalId }, data: { lastNudgedAt: new Date() } })
      .catch(() => {});
  }
  return log('sent', composed.preview);
}
