import Link from "next/link";
import { Clock, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatMinutes } from "@/lib/schedule";
import { InfoHint } from "@/components/info-hint";

/**
 * Thanh tiêu điểm (mục giao diện, đại tu 2026-06) — gộp quỹ-thời-gian + toggle Danh sách/Dòng giờ
 * vào MỘT hàng, thay 2 dải rời (CapacityBanner + ViewToggle) để trang Hôm nay đỡ chồng card.
 * Chỉ hiện cho ngày không-quá-khứ.
 */
export function FocusBar({
  date,
  view,
  freeMin,
  slotCount,
  plannedMin,
}: {
  date: string;
  view: "list" | "timeline";
  freeMin: number;
  slotCount: number;
  /** tổng estimatedMinutes của việc CHƯA xong — cảnh báo quá tải */
  plannedMin: number;
}) {
  const over = plannedMin > freeMin && freeMin > 0;
  const toggles = [
    { value: "list" as const, label: "Danh sách", icon: LayoutList },
    { value: "timeline" as const, label: "Dòng giờ", icon: Clock },
  ];

  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 p-3">
      <div className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3.5 shrink-0" />
        <span className="tabular-nums">Rảnh ~{formatMinutes(freeMin)}</span>
        {slotCount > 0 && (
          <span className="text-muted-foreground/70">· {slotCount} khe</span>
        )}
        {plannedMin > 0 && (
          <span
            className={cn(
              "tabular-nums text-muted-foreground/70",
              over && "text-amber-600 dark:text-amber-400",
            )}
          >
            · đã xếp ~{formatMinutes(plannedMin)}
          </span>
        )}
        <InfoHint label="Quỹ thời gian hôm nay">
          Quỹ giờ rảnh = giờ thức − lịch cứng − đệm.{" "}
          {over &&
            "Tổng ước lượng đang vượt quỹ rảnh — cân nhắc dời bớt một việc. "}
          Cảnh báo để bạn không nhồi quá sức, không phải để ép.
        </InfoHint>
      </div>
      <div className="inline-flex shrink-0 rounded-lg border border-border/70 p-0.5">
        {toggles.map((t) => {
          const active = view === t.value;
          return (
            <Link
              key={t.value}
              href={`/?date=${date}&view=${t.value}`}
              scroll={false}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors",
                active
                  ? "bg-muted font-medium text-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="size-3.5" />
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
