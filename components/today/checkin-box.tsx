"use client";

import { useState, useTransition } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { upsertCheckin } from "@/app/actions";

export interface CheckinValues {
  energy: number | null;
  mood: number | null;
  stress: number | null;
  sleepHours: number | null;
}

/** Một thang 1..5, 1 chạm để chọn; chạm lại giá trị đang chọn = bỏ */
function Scale({
  label,
  value,
  onPick,
}: {
  label: string;
  value: number | null;
  onPick: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground">
        {label}
      </span>
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onPick(n)}
            className={cn(
              "size-7 rounded-md border text-xs tabular-nums transition-colors",
              value === n
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Check-in Personal OS (mục 11) — tất cả tùy chọn, 1 chạm, bỏ qua được.
 * AI dùng để suy capacity → giảm tải / đề xuất ngày phục hồi khi sức thấp.
 */
export function CheckinBox({ initial }: { initial: CheckinValues }) {
  const [v, setV] = useState<CheckinValues>(initial);
  const [, startTransition] = useTransition();

  function update(patch: Partial<CheckinValues>) {
    const next = { ...v, ...patch };
    setV(next);
    startTransition(() => upsertCheckin(next));
  }
  const pick = (key: keyof CheckinValues, n: number) =>
    update({ [key]: v[key] === n ? null : n });

  const SLEEP = [5, 6, 7, 8];

  return (
    <Card className="gap-3 rounded-lg border-border/70 p-4 shadow-none">
      <p className="text-sm font-medium">
        Trạng thái hôm nay
        <span className="ml-2 font-normal text-muted-foreground">
          (tùy chọn — giúp AI chia sức)
        </span>
      </p>
      <Scale
        label="Năng lượng"
        value={v.energy}
        onPick={(n) => pick("energy", n)}
      />
      <Scale label="Tâm trạng" value={v.mood} onPick={(n) => pick("mood", n)} />
      <Scale
        label="Căng thẳng"
        value={v.stress}
        onPick={(n) => pick("stress", n)}
      />
      <div className="flex items-center justify-between gap-3">
        <span className="w-24 shrink-0 text-xs text-muted-foreground">
          Ngủ (giờ)
        </span>
        <div className="flex gap-1">
          {SLEEP.map((h) => (
            <button
              key={h}
              type="button"
              onClick={() =>
                update({ sleepHours: v.sleepHours === h ? null : h })
              }
              className={cn(
                "size-7 rounded-md border text-xs tabular-nums transition-colors",
                v.sleepHours === h
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:border-foreground",
              )}
            >
              {h === 8 ? "8+" : h}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
