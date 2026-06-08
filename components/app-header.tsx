"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme-toggle";

const NAV = [
  { href: "/", label: "Hôm nay" },
  { href: "/history", label: "Lịch sử" },
] as const;

/**
 * Thanh điều hướng chung, dính trên cùng mọi trang. Gom brand + chuyển trang +
 * đổi theme về một chỗ để các page chỉ lo nội dung của mình.
 */
export function AppHeader() {
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
          <span className="text-sm sm:text-base">Smart Todo</span>
        </Link>

        <nav className="flex items-center gap-0.5" aria-label="Điều hướng chính">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "rounded-md px-2.5 py-1.5 text-sm transition-colors sm:px-3",
                  active
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
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
