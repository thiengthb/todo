import { composeNotificationVoice, type NotificationFacts, type NotificationVoice } from '@/lib/ai';
import { fallbackVoice } from '@/lib/notify/fallback';
import type { DiscordMessage } from '@/lib/notify/discord';
import type { NotificationKind, NotificationSettingsDTO } from '@/lib/types';

const COLOR: Record<NotificationKind, number> = {
  morning: 0x10b981, // emerald — khởi đầu tích cực
  streak_guard: 0xf59e0b, // amber — tín hiệu nhẹ "cần giữ"
  random_nudge: 0x64748b, // slate trung tính
  evening: 0x6366f1, // indigo dịu cho buổi tối
  queue_nudge: 0x14b8a6, // teal — cơ hội nhẹ nhàng (mục 17)
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
  /** xem trước ngắn để ghi log */
  preview: string;
}

/**
 * Quyết định CÓ nên gửi không (gating tự nhiên) + soạn nội dung embed.
 * `force` (gửi thử) bỏ qua gating — luôn tạo message để người dùng xem mẫu.
 */
export async function compose(
  facts: NotificationFacts,
  settings: NotificationSettingsDTO,
  recentMessages: string[],
  force: boolean,
): Promise<Composed> {
  // ----- Gating tự nhiên theo từng loại (mục 11: không phiền nhiễu) -----
  let shouldSend = true;
  let skipReason: string | undefined;
  if (!force) {
    if (facts.kind === 'streak_guard') {
      // chỉ nhắc khi chuỗi thật sự nguy hiểm và hôm nay chưa làm gì
      if (!facts.streakAtRisk || facts.doneCount > 0) {
        shouldSend = false;
        skipReason = facts.doneCount > 0 ? 'Hôm nay đã có việc xong' : 'Chuỗi đang an toàn';
      }
    } else if (facts.kind === 'random_nudge') {
      // không có việc dở thì không hích (đừng làm phiền khi chẳng có gì để làm)
      if (facts.undoneCount === 0) {
        shouldSend = false;
        skipReason = 'Không còn việc dở để nhắc';
      }
    } else if (facts.kind === 'queue_nudge') {
      // CƠ HỘI, không nghĩa vụ (mục 17): chỉ nhắc khi còn mục Ấp ủ + quỹ giờ rảnh đủ rộng + sức không thấp
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

  // ----- Giọng văn: AI trước, lỗi thì fallback tĩnh (degrade mượt) -----
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

  // ----- Dựng embed -----
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

/** Dòng dữ kiện thật, gắn dưới phần giọng văn để minh bạch (mục 11.1) */
function buildFactLine(f: NotificationFacts): string {
  const bits: string[] = [];
  if (f.totalCount > 0) bits.push(`✅ ${f.doneCount}/${f.totalCount} việc hôm nay`);
  if (f.streakCurrent > 0) bits.push(`🔥 chuỗi ${f.streakCurrent} ngày`);
  if (f.behindPlans.length > 0) bits.push(`📌 kế hoạch chậm: ${f.behindPlans.join(', ')}`);
  // minh bạch cho nudge Ấp ủ (mục 17): số điều ấp ủ + quỹ giờ rảnh thật
  if (f.kind === 'queue_nudge') {
    if (f.incubatingCount > 0) bits.push(`🌿 ${f.incubatingCount} điều đang ấp ủ`);
    if (f.freeMinutesToday > 0)
      bits.push(`🕒 ~${Math.round(f.freeMinutesToday / 60)}h rảnh hôm nay`);
  }
  return bits.join('  ·  ');
}
