import { InfoHint } from '@/components/info-hint';

/** Vòng % bằng conic-gradient — cùng pattern Ring của plan-momentum, không cần lib. */
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
 * Thẻ "Tiến độ hôm nay" (mục giao diện, đại tu 2026-06) — gộp 3 ô số rời thành 1 card đặc:
 * vòng % + đã xong/tổng + còn dở + tốc độ thật. Dùng khoảng trống tốt hơn, bớt "chồng card".
 */
export function StatsCards({
  done,
  total,
  velocity,
}: {
  done: number;
  total: number;
  /** tốc độ thật ~7 ngày (lib/velocity.ts) — null khi chưa đủ dữ liệu, sẽ ẩn caption */
  velocity?: { avgDonePerDay: number; daysWithData: number } | null;
}) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  const remaining = total - done;
  // goal-gradient (mục 11): khi gần xong, nhấn QUÃNG ĐƯỜNG CÒN LẠI (động lực mạnh hơn % đã đi)
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
