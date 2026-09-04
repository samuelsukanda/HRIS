import { PageHeadSkeleton, Sk, TableSkeleton } from "@/components/skeletons";

export default function PayrollLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat payroll">
      <PageHeadSkeleton />
      <div className="mb-4 flex gap-2">
        <Sk className="h-9 w-40 !rounded-[4px]" />
        <Sk className="h-9 w-28 !rounded-[4px]" />
      </div>
      <TableSkeleton rows={8} cols={6} />
    </div>
  );
}
