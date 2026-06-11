'use server';

import { revalidatePath } from 'next/cache';
import { saveSettings } from '@/lib/notify/settings';
import { runNotification, type RunResult } from '@/lib/notify/run';
import { isValidHm } from '@/lib/notify/time';
import type { NotificationIntensity, NotificationKind, NotificationSettingsDTO } from '@/lib/types';

const INTENSITIES: NotificationIntensity[] = ['minimal', 'balanced', 'active'];
const KINDS: NotificationKind[] = ['morning', 'streak_guard', 'random_nudge', 'evening'];

/** Lưu cấu hình thông báo. Ép kiểu/định dạng giờ về an toàn trước khi ghi DB. */
export async function saveNotificationSettings(
  input: NotificationSettingsDTO,
): Promise<{ ok: boolean; error?: string }> {
  // chỉ nhận HH:MM hợp lệ; sai thì giữ giá trị mặc định an toàn
  const time = (v: string, fallback: string) => (isValidHm(v) ? v : fallback);
  const intensity: NotificationIntensity = INTENSITIES.includes(input.intensity)
    ? input.intensity
    : 'balanced';

  const safe: NotificationSettingsDTO = {
    enabled: !!input.enabled,
    discordWebhookUrl: (input.discordWebhookUrl ?? '').trim(),
    intensity,
    morningEnabled: !!input.morningEnabled,
    morningTime: time(input.morningTime, '07:30'),
    streakGuardEnabled: !!input.streakGuardEnabled,
    streakGuardTime: time(input.streakGuardTime, '20:00'),
    randomNudgeEnabled: !!input.randomNudgeEnabled,
    eveningEnabled: !!input.eveningEnabled,
    eveningTime: time(input.eveningTime, '21:30'),
    randomWindowStart: time(input.randomWindowStart, '09:00'),
    randomWindowEnd: time(input.randomWindowEnd, '18:00'),
    quietStart: time(input.quietStart, '22:00'),
    quietEnd: time(input.quietEnd, '07:00'),
    includeMotivation: !!input.includeMotivation,
    includeQuote: !!input.includeQuote,
    includeTip: !!input.includeTip,
  };

  // bật thông báo mà chưa có webhook → báo lỗi rõ ràng
  if (safe.enabled && !safe.discordWebhookUrl && !process.env.DISCORD_WEBHOOK_URL) {
    return { ok: false, error: 'Cần dán Webhook URL trước khi bật thông báo.' };
  }

  await saveSettings(safe);
  revalidatePath('/notifications');
  return { ok: true };
}

/** Gửi thử một loại thông báo ngay lập tức (bỏ qua gating). */
export async function sendTestNotification(kind: NotificationKind): Promise<RunResult> {
  if (!KINDS.includes(kind)) {
    return { kind: 'morning', status: 'error', detail: 'Loại không hợp lệ' };
  }
  const result = await runNotification(kind, { force: true });
  revalidatePath('/notifications');
  return result;
}
