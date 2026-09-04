import { FormSkeleton, ListSkeleton, Sk } from "@/components/skeletons";

export default function LemburLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat lembur">
      <Sk className="h-7 w-32" />
      <Sk className="mt-1 mb-4 h-4 w-60 !bg-ledger/40" />
      <div className="mb-6">
        <FormSkeleton />
      </div>
      <Sk className="mb-2 h-4 w-20" />
      <ListSkeleton rows={3} />
    </div>
  );
}
