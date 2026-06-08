import { Flame } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  current: number;
  atRisk: boolean;
  longest: number;
}

/**
 * Thẻ "giữ lửa" trên màn Hôm nay. Ba trạng thái:
 *  - đang cháy  (current>0, !atRisk): hôm nay đã có việc xong → ăn mừng.
 *  - đang treo  (current>0, atRisk) : hôm qua có, hôm nay chưa → nhắc giữ chuỗi.
 *  - chưa cháy  (current==0)        : khích lệ bắt đầu lại.
 * Thuần hiển thị (server component) — số liệu tính sẵn từ computeStreaks().
 */
export function StreakIndicator({ current, atRisk, longest }: Props) {
  const live = current > 0;
  const burning = live && !atRisk;

  let headline: string;
  let sub: string;
  if (!live) {
    headline = "Chưa có chuỗi";
    sub =
      longest > 0
        ? `Hoàn thành 1 việc hôm nay để bắt đầu lại — kỷ lục của bạn là ${longest} ngày.`
        : "Hoàn thành 1 việc hôm nay để nhóm lửa chuỗi đầu tiên.";
  } else if (atRisk) {
    headline = `${current} ngày liên tiếp`;
    sub = "Chuỗi đang treo — hoàn thành 1 việc hôm nay để giữ lửa.";
  } else {
    headline = `${current} ngày liên tiếp`;
    sub =
      longest > current
        ? `Giữ vững! Kỷ lục của bạn là ${longest} ngày.`
        : current >= 2
          ? "Kỷ lục mới — cứ thế giữ lửa nhé!"
          : "Khởi đầu tốt, mai làm tiếp để nối chuỗi.";
  }

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border p-4",
        burning && "border-amber-500/30 bg-amber-500/5",
        atRisk && "border-amber-500/40 bg-amber-500/5",
        !live && "border-border/70"
      )}
    >
      <div
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          live ? "bg-amber-500/10" : "bg-muted"
        )}
      >
        <Flame
          className={cn(
            "size-5",
            live ? "text-amber-500" : "text-muted-foreground",
            burning && "fill-amber-500/20"
          )}
        />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold leading-tight tabular-nums">
          {headline}
        </p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </div>
    </div>
  );
}
