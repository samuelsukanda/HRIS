import { CardsSkeleton, PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function PelatihanLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pelatihan">
      <PageHeadSkeleton />
      <Sk className="mb-4 h-10 w-full max-w-md !rounded-[4px]" />
      <CardsSkeleton count={3} />
    </div>
  );
}
