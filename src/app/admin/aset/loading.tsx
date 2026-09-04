import { PageHeadSkeleton, Sk, TableSkeleton } from "@/components/skeletons";

export default function AsetLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat aset">
      <PageHeadSkeleton />
      <Sk className="mb-4 h-10 w-full max-w-md !rounded-[4px]" />
      <TableSkeleton rows={7} cols={6} />
    </div>
  );
}
