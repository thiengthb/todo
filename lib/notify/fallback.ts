import type { NotificationVoice } from '@/lib/ai';
import type { NotificationFacts } from '@/lib/ai';

/**
 * STATIC content bank — used when the AI fails / there's no AI_API_KEY (graceful degrade, section 11.1).
 * The notification is still useful and keeps the supportive, non-pushy spirit.
 */
const QUOTES = [
  '“Việc nhỏ làm đều còn hơn việc lớn làm một lần rồi bỏ.”',
  '“Bạn không cần thấy hết cầu thang, chỉ cần bước bước đầu tiên.” — Martin Luther King Jr.',
  '“Kỷ luật là chọn điều mình muốn nhất thay vì điều mình muốn ngay lúc này.”',
  '“Hoàn thành tốt hơn hoàn hảo.”',
  '“Một ngày trượt không xoá được cả tháng cố gắng. Cứ bắt đầu lại.”',
  '“Tiến bộ 1% mỗi ngày, một năm sau bạn giỏi hơn 37 lần.” — James Clear',
];

const TIPS = [
  'Mẹo: việc nào dưới 2 phút thì làm luôn, đừng ghi vào danh sách.',
  'Mẹo: chia việc lớn thành bước đầu tiên thật nhỏ — chỉ cần “mở file ra”.',
  'Mẹo: chọn 1 việc quan trọng nhất hôm nay, làm nó trước khi mở điện thoại.',
  'Mẹo: gắn việc mới vào một thói quen sẵn có (“sau khi pha cà phê, mình sẽ…”).',
  'Mẹo: đặt một mốc cụ thể “khi nào / ở đâu” sẽ làm — dễ bắt tay hơn nhiều.',
];

/** Pick an element by a seed stable within the day (avoid Math.random for predictability/less repetition) */
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Compose a static notification when the AI can't be called */
export function fallbackVoice(
  f: NotificationFacts,
  include: { motivation: boolean; quote: boolean; tip: boolean },
  seedKey: string,
): NotificationVoice {
  const seed = seedFrom(seedKey + f.kind);
  let message: string;
  switch (f.kind) {
    case 'morning': {
      const sched =
        f.todaySchedule.length > 0
          ? ` Hôm nay có ${f.todaySchedule.length} lịch cứng, còn ~${Math.round(f.freeMinutesToday / 60)}h rảnh.`
          : '';
      message =
        (f.mitTitle
          ? `Chào ngày mới ☀️ Nếu chỉ làm một việc, hãy thử bắt đầu với “${f.mitTitle}”.`
          : 'Chào ngày mới ☀️ Cứ chọn một việc nhỏ để khởi động nhẹ nhàng nhé.') + sched;
      break;
    }
    case 'streak_guard':
      message =
        f.streakCurrent > 0
          ? `Bạn đang giữ chuỗi ${f.streakCurrent} ngày 🌱 Chỉ cần làm một việc nhỏ hôm nay là giữ được thành quả này.`
          : 'Chưa có việc nào hôm nay cũng không sao — làm một việc nhỏ để bắt đầu một chuỗi mới nhé 🌱';
      break;
    case 'random_nudge':
      message =
        f.sampleUndone.length > 0
          ? `Rảnh một chút thì thử bắt tay vào “${f.sampleUndone[0]}” xem sao? Chỉ cần bước đầu thôi.`
          : 'Mọi việc hôm nay ổn cả rồi 👏 Cứ nghỉ ngơi một chút nhé.';
      break;
    case 'evening':
      message =
        f.doneCount > 0
          ? `Hôm nay bạn đã xong ${f.doneCount} việc — ghi lại một dòng cảm nhận trước khi nghỉ nhé. Làm tốt lắm 🌙`
          : 'Một ngày trôi qua nhẹ nhàng. Mai mình bắt đầu lại từ một việc nhỏ là được 🌙';
      break;
    case 'queue_nudge':
      message = f.topIncubatingGoal
        ? `Bạn đang có chút thời gian rảnh 🌿 Hay là lấy “${f.topIncubatingGoal}” trong mục Ấp ủ ra làm thử? Chỉ một bước nhỏ thôi.`
        : 'Bạn đang có chút thời gian rảnh 🌿 Ngó qua mục Ấp ủ xem có điều gì muốn bắt đầu không nhé.';
      break;
  }
  return {
    message,
    quote: include.quote ? pick(QUOTES, seed) : null,
    tip: include.tip ? pick(TIPS, seed + 7) : null,
  };
}
