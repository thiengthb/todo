import { prisma } from '@/lib/db';
import type { NotificationIntensity, NotificationSettingsDTO } from '@/lib/types';

const SINGLETON_ID = 'singleton';

/** Default values when there is no row in the DB yet (matches the schema defaults) */
const DEFAULTS: NotificationSettingsDTO = {
  enabled: false,
  discordWebhookUrl: '',
  intensity: 'balanced',
  morningEnabled: true,
  morningTime: '07:30',
  streakGuardEnabled: true,
  streakGuardTime: '20:00',
  randomNudgeEnabled: true,
  eveningEnabled: false,
  eveningTime: '21:30',
  queueNudgeEnabled: true,
  randomWindowStart: '09:00',
  randomWindowEnd: '18:00',
  quietStart: '22:00',
  quietEnd: '07:00',
  includeMotivation: true,
  includeQuote: true,
  includeTip: true,
};

/**
 * Read the config (1 singleton row). If none exists, return defaults.
 * Webhook prefers the DB; if the DB is empty, fall back to the DISCORD_WEBHOOK_URL env var.
 */
export async function getSettings(): Promise<NotificationSettingsDTO> {
  const row = await prisma.notificationSettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!row) {
    return {
      ...DEFAULTS,
      discordWebhookUrl: process.env.DISCORD_WEBHOOK_URL ?? '',
    };
  }
  return {
    enabled: row.enabled,
    discordWebhookUrl: row.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL || '',
    intensity: row.intensity as NotificationIntensity,
    morningEnabled: row.morningEnabled,
    morningTime: row.morningTime,
    streakGuardEnabled: row.streakGuardEnabled,
    streakGuardTime: row.streakGuardTime,
    randomNudgeEnabled: row.randomNudgeEnabled,
    eveningEnabled: row.eveningEnabled,
    eveningTime: row.eveningTime,
    queueNudgeEnabled: row.queueNudgeEnabled,
    randomWindowStart: row.randomWindowStart,
    randomWindowEnd: row.randomWindowEnd,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
    includeMotivation: row.includeMotivation,
    includeQuote: row.includeQuote,
    includeTip: row.includeTip,
  };
}

/** Save the config (upsert the singleton row). Webhook stored verbatim (empty = use env). */
export async function saveSettings(data: NotificationSettingsDTO): Promise<void> {
  const payload = {
    enabled: data.enabled,
    discordWebhookUrl: data.discordWebhookUrl.trim() || null,
    intensity: data.intensity,
    morningEnabled: data.morningEnabled,
    morningTime: data.morningTime,
    streakGuardEnabled: data.streakGuardEnabled,
    streakGuardTime: data.streakGuardTime,
    randomNudgeEnabled: data.randomNudgeEnabled,
    eveningEnabled: data.eveningEnabled,
    eveningTime: data.eveningTime,
    queueNudgeEnabled: data.queueNudgeEnabled,
    randomWindowStart: data.randomWindowStart,
    randomWindowEnd: data.randomWindowEnd,
    quietStart: data.quietStart,
    quietEnd: data.quietEnd,
    includeMotivation: data.includeMotivation,
    includeQuote: data.includeQuote,
    includeTip: data.includeTip,
  };
  await prisma.notificationSettings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID, ...payload },
    update: payload,
  });
}

export { DEFAULTS as DEFAULT_SETTINGS };
