import { CardsSkeleton, PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function PerformaLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat performa">
      <PageHeadSkeleton />
      <Sk className="mb-4 h-10 w-full max-w-md !rounded-[4px]" />
      <CardsSkeleton count={4} />
    </div>
  );
}
