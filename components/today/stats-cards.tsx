import { InfoHint } from '@/components/info-hint';

/** % ring via conic-gradient — same Ring pattern as plan-momentum, no lib needed. */
function ProgressRing({ pct, label }: { pct: number; label: string }) {
  return (
    <div
      className="relative flex size-16 shrink-0 items-center justify-center rounded-full"
      style={{
        background: `conic-gradient(var(--color-foreground) ${pct}%, var(--color-muted) 0)`,
      }}
    >
      <div className="flex size-[52px] flex-col items-center justify-center rounded-full bg-background">
        <span className="text-sm font-semibold tabular-nums">{label}</span>
        <span className="text-[10px] text-muted-foreground">{pct}%</span>
      </div>
    </div>
  );
}

/**
 * "Today's progress" card (UI section, 2026-06 overhaul) — merges 3 separate number cells into 1 solid card:
 * % ring + done/total + remaining + real velocity. Uses whitespace better, fewer "stacked cards".
 */
export function StatsCards({
  done,
  total,
  velocity,
}: {
  done: number;
  total: number;
  /** real velocity ~7 days (lib/velocity.ts) — null when not enough data, hides the caption */
  velocity?: { avgDonePerDay: number; daysWithData: number } | null;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const remaining = total - done;
  // goal-gradient (section 11): when nearly done, emphasize the DISTANCE REMAINING (stronger motivation than % completed)
  const nearDone = total >= 3 && remaining > 0 && remaining <= 2 && done > 0;

  return (
    <div className="rounded-lg border border-border/70 p-4">
      <p className="mb-3 text-sm font-medium">Tiến độ hôm nay</p>
      <div className="flex items-center gap-4">
        <ProgressRing pct={percent} label={`${done}/${total}`} />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm">
            Đã xong <span className="font-semibold tabular-nums">{done}</span>
            <span className="text-muted-foreground">/{total}</span> việc
          </p>
          <p className="text-xs text-muted-foreground">
            {remaining > 0 ? (
              <>
                Còn <span className="tabular-nums">{remaining}</span> việc chưa xong
              </>
            ) : total > 0 ? (
              'Trọn vẹn cả ngày 🎉'
            ) : (
              'Chưa có việc nào'
            )}
          </p>
          {/* tốc độ thật — minh bạch con số AI dùng để hiệu chỉnh số lượng đề xuất (mục 6/11) */}
          {velocity && (
            <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
              Tốc độ thật ≈{' '}
              <span className="font-medium tabular-nums text-foreground">
                {velocity.avgDonePerDay}
              </span>{' '}
              việc/ngày
              <InfoHint label="Tốc độ thật là gì?">
                Trung bình số việc bạn xong mỗi ngày-có-làm trong ~7 ngày gần đây (dựa trên{' '}
                {velocity.daysWithData} ngày có dữ liệu). AI hiệu chỉnh số lượng đề xuất theo con số
                này — bám tốc độ thật, không theo mong muốn.
              </InfoHint>
            </p>
          )}
        </div>
      </div>
      {nearDone && (
        <p className="mt-3 border-t border-border/70 pt-2 text-center text-xs text-muted-foreground">
          Chỉ còn {remaining} việc nữa là trọn ngày hôm nay.
        </p>
      )}
    </div>
  );
}
