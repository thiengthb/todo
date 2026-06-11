import { GridSkeleton } from '@/components/skeletons';
import { Skeleton } from '@/components/ui/skeleton';

/** Skeleton trang Hướng dẫn — hero + lưới thẻ. */
export default function Loading() {
  return (
    <div className="py-8">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-3">
        <Skeleton className="size-12 rounded-2xl" />
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="mt-10">
        <GridSkeleton count={4} cols={2} />
      </div>
    </div>
  );
}
