import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { InfoHint } from '@/components/info-hint';

interface PageHeaderProps {
  /** Small line above the title (eyebrow) */
  eyebrow?: string;
  title: ReactNode;
  /** Short description below the title. LONG explanations should use `info` instead of `description`. */
  description?: ReactNode;
  /** Long explanation → ⓘ icon next to the title (Popover) — keeps the title clean (UI section) */
  info?: ReactNode;
  /** Page-level action, right-aligned (e.g. a "New plan" button) */
  action?: ReactNode;
  /** "‹ …" link for sub-pages — acts as a lightweight breadcrumb (UI section) */
  backHref?: string;
  backLabel?: string;
  /** Allow capitalizing the title's first letter (Today page) */
  titleClassName?: string;
  className?: string;
}

/**
 * Shared page header (UI section): eyebrow + h1 + description + right action, plus an optional back-link.
 * Every page uses this component so title rhythm/size stays consistent, not "each page its own way".
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
