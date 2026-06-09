"use client";

import { type ReactNode } from "react";
import { Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Icon ⓘ mở Popover khi BẤM/CHẠM (mục giao diện) — thay các đoạn mô tả dài để bớt ngợp.
 * Dùng Popover (không phải tooltip-hover) để hoạt động trên cảm ứng + đúng a11y (focus, Esc).
 * Chỉ giấu phần GIẢI THÍCH; nhãn thao tác vẫn hiển thị bên cạnh.
 */
export function InfoHint({
  children,
  label = "Giải thích",
  className,
  side = "top",
}: {
  children: ReactNode;
  label?: string;
  className?: string;
  side?: "top" | "right" | "bottom" | "left";
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-4 shrink-0 items-center justify-center rounded-full text-muted-foreground/60 transition-colors hover:text-foreground focus-visible:text-foreground",
            className,
          )}
        >
          <Info className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side={side}
        align="start"
        className="w-64 text-xs leading-relaxed text-muted-foreground"
      >
        {children}
      </PopoverContent>
    </Popover>
  );
}
