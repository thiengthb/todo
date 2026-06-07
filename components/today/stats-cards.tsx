import { Card } from "@/components/ui/card";

/** 3 thẻ số: Đã xong (x/y) · Tỉ lệ % · Còn dở */
export function StatsCards({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const remaining = total - done;

  const items = [
    { label: "Đã xong", value: `${done}/${total}` },
    { label: "Tỉ lệ", value: `${percent}%` },
    { label: "Còn dở", value: String(remaining) },
  ];

  return (
    <div className="grid grid-cols-3 gap-3">
      {items.map((item) => (
        <Card
          key={item.label}
          className="gap-1 rounded-lg border-border/70 p-4 shadow-none"
        >
          <p className="text-xs text-muted-foreground">{item.label}</p>
          <p className="text-xl font-semibold tabular-nums tracking-tight">
            {item.value}
          </p>
        </Card>
      ))}
    </div>
  );
}
