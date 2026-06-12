import { composeNotificationVoice, type NotificationFacts, type NotificationVoice } from '@/lib/ai';
import { fallbackVoice } from '@/lib/notify/fallback';
import type { DiscordMessage } from '@/lib/notify/discord';
import type { NotificationKind, NotificationSettingsDTO } from '@/lib/types';

const COLOR: Record<NotificationKind, number> = {
  morning: 0x10b981, // emerald — a positive start
  streak_guard: 0xf59e0b, // amber — a gentle "needs keeping" signal
  random_nudge: 0x64748b, // neutral slate
  evening: 0x6366f1, // soft indigo for the evening
  queue_nudge: 0x14b8a6, // teal — a gentle opportunity (section 17)
};

const TITLE: Record<NotificationKind, string> = {
  morning: '☀️ Bản tin sáng',
  streak_guard: '🌱 Giữ chuỗi của bạn',
  random_nudge: '👋 Một cú hích nhẹ',
  evening: '🌙 Đúc kết tối',
  queue_nudge: '🌿 Lúc rảnh — điều bạn ấp ủ',
};

export interface Composed {
  shouldSend: boolean;
  skipReason?: string;
  message: DiscordMessage;
  /** short preview for logging */
  preview: string;
}

/**
 * Decide WHETHER to send (natural gating) + compose the embed content.
 * `force` (test send) bypasses gating — always builds a message so the user can preview a sample.
 */
export async function compose(
  facts: NotificationFacts,
  settings: NotificationSettingsDTO,
  recentMessages: string[],
  force: boolean,
): Promise<Composed> {
  // ----- Natural per-kind gating (section 11: don't be annoying) -----
  let shouldSend = true;
  let skipReason: string | undefined;
  if (!force) {
    if (facts.kind === 'streak_guard') {
      // only remind when the streak is truly at risk and nothing was done today
      if (!facts.streakAtRisk || facts.doneCount > 0) {
        shouldSend = false;
        skipReason = facts.doneCount > 0 ? 'Hôm nay đã có việc xong' : 'Chuỗi đang an toàn';
      }
    } else if (facts.kind === 'random_nudge') {
      // no unfinished tasks → no nudge (don't bother when there's nothing to do)
      if (facts.undoneCount === 0) {
        shouldSend = false;
        skipReason = 'Không còn việc dở để nhắc';
      }
    } else if (facts.kind === 'queue_nudge') {
      // OPPORTUNITY, not obligation (section 17): only remind when there are Incubating items + a wide enough free budget + energy not low
      if (facts.incubatingCount === 0) {
        shouldSend = false;
        skipReason = 'Không có mục tiêu nào đang ấp ủ';
      } else if (facts.freeMinutesToday < 90) {
        shouldSend = false;
        skipReason = 'Quỹ giờ rảnh hôm nay không nhiều';
      } else if (facts.capacityScore != null && facts.capacityScore < 40) {
        shouldSend = false;
        skipReason = 'Sức hôm nay đang thấp — để bạn nghỉ';
      }
    }
  }

  // ----- Voice: AI first, on error fall back to static (graceful degrade) -----
  const seedKey = `${facts.doneCount}-${facts.undoneCount}-${facts.streakCurrent}`;
  const include = {
    motivation: settings.includeMotivation,
    quote: settings.includeQuote,
    tip: settings.includeTip,
  };
  let voice: NotificationVoice;
  try {
    voice = await composeNotificationVoice({ facts, include, recentMessages });
  } catch {
    voice = fallbackVoice(facts, include, seedKey);
  }

  // ----- Build the embed -----
  const factLine = buildFactLine(facts);
  const parts = [voice.message];
  if (factLine) parts.push(`\n${factLine}`);
  if (voice.quote) parts.push(`\n> ${voice.quote}`);
  if (voice.tip) parts.push(`\n${voice.tip}`);
  const description = parts.join('\n').trim();

  const message: DiscordMessage = {
    embeds: [
      {
        title: TITLE[facts.kind] + (force ? ' · (thử)' : ''),
        description,
        color: COLOR[facts.kind],
        footer: { text: 'Smart Todo' },
      },
    ],
  };

  return {
    shouldSend,
    skipReason,
    message,
    preview: voice.message.slice(0, 180),
  };
}

/** A line of real facts, attached under the voice for transparency (section 11.1) */
function buildFactLine(f: NotificationFacts): string {
  const bits: string[] = [];
  if (f.totalCount > 0) bits.push(`✅ ${f.doneCount}/${f.totalCount} việc hôm nay`);
  if (f.streakCurrent > 0) bits.push(`🔥 chuỗi ${f.streakCurrent} ngày`);
  if (f.behindPlans.length > 0) bits.push(`📌 kế hoạch chậm: ${f.behindPlans.join(', ')}`);
  // transparency for the Incubating nudge (section 17): number of incubating items + real free budget
  if (f.kind === 'queue_nudge') {
    if (f.incubatingCount > 0) bits.push(`🌿 ${f.incubatingCount} điều đang ấp ủ`);
    if (f.freeMinutesToday > 0)
      bits.push(`🕒 ~${Math.round(f.freeMinutesToday / 60)}h rảnh hôm nay`);
  }
  return bits.join('  ·  ');
}
