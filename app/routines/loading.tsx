import { PageHeaderSkeleton, ListSkeleton, CardSkeleton } from '@/components/skeletons';

/** Routines page skeleton — habits + time settings. */
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
