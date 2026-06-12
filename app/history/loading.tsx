import { PageHeaderSkeleton, ListSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** History page skeleton — streak + activity strip + list of days. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <div className="space-y-10">
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-20 rounded-lg" />
          <Skeleton className="h-20 rounded-lg" />
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        <ListSkeleton rows={5} />
      </div>
    </div>
  );
}
