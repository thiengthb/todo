import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Reusable skeleton blocks (UI section) for loading.tsx + <Suspense> — match the standard card/row set of §12,
 * keeping navigation from going blank/janky. Static, only animate-pulse (respects reduced-motion via global).
 */

export function PageHeaderSkeleton() {
  return (
    <div className="mb-8">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="mt-2 h-7 w-48" />
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border/70 p-4', className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-8 w-full" />
      <Skeleton className="mt-2 h-8 w-4/5" />
    </div>
  );
}

export function ListSkeleton({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('rounded-lg border border-border/70', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-3 px-4 py-3',
            i < rows - 1 && 'border-b border-border/70',
          )}
        >
          <Skeleton className="size-4 shrink-0 rounded-full" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-4 w-12 shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function GridSkeleton({
  count = 4,
  cols = 2,
  className,
}: {
  count?: number;
  cols?: 2 | 3;
  className?: string;
}) {
  return (
    <div className={cn('grid gap-3', cols === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2', className)}>
      {Array.from({ length: count }).map((_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
