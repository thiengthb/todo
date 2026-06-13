import { PageHeaderSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Weekly schedule page skeleton — tall time-grid block. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-8 w-24" />
        </div>
        <Skeleton className="h-[720px] w-full rounded-lg" />
      </div>
    </div>
  );
}
