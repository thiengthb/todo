import { PageHeaderSkeleton, CardSkeleton, ListSkeleton } from '@/components/skeletons';

/** Skeleton trang Hôm nay (dashboard 2 cột) — tránh khựng khi điều hướng. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <ListSkeleton rows={5} />
        <div className="space-y-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </div>
    </div>
  );
}
