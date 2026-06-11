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

/** Loại có bật trong cấu hình không */
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
 * Chạy MỘT thông báo (mục 13). Dùng chung cho cron lẫn nút "Gửi thử".
 * - force = true (gửi thử): bỏ qua enabled/quiet-hours/idempotency và gating tự nhiên.
 * - force = false (cron): kiểm tra đủ điều kiện rồi mới gửi, ghi log để tránh gửi trùng.
 * Không bao giờ ném lỗi — luôn trả RunResult + ghi NotificationLog.
 */
export async function runNotification(
  kind: NotificationKind,
  opts: { force?: boolean } = {},
): Promise<RunResult> {
  const force = opts.force ?? false;
  const today = todayStr();

  const log = async (status: RunResult['status'], detail: string): Promise<RunResult> => {
    // không ghi log cho lần "gửi thử" thành công nhiều lần làm nhiễu lịch sử —
    // vẫn ghi để minh bạch, nhưng đánh dấu rõ trong detail
    await prisma.notificationLog
      .create({ data: { kind, date: today, status, detail: detail.slice(0, 500) } })
      .catch(() => {});
    return { kind, status, detail };
  };

  const settings = await getSettings();

  // ----- Tiền kiểm tra (chỉ khi không force) -----
  if (!force) {
    if (!settings.enabled) return { kind, status: 'skipped', detail: 'Thông báo đang tắt' };
    if (!isKindEnabled(kind, settings))
      return { kind, status: 'skipped', detail: 'Loại này đang tắt' };

    // giờ yên — không bắn gì
    if (isWithinWindow(minutesOfDay(new Date()), settings.quietStart, settings.quietEnd)) {
      return { kind, status: 'skipped', detail: 'Đang trong giờ yên' };
    }

    // idempotency: đã gửi thành công loại này hôm nay rồi thì thôi
    const already = await prisma.notificationLog.findFirst({
      where: { kind, date: today, status: 'sent' },
    });
    if (already) return { kind, status: 'skipped', detail: 'Đã gửi hôm nay' };
  }

  if (!settings.discordWebhookUrl) {
    return log('error', 'Chưa cấu hình webhook Discord');
  }

  // ----- Soạn nội dung -----
  const facts = await buildNotificationFacts(kind);

  // lấy vài nội dung đã gửi gần đây để AI tránh lặp câu nói/tip
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

  // ----- Gửi -----
  const res = await sendDiscord(settings.discordWebhookUrl, composed.message);
  if (!res.ok) {
    return log('error', res.error ?? `Gửi thất bại (HTTP ${res.status})`);
  }
  // cooldown mục tiêu "Ấp ủ" vừa nhắc (mục 17) → vòng sau xếp hạng thấp, không lặp lại liên tục
  if (kind === 'queue_nudge' && facts.topIncubatingGoalId) {
    await prisma.goal
      .update({ where: { id: facts.topIncubatingGoalId }, data: { lastNudgedAt: new Date() } })
      .catch(() => {});
  }
  return log('sent', composed.preview);
}
