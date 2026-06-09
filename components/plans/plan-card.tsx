import Link from "next/link";
import { AlertTriangle, ChevronRight, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { PlanProgress, PlanStatus } from "@/lib/types";

const STATUS_LABEL: Record<PlanStatus, string> = {
  active: "Đang chạy",
  paused: "Tạm dừng",
  done: "Hoàn thành",
  archived: "Lưu trữ",
};

interface PlanCardProps {
  id: string;
  title: string;
  status: PlanStatus;
  daysLeftLabel: string;
  progress: PlanProgress;
}

/** Thẻ tóm tắt một kế hoạch trong danh sách — vòng % + cột mốc hiện tại + cảnh báo chậm */
export function PlanCard({
  id,
  title,
  status,
  daysLeftLabel,
  progress,
}: PlanCardProps) {
  const behind = status === "active" && progress.behindDays >= 1;

  return (
    <Link
      href={`/plans/${id}`}
      className="group flex items-center gap-4 rounded-lg border border-border/70 p-4 transition-colors hover:bg-muted/40"
    >
      <ProgressRing pct={progress.progressPct} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-sm font-medium">{title}</h3>
          {status !== "active" && (
            <Badge
              variant="outline"
              className="shrink-0 text-[11px] font-normal"
            >
              {STATUS_LABEL[status]}
            </Badge>
          )}
        </div>
        <p className="mt-1 flex items-center gap-1.5 truncate text-xs text-muted-foreground">
          <Target className="size-3 shrink-0" />
          {progress.currentMilestone ?? "Đã xong mọi cột mốc"}
        </p>
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>
            {progress.done}/{progress.total} cột mốc
          </span>
          <span>·</span>
          <span>{daysLeftLabel}</span>
          {behind && (
            <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="size-3" />
              chậm {progress.behindDays}d
            </span>
          )}
        </div>
      </div>

      <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

/** Vòng tròn tiến độ nhỏ bằng conic-gradient — không cần lib */
function ProgressRing({ pct }: { pct: number }) {
  return (
    <div
      className="relative flex size-11 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-foreground) ${pct}%, var(--color-muted) 0)`,
      }}
    >
      <div className="flex size-8 items-center justify-center rounded-full bg-background">
        <span className={cn("text-[11px] font-medium tabular-nums")}>
          {pct}
        </span>
      </div>
    </div>
  );
}
