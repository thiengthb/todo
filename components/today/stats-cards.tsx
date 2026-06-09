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
    <div className="flex flex-col gap-1 rounded-lg border border-border/70 p-4">
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
    </div>
  );
}

/** 3 thẻ số: Đã xong (x/y) · Tỉ lệ % · Còn dở */
export function StatsCards({ done, total }: { done: number; total: number }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const remaining = total - done;
  // goal-gradient (mục 11): khi gần xong, nhấn QUÃNG ĐƯỜNG CÒN LẠI (động lực mạnh hơn % đã đi)
  const nearDone = total >= 3 && remaining > 0 && remaining <= 2 && done > 0;

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Đã xong" value={`${done}/${total}`} />
        <StatCard label="Tỉ lệ" value={`${percent}%`} bar={percent} />
        <StatCard label="Còn dở" value={String(remaining)} />
      </div>
      {nearDone && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Chỉ còn {remaining} việc nữa là trọn ngày hôm nay.
        </p>
      )}
    </div>
  );
}
