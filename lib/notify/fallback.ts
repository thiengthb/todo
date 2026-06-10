import type { NotificationVoice } from "@/lib/ai";
import type { NotificationFacts } from "@/lib/ai";

/**
 * Ngân hàng nội dung TĨNH — dùng khi AI lỗi/không có AI_API_KEY (degrade mượt, mục 11.1).
 * Thông báo vẫn hữu ích và giữ đúng tinh thần nâng đỡ, không hối thúc.
 */
const QUOTES = [
  "“Việc nhỏ làm đều còn hơn việc lớn làm một lần rồi bỏ.”",
  "“Bạn không cần thấy hết cầu thang, chỉ cần bước bước đầu tiên.” — Martin Luther King Jr.",
  "“Kỷ luật là chọn điều mình muốn nhất thay vì điều mình muốn ngay lúc này.”",
  "“Hoàn thành tốt hơn hoàn hảo.”",
  "“Một ngày trượt không xoá được cả tháng cố gắng. Cứ bắt đầu lại.”",
  "“Tiến bộ 1% mỗi ngày, một năm sau bạn giỏi hơn 37 lần.” — James Clear",
];

const TIPS = [
  "Mẹo: việc nào dưới 2 phút thì làm luôn, đừng ghi vào danh sách.",
  "Mẹo: chia việc lớn thành bước đầu tiên thật nhỏ — chỉ cần “mở file ra”.",
  "Mẹo: chọn 1 việc quan trọng nhất hôm nay, làm nó trước khi mở điện thoại.",
  "Mẹo: gắn việc mới vào một thói quen sẵn có (“sau khi pha cà phê, mình sẽ…”).",
  "Mẹo: đặt một mốc cụ thể “khi nào / ở đâu” sẽ làm — dễ bắt tay hơn nhiều.",
];

/** Chọn phần tử theo seed ổn định trong ngày (tránh Math.random để dễ đoán/đỡ lặp) */
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function seedFrom(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h;
}

/** Soạn thông báo tĩnh khi không gọi được AI */
export function fallbackVoice(
  f: NotificationFacts,
  include: { motivation: boolean; quote: boolean; tip: boolean },
  seedKey: string,
): NotificationVoice {
  const seed = seedFrom(seedKey + f.kind);
  let message: string;
  switch (f.kind) {
    case "morning":
      message = f.mitTitle
        ? `Chào ngày mới ☀️ Hôm nay nếu chỉ làm một việc, hãy thử bắt đầu với “${f.mitTitle}”.`
        : "Chào ngày mới ☀️ Cứ chọn một việc nhỏ để khởi động nhẹ nhàng nhé.";
      break;
    case "streak_guard":
      message =
        f.streakCurrent > 0
          ? `Bạn đang giữ chuỗi ${f.streakCurrent} ngày 🌱 Chỉ cần làm một việc nhỏ hôm nay là giữ được thành quả này.`
          : "Chưa có việc nào hôm nay cũng không sao — làm một việc nhỏ để bắt đầu một chuỗi mới nhé 🌱";
      break;
    case "random_nudge":
      message =
        f.sampleUndone.length > 0
          ? `Rảnh một chút thì thử bắt tay vào “${f.sampleUndone[0]}” xem sao? Chỉ cần bước đầu thôi.`
          : "Mọi việc hôm nay ổn cả rồi 👏 Cứ nghỉ ngơi một chút nhé.";
      break;
    case "evening":
      message =
        f.doneCount > 0
          ? `Hôm nay bạn đã xong ${f.doneCount} việc — ghi lại một dòng cảm nhận trước khi nghỉ nhé. Làm tốt lắm 🌙`
          : "Một ngày trôi qua nhẹ nhàng. Mai mình bắt đầu lại từ một việc nhỏ là được 🌙";
      break;
  }
  return {
    message,
    quote: include.quote ? pick(QUOTES, seed) : null,
    tip: include.tip ? pick(TIPS, seed + 7) : null,
  };
}
