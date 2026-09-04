import { PageHeadSkeleton, StatCardsSkeleton, TableSkeleton } from "@/components/skeletons";

export default function LemburLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat data lembur">
      <PageHeadSkeleton withAction={false} />
      <div className="mb-6">
        <StatCardsSkeleton count={2} />
      </div>
      <TableSkeleton rows={6} cols={6} />
    </div>
  );
}
