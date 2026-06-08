import { Card } from "@/components/ui/card";

function StatCard({
  label,
  value,
  bar,
}: {
  label: string;
  value: string;
  /** % cho thanh tiến độ mảnh dưới giá trị (chỉ thẻ "Tỉ lệ") */
  bar?: number;
}) {
  return (
    <Card className="gap-1 rounded-lg border-border/70 p-3 shadow-none sm:p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold tracking-tight tabular-nums sm:text-xl">
        {value}
      </p>
      {bar !== undefined && (
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-foreground/70 transition-[width] duration-500"
            style={{ width: `${bar}%` }}
          />
        </div>
      )}
    </Card>
  );
}

/** 3 thẻ số: Đã xong (x/y) · Tỉ lệ % · Còn dở */
export function StatsCards({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const remaining = total - done;

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      <StatCard label="Đã xong" value={`${done}/${total}`} />
      <StatCard label="Tỉ lệ" value={`${percent}%`} bar={percent} />
      <StatCard label="Còn dở" value={String(remaining)} />
    </div>
  );
}
