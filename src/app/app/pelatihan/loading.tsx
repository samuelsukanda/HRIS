import { CardsSkeleton, Sk } from "@/components/skeletons";

export default function PelatihanLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pelatihan">
      <Sk className="h-7 w-40" />
      <Sk className="mt-1 mb-4 h-4 w-64 !bg-ledger/40" />
      <CardsSkeleton count={3} />
    </div>
  );
}
