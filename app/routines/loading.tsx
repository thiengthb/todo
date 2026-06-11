import { PageHeaderSkeleton, ListSkeleton, CardSkeleton } from '@/components/skeletons';

/** Skeleton trang Nhịp sống — thói quen + cấu hình giờ. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <div className="space-y-10">
        <ListSkeleton rows={3} />
        <CardSkeleton />
      </div>
    </div>
  );
}
