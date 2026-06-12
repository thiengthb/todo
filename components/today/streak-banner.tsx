import { Flame } from 'lucide-react';

/**
 * Soft reminder banner when the streak is ABOUT TO BREAK (streak.atRisk) and nothing is done today.
 * Kind tone, no blame — just 1 task keeps it going (1-day grace, section 11).
 * The Today page renders it only when: isToday && atRisk && doneCount === 0 → this component does not self-hide.
 */
export function StreakBanner({ current }: { current: number }) {
  return (
    <div className="mt-4 flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/40">
      <Flame className="mt-0.5 size-4 shrink-0 fill-amber-500/20 text-amber-600 dark:text-amber-400" />
      <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-300">
        Chuỗi <span className="font-medium tabular-nums">{current}</span> ngày vẫn đang giữ — hoàn
        thành <span className="font-medium">1 việc</span> hôm nay là nối tiếp. Lỡ một ngày không
        sao, đừng để lỡ hai.
      </p>
    </div>
  );
}
