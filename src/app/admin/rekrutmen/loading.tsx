import { CardsSkeleton, PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function RekrutmenLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat rekrutmen">
      <PageHeadSkeleton />
      <div className="mb-4 flex gap-2">
        <Sk className="h-9 w-28 !rounded-[4px]" />
        <Sk className="h-9 w-28 !rounded-[4px]" />
      </div>
      <CardsSkeleton count={3} />
    </div>
  );
}
