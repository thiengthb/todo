import { PageHeaderSkeleton, GridSkeleton } from '@/components/skeletons';

/** Plans page skeleton — grid of plan cards. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <GridSkeleton count={4} cols={2} />
    </div>
  );
}
