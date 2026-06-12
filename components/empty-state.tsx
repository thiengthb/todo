import { type LucideIcon } from 'lucide-react';
import { type ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  /** Suggested action (e.g. a create button) */
  action?: ReactNode;
  className?: string;
}

/**
 * Shared empty state (UI section) — dashed-border frame + icon + title + description.
 * Unifies every "no data yet" spot so each page doesn't do its own thing.
 */
export function EmptyState({ icon: Icon, title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border/70 px-6 py-16 text-center',
        className,
      )}
    >
      {Icon && <Icon className="mx-auto size-8 text-muted-foreground/40" />}
      <p className={cn('text-sm font-medium', Icon && 'mt-3')}>{title}</p>
      {description && (
        <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
