"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { vi } from "react-day-picker/locale";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { addDays, toDateStr } from "@/lib/dates";

interface DayNavProps {
  /** ngày đang xem, "YYYY-MM-DD" */
  date: string;
  /** hôm nay, "YYYY-MM-DD" — truyền từ server để tránh lệch múi giờ */
  today: string;
}

export function DayNav({ date, today }: DayNavProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const selected = new Date(`${date}T00:00:00`);

  function go(d: string) {
    router.push(d === today ? "/" : `/?date=${d}`);
  }

  return (
    <nav className="flex shrink-0 items-center gap-0.5" aria-label="Điều hướng ngày">
      {date !== today && (
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
        >
          <Link href="/">Về hôm nay</Link>
        </Button>
      )}

      <Button asChild variant="ghost" size="icon" aria-label="Ngày trước">
        <Link href={`/?date=${addDays(date, -1)}`}>
          <ChevronLeft className="size-4" />
        </Link>
      </Button>

      {/* Datepicker — icon lịch nằm giữa 2 nút back/forward */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" aria-label="Chọn ngày">
            <CalendarDays className="size-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="center">
          <Calendar
            mode="single"
            locale={vi}
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              if (d) {
                go(toDateStr(d));
                setOpen(false);
              }
            }}
          />
        </PopoverContent>
      </Popover>

      <Button asChild variant="ghost" size="icon" aria-label="Ngày sau">
        <Link href={`/?date=${addDays(date, 1)}`}>
          <ChevronRight className="size-4" />
        </Link>
      </Button>
    </nav>
  );
}
