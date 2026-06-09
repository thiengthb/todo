import { type LucideIcon } from "lucide-react";
import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Hành động gợi ý (vd nút tạo mới) */
  action?: ReactNode;
  className?: string;
}

/**
 * Trạng thái rỗng dùng chung (mục giao diện) — khung viền nét đứt + icon + tiêu đề + mô tả.
 * Thống nhất mọi chỗ "chưa có dữ liệu" để không mỗi trang một kiểu.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "rounded-lg border border-dashed border-border/70 px-6 py-16 text-center",
        className,
      )}
    >
      {Icon && <Icon className="mx-auto size-8 text-muted-foreground/40" />}
      <p className={cn("text-sm font-medium", Icon && "mt-3")}>{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
