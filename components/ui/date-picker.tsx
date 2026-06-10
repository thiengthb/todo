"use client";

import * as React from "react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { isValidDateStr, toDateStr } from "@/lib/dates";

/**
 * DatePicker dùng CHUNG toàn app (mục giao diện) — Popover + shadcn Calendar.
 * value/onChange là chuỗi "YYYY-MM-DD" ĐỊA PHƯƠNG (không UTC). Mặc định nút `w-full` để fill grid.
 */
export function DatePicker({
  value,
  onChange,
  placeholder = "Chọn ngày",
  className,
  disabled,
  clearable = false,
}: {
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  /** Cho phép bỏ chọn (về null) */
  clearable?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected =
    value && isValidDateStr(value) ? new Date(`${value}T00:00:00`) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 font-normal",
            !selected && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate">
            {selected ? format(selected, "dd/MM/yyyy") : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto p-0">
        <Calendar
          mode="single"
          locale={vi}
          selected={selected}
          defaultMonth={selected}
          autoFocus
          onSelect={(d) => {
            if (!d) {
              if (clearable) onChange(null);
            } else {
              onChange(toDateStr(d));
            }
            setOpen(false);
          }}
        />
        {clearable && value && (
          <div className="border-t border-border/70 p-1.5">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
            >
              Bỏ chọn
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
