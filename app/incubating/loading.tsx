import { PageHeaderSkeleton, ListSkeleton } from '@/components/skeletons';

/** Incubating page skeleton — list of goals. */
export default function Loading() {
  return (
    <div className="py-8">
      <PageHeaderSkeleton />
      <ListSkeleton rows={5} />
    </div>
  );
}
