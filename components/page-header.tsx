import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { InfoHint } from '@/components/info-hint';

interface PageHeaderProps {
  /** Dòng nhỏ phía trên tiêu đề (eyebrow) */
  eyebrow?: string;
  title: ReactNode;
  /** Mô tả ngắn dưới tiêu đề. Phần giải thích DÀI nên dùng `info` thay vì `description`. */
  description?: ReactNode;
  /** Giải thích dài → icon ⓘ cạnh tiêu đề (Popover) — giữ tiêu đề sạch (mục giao diện) */
  info?: ReactNode;
  /** Hành động cấp trang, căn phải (vd nút "Kế hoạch mới") */
  action?: ReactNode;
  /** Link "‹ …" cho trang con — đóng vai breadcrumb-nhẹ (mục giao diện) */
  backHref?: string;
  backLabel?: string;
  /** Cho phép tiêu đề viết hoa chữ cái đầu (trang Hôm nay) */
  titleClassName?: string;
  className?: string;
}

/**
 * Header trang dùng chung (mục giao diện): eyebrow + h1 + mô tả + action phải, kèm back-link tùy chọn.
 * Mọi trang dùng cùng component này để nhịp/độ lớn tiêu đề đồng nhất, không "mỗi trang một kiểu".
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  info,
  action,
  backHref,
  backLabel = 'Quay lại',
  titleClassName,
  className,
}: PageHeaderProps) {
  return (
    <header className={cn('mb-8', className)}>
      {backHref && (
        <Link
          href={backHref}
          className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronLeft className="size-4" /> {backLabel}
        </Link>
      )}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow && <p className="text-sm text-muted-foreground">{eyebrow}</p>}
          <div className="mt-1 flex items-center gap-1.5">
            <h1 className={cn('text-xl font-semibold tracking-tight sm:text-2xl', titleClassName)}>
              {title}
            </h1>
            {info && (
              <InfoHint label={typeof title === 'string' ? title : 'Giải thích'} side="bottom">
                {info}
              </InfoHint>
            )}
          </div>
          {description && (
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
    </header>
  );
}
