'use client';

import Link from 'next/link';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface StreakProps {
  current: number;
  atRisk: boolean;
  longest: number;
}

/** Câu giải thích ngắn cho tooltip của chip lửa — giọng tử tế, không trách (mục 11) */
function streakMessage({ current, atRisk, longest }: StreakProps): string {
  if (current === 0) {
    return longest > 0
      ? `Mọi chuỗi đều có lúc nghỉ — kỷ lục của bạn là ${longest} ngày. Làm 1 việc hôm nay để nhen lại.`
      : 'Hoàn thành 1 việc hôm nay để nhóm lửa chuỗi đầu tiên.';
  }
  if (atRisk) {
    return `Chuỗi ${current} ngày vẫn giữ — làm 1 việc hôm nay là nối tiếp (lỡ 1 ngày không sao).`;
  }
  return longest > current
    ? `${current} ngày liên tiếp · kỷ lục ${longest} ngày.`
    : `${current} ngày liên tiếp — đang là kỷ lục!`;
}

/** Chip lửa giữ streak — bấm vào xem lịch sử chuỗi */
export function StreakChip(streak: StreakProps) {
  const { current, atRisk } = streak;
  const live = current > 0;
  const burning = live && !atRisk;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/history"
          aria-label={`Chuỗi giữ lửa: ${current} ngày`}
          className={cn(
            'flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors',
            live
              ? 'text-amber-600 hover:bg-amber-500/10 dark:text-amber-400'
              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
          )}
        >
          <Flame className={cn('size-4 shrink-0', burning && 'fill-amber-500/20')} />
          <span className="font-medium tabular-nums">{current}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-[15rem] text-center">{streakMessage(streak)}</TooltipContent>
    </Tooltip>
  );
}
