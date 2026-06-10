import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/schedule";
import { InfoHint } from "@/components/info-hint";

/**
 * Dải quỹ thời gian hôm nay (mục 14): "rảnh ~Xh (N khe) · đã xếp ~Ym" + cảnh báo quá tải.
 * Không chặn — chỉ cảnh báo (amber) khi tổng ước lượng vượt quỹ rảnh. Ẩn khi không có khe.
 */
export function CapacityBanner({
  freeMin,
  slotCount,
  plannedMin,
}: {
  freeMin: number;
  slotCount: number;
  /** tổng estimatedMinutes của việc CHƯA xong hôm nay (0 nếu chưa ước lượng việc nào) */
  plannedMin: number;
}) {
  if (slotCount === 0 && freeMin === 0) return null;
  const over = plannedMin > freeMin && freeMin > 0;
  const pct =
    freeMin > 0 ? Math.min(100, Math.round((plannedMin / freeMin) * 100)) : 0;

  return (
    <div className="mb-4 rounded-lg border border-border/70 p-3">
      <div className="flex items-center justify-between text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Clock className="size-3.5" />
          Rảnh ~{formatMinutes(freeMin)}
          <span className="text-muted-foreground/70">({slotCount} khe)</span>
          {plannedMin > 0 && (
            <span className="text-muted-foreground/70">
              · đã xếp ~{formatMinutes(plannedMin)}
            </span>
          )}
        </span>
        <InfoHint label="Quỹ thời gian hôm nay">
          Quỹ giờ rảnh = giờ thức − lịch cứng − đệm. Ước lượng việc chỉ là tương
          đối; cảnh báo quá tải để bạn không nhồi quá sức, không phải để ép.
        </InfoHint>
      </div>
      {plannedMin > 0 && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className={cn(
              "h-full rounded-full transition-[width] duration-500",
              over ? "bg-amber-500/70" : "bg-foreground/70",
            )}
            style={{ width: `${over ? 100 : pct}%` }}
          />
        </div>
      )}
      {over && (
        <p className="mt-1.5 text-[11px] text-amber-600 dark:text-amber-400">
          Hơi quá tải — tổng ước lượng vượt quỹ rảnh. Cân nhắc dời bớt một việc
          sang ngày khác.
        </p>
      )}
    </div>
  );
}
