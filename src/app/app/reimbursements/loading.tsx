import { ListSkeleton, PageHeadSkeleton } from "@/components/skeletons";

export default function ReimbursementsLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat reimbursement">
      <PageHeadSkeleton />
      <ListSkeleton rows={4} />
    </div>
  );
}
