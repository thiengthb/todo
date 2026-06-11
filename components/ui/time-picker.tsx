'use client';

import * as React from 'react';
import { Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isValidHm, minutesToHm } from '@/lib/notify/time';

/**
 * TimePicker dùng CHUNG toàn app (mục giao diện) — Input gõ tay + Popover các mốc giờ (mặc định 15′).
 * value/onChange là chuỗi "HH:MM" ĐỊA PHƯƠNG. Mặc định `w-full` để fill grid; gõ tay vẫn được.
 */
export function TimePicker({
  value,
  onChange,
  step = 15,
  className,
  disabled,
  ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  step?: number;
  className?: string;
  disabled?: boolean;
  ariaLabel?: string;
}) {
  const [open, setOpen] = React.useState(false);

  const options = React.useMemo(() => {
    const out: string[] = [];
    for (let m = 0; m < 24 * 60; m += step) out.push(minutesToHm(m));
    return out;
  }, [step]);

  const invalid = value !== '' && !isValidHm(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div className={cn('relative', className)}>
          <Clock className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            inputMode="numeric"
            aria-label={ariaLabel}
            aria-invalid={invalid}
            value={value}
            disabled={disabled}
            placeholder="--:--"
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            className="w-full pl-8 tabular-nums"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        className="w-[var(--radix-popper-anchor-width)] min-w-28 p-1"
      >
        <ScrollArea className="h-56">
          <div className="flex flex-col">
            {options.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={cn(
                  'rounded-md px-2 py-1.5 text-left text-sm tabular-nums transition-colors hover:bg-muted',
                  value === opt && 'bg-muted font-medium',
                )}
              >
                {opt}
              </button>
            ))}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
