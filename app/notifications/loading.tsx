import { PageHeaderSkeleton, CardSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Notifications page skeleton (tabs + form). */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <Skeleton className="h-8 w-48 rounded-lg" />
      <div className="mt-6 space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
