import { CardsSkeleton, Sk } from "@/components/skeletons";

export default function PayslipLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat slip gaji">
      <Sk className="h-7 w-36" />
      <Sk className="mt-1 mb-4 h-4 w-56 !bg-ledger/40" />
      <CardsSkeleton count={3} />
    </div>
  );
}
