/**
 * Suy ĐỘNG "độ khó" từ lịch sử cảm xúc (mục 11) — không lưu cột cứng, giống delay/streak.
 *
 * Ý tưởng (reference-class / outside-view chống planning fallacy): nhóm các task đã chấm
 * cảm xúc theo từ khóa trong tiêu đề; chủ đề hay bị chấm "hard" → AI nên hạ rào / chia nhỏ,
 * chủ đề hay "love" → AI có thể tận dụng đà. Đây chỉ là GỢI Ý best-effort; AI vẫn nhìn cả
 * danh sách task thật để tự suy luận.
 */

// Từ nối/chung chung tiếng Việt — bỏ để giữ lại từ mang nghĩa chủ đề
const STOPWORDS = new Set([
  "và",
  "cho",
  "các",
  "một",
  "của",
  "với",
  "the",
  "bài",
  "lại",
  "xong",
  "tiếp",
  "thêm",
  "phần",
  "chút",
  "nửa",
  "buổi",
  "ngày",
  "hôm",
]);

/** Tách tiêu đề thành các "từ khóa" thô (≥3 ký tự, bỏ stopword) */
function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export interface DifficultyHints {
  /** chủ đề thường được chấm "hard" → nên hạ rào / chia nhỏ */
  hardTopics: string[];
  /** chủ đề thường được chấm "love" (dễ/thích) → tận dụng đà */
  easyTopics: string[];
  /** chủ đề thường mất LÂU hơn ước lượng (actualBucket="slower") → AI cộng giờ */
  slowTopics: string[];
  /** chủ đề thường NHANH hơn ước lượng (actualBucket="faster") */
  fastTopics: string[];
  /** số task đã chấm cảm xúc dùng để suy ra (độ tin cậy) */
  samples: number;
}

/**
 * @param rated  các task ĐÃ chấm cảm xúc (done + emotion != null) trong cửa sổ gần đây;
 *               `actualBucket` (mục 14) tùy chọn — thiếu thì slow/fast rỗng (degrade mượt).
 */
export function computeDifficultyHints(
  rated: {
    title: string;
    emotion: string | null;
    actualBucket?: string | null;
  }[],
): DifficultyHints {
  // gom theo keyword: đếm số lần hard / love / slow / fast / tổng
  const byWord = new Map<
    string,
    { hard: number; love: number; slow: number; fast: number; total: number }
  >();
  let samples = 0;

  for (const t of rated) {
    if (!t.emotion && !t.actualBucket) continue;
    samples += 1;
    const seen = new Set(keywords(t.title)); // mỗi task tính 1 lần/từ
    for (const w of seen) {
      const c = byWord.get(w) ?? {
        hard: 0,
        love: 0,
        slow: 0,
        fast: 0,
        total: 0,
      };
      c.total += 1;
      if (t.emotion === "hard") c.hard += 1;
      if (t.emotion === "love") c.love += 1;
      if (t.actualBucket === "slower") c.slow += 1;
      if (t.actualBucket === "faster") c.fast += 1;
      byWord.set(w, c);
    }
  }

  // chỉ giữ chủ đề xuất hiện ≥2 lần để tránh nhiễu; ngưỡng skew 50%
  const hardTopics: string[] = [];
  const easyTopics: string[] = [];
  const slowTopics: string[] = [];
  const fastTopics: string[] = [];
  for (const [word, c] of byWord) {
    if (c.total < 2) continue;
    if (c.hard / c.total >= 0.5) hardTopics.push(word);
    else if (c.love / c.total >= 0.5) easyTopics.push(word);
    if (c.slow / c.total >= 0.5) slowTopics.push(word);
    else if (c.fast / c.total >= 0.5) fastTopics.push(word);
  }

  return {
    hardTopics: hardTopics.slice(0, 8),
    easyTopics: easyTopics.slice(0, 8),
    slowTopics: slowTopics.slice(0, 8),
    fastTopics: fastTopics.slice(0, 8),
    samples,
  };
}
