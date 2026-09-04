import { FilterRowSkeleton, PageHeadSkeleton, TableSkeleton } from "@/components/skeletons";

export default function KaryawanLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat data karyawan">
      <PageHeadSkeleton />
      <FilterRowSkeleton />
      <TableSkeleton rows={8} cols={7} />
    </div>
  );
}
