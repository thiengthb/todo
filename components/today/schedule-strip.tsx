import Link from 'next/link';
import { CalendarDays, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ScheduleBlock, ScheduleKind } from '@/lib/types';

const KIND_BORDER: Record<ScheduleKind, string> = {
  hoc: 'border-l-sky-400/70',
  lam: 'border-l-violet-400/70',
  khac: 'border-l-border',
};

/**
 * Dải lịch cứng của ngày đang xem (chỉ-đọc, mục 14) — hiện trên danh sách việc
 * để thấy "khung ngày" trước khi làm việc. Ẩn khi không có lịch nào.
 */
export function ScheduleStrip({ blocks }: { blocks: ScheduleBlock[] }) {
  if (blocks.length === 0) return null;

  return (
    <div className="mb-4 rounded-lg border border-border/70 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <CalendarDays className="size-3.5" /> Lịch hôm nay
        </span>
        <Link
          href="/schedule"
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Mở lịch ›
        </Link>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {blocks.map((b) => (
          <span
            key={`${b.source}-${b.id}`}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md border border-l-2 border-border/60 bg-muted/40 px-2 py-1 text-xs',
              KIND_BORDER[b.kind],
            )}
          >
            <Clock className="size-3 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground tabular-nums">
              {b.startTime && b.endTime ? `${b.startTime}–${b.endTime}` : 'Cả ngày'}
            </span>
            <span className="font-medium">{b.title}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
