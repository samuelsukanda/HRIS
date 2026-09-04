import { CardsSkeleton, PageHeadSkeleton } from "@/components/skeletons";

export default function PengumumanLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pengumuman">
      <PageHeadSkeleton />
      <CardsSkeleton count={4} />
    </div>
  );
}
