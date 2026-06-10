import { PageHeaderSkeleton, GridSkeleton } from "@/components/skeletons";

/** Skeleton trang Kế hoạch — lưới thẻ plan. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <GridSkeleton count={4} cols={2} />
    </div>
  );
}
