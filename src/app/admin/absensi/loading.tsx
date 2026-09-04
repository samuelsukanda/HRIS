import { FilterRowSkeleton, PageHeadSkeleton, TableSkeleton } from "@/components/skeletons";

export default function AbsensiLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat data absensi">
      <PageHeadSkeleton />
      <FilterRowSkeleton />
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
