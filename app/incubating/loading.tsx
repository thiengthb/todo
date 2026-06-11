import { PageHeaderSkeleton, ListSkeleton } from '@/components/skeletons';

/** Skeleton trang Ấp ủ — danh sách mục tiêu. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <ListSkeleton rows={5} />
    </div>
  );
}
