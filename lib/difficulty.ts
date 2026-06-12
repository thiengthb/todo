/**
 * Infer "difficulty" DYNAMICALLY from emotion history (section 11) — not stored in a column, like delay/streak.
 *
 * Idea (reference-class / outside-view against the planning fallacy): group emotion-rated tasks
 * by keywords in the title; topics often rated "hard" → the AI should lower the bar / break them down,
 * topics often "love" → the AI can ride the momentum. This is a best-effort HINT only; the AI still looks at
 * the whole real task list to reason for itself.
 */

// Vietnamese conjunctions/generic words — dropped to keep words that carry topic meaning
const STOPWORDS = new Set([
  'và',
  'cho',
  'các',
  'một',
  'của',
  'với',
  'the',
  'bài',
  'lại',
  'xong',
  'tiếp',
  'thêm',
  'phần',
  'chút',
  'nửa',
  'buổi',
  'ngày',
  'hôm',
]);

/** Split a title into rough "keywords" (≥3 chars, dropping stopwords) */
function keywords(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

export interface DifficultyHints {
  /** topics often rated "hard" → should lower the bar / break down */
  hardTopics: string[];
  /** topics often rated "love" (easy/liked) → ride the momentum */
  easyTopics: string[];
  /** topics that usually take LONGER than estimated (actualBucket="slower") → AI adds time */
  slowTopics: string[];
  /** topics that are usually FASTER than estimated (actualBucket="faster") */
  fastTopics: string[];
  /** number of emotion-rated tasks used to infer this (confidence) */
  samples: number;
}

/**
 * @param rated  tasks that HAVE been emotion-rated (done + emotion != null) within the recent window;
 *               `actualBucket` (section 14) optional — if absent, slow/fast are empty (graceful degrade).
 */
export function computeDifficultyHints(
  rated: {
    title: string;
    emotion: string | null;
    actualBucket?: string | null;
  }[],
): DifficultyHints {
  // group by keyword: count occurrences of hard / love / slow / fast / total
  const byWord = new Map<
    string,
    { hard: number; love: number; slow: number; fast: number; total: number }
  >();
  let samples = 0;

  for (const t of rated) {
    if (!t.emotion && !t.actualBucket) continue;
    samples += 1;
    const seen = new Set(keywords(t.title)); // count each task once per word
    for (const w of seen) {
      const c = byWord.get(w) ?? {
        hard: 0,
        love: 0,
        slow: 0,
        fast: 0,
        total: 0,
      };
      c.total += 1;
      if (t.emotion === 'hard') c.hard += 1;
      if (t.emotion === 'love') c.love += 1;
      if (t.actualBucket === 'slower') c.slow += 1;
      if (t.actualBucket === 'faster') c.fast += 1;
      byWord.set(w, c);
    }
  }

  // keep only topics appearing ≥2 times to avoid noise; skew threshold 50%
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
