import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { InfoHint } from "@/components/info-hint";

/**
 * Field dùng chung cho MỌI form (mục giao diện): nhãn + control + hint/info.
 * Control nằm trong grid `sm:grid-cols-2` luôn `w-full` → các ô bằng nhau, fill hết grid.
 * Dùng <div> (không bọc <label>) để không xung đột với control kiểu Popover (DatePicker/TimePicker).
 */
export function Field({
  label,
  hint,
  info,
  className,
  children,
}: {
  label: ReactNode;
  /** Ghi chú ngắn dưới control */
  hint?: ReactNode;
  /** Giải thích dài → icon ⓘ cạnh nhãn (Popover) */
  info?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        {label}
        {info && (
          <InfoHint label={typeof label === "string" ? label : "Giải thích"}>
            {info}
          </InfoHint>
        )}
      </span>
      {children}
      {hint && (
        <span className="text-[11px] text-muted-foreground/80">{hint}</span>
      )}
    </div>
  );
}
