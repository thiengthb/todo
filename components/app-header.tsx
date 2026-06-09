"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const NAV = [
  { href: "/", label: "Hôm nay" },
  { href: "/plans", label: "Kế hoạch" },
  { href: "/history", label: "Lịch sử" },
  { href: "/guide", label: "Hướng dẫn" },
] as const;

interface StreakProps {
  current: number;
  atRisk: boolean;
  longest: number;
}

/** Câu giải thích ngắn cho tooltip của chip lửa — giọng tử tế, không trách (mục 11) */
function streakMessage({ current, atRisk, longest }: StreakProps): string {
  if (current === 0) {
    return longest > 0
      ? `Mọi chuỗi đều có lúc nghỉ — kỷ lục của bạn là ${longest} ngày. Làm 1 việc hôm nay để nhen lại.`
      : "Hoàn thành 1 việc hôm nay để nhóm lửa chuỗi đầu tiên.";
  }
  if (atRisk) {
    // ân hạn 1 ngày: lỡ một ngày vẫn giữ được nếu làm tiếp hôm nay
    return `Chuỗi ${current} ngày vẫn giữ — làm 1 việc hôm nay là nối tiếp (lỡ 1 ngày không sao).`;
  }
  return longest > current
    ? `${current} ngày liên tiếp · kỷ lục ${longest} ngày.`
    : `${current} ngày liên tiếp — đang là kỷ lục!`;
}

/** Chip lửa giữ streak — bấm vào xem lịch sử chuỗi */
function StreakChip(streak: StreakProps) {
  const { current, atRisk } = streak;
  const live = current > 0;
  const burning = live && !atRisk;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href="/history"
          aria-label={`Chuỗi giữ lửa: ${current} ngày`}
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 text-sm transition-colors",
            live
              ? "text-amber-600 hover:bg-amber-500/10 dark:text-amber-400"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          <Flame
            className={cn("size-4 shrink-0", burning && "fill-amber-500/20")}
          />
          <span className="font-medium tabular-nums">{current}</span>
        </Link>
      </TooltipTrigger>
      <TooltipContent className="max-w-[15rem] text-center">
        {streakMessage(streak)}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Thanh điều hướng chung, dính trên cùng mọi trang. Gom brand + chip streak +
 * chuyển trang + đổi theme về một chỗ để các page chỉ lo nội dung của mình.
 */
export function AppHeader({ streak }: { streak: StreakProps }) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-2 px-4 sm:px-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span className="flex size-7 items-center justify-center rounded-md bg-foreground text-background">
            <ListTodo className="size-4" />
          </span>
          <span className="hidden text-sm sm:inline sm:text-base">
            Smart Todo
          </span>
        </Link>

        <nav
          className="flex items-center gap-0.5"
          aria-label="Điều hướng chính"
        >
          <StreakChip {...streak} />
          {NAV.map((item) => {
            const active =
              item.href === "/"
                ? pathname === "/"
                : pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            );
          })}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
