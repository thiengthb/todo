import Link from "next/link";
import { AlertTriangle, Target } from "lucide-react";

export interface PlanMomentumItem {
  id: string;
  title: string;
  currentMilestone: string | null;
  progressPct: number;
  /** > 0: đang chậm (mục 10.5) */
  behindDays: number;
}

/**
 * Thẻ "Kế hoạch đang chạy" ở cột phải trang Hôm nay — đưa plan momentum (tiến độ + chậm Nd)
 * vào tầm mắt hằng ngày thay vì phải mở trang /plans. Trang chỉ render khi có ≥1 plan active.
 */
export function PlanMomentum({ plans }: { plans: PlanMomentumItem[] }) {
  if (plans.length === 0) return null;
  const shown = plans.slice(0, 3);
  const extra = plans.length - shown.length;

  return (
    <div className="rounded-lg border border-border/70 p-4">
      <div className="mb-1 flex items-center justify-between">
        <p className="text-sm font-medium">Kế hoạch đang chạy</p>
        <Link
          href="/plans"
          className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
        >
          Tất cả ›
        </Link>
      </div>
      <div>
        {shown.map((p) => (
          <Link
            key={p.id}
            href={`/plans/${p.id}`}
            className="group flex items-center gap-3 border-b border-border/70 py-3 transition-colors last:border-b-0 hover:bg-muted/40"
          >
            <Ring pct={p.progressPct} />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-xs font-medium">
                {p.title}
              </p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                <Target className="size-3 shrink-0" />
                {p.currentMilestone ?? "Đã xong mọi cột mốc"}
              </p>
            </div>
            {p.behindDays >= 1 && (
              <span className="flex shrink-0 items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400">
                <AlertTriangle className="size-3" />
                {p.behindDays}d
              </span>
            )}
          </Link>
        ))}
      </div>
      {extra > 0 && (
        <p className="mt-2 text-[11px] text-muted-foreground">
          +{extra} kế hoạch nữa
        </p>
      )}
    </div>
  );
}

/** Vòng % nhỏ bằng conic-gradient — cùng pattern với plan-card.tsx, không cần lib */
function Ring({ pct }: { pct: number }) {
  return (
    <div
      className="relative flex size-9 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-foreground) ${pct}%, var(--color-muted) 0)`,
      }}
    >
      <div className="flex size-7 items-center justify-center rounded-full bg-background">
        <span className="text-[10px] font-medium tabular-nums">{pct}</span>
      </div>
    </div>
  );
}
