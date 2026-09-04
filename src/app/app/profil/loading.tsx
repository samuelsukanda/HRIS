import { Sk } from "@/components/skeletons";

export default function ProfilLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat profil">
      <div className="mb-4 flex items-center justify-between">
        <Sk className="h-7 w-28" />
        <Sk className="h-9 w-20 !rounded-[4px]" />
      </div>
      <div className="mb-5 flex items-center gap-4 border border-rule bg-card p-4">
        <Sk className="h-16 w-16 shrink-0 !rounded-full" />
        <div className="flex-1 space-y-2">
          <Sk className="h-5 w-1/2" />
          <Sk className="h-3 w-1/3 !bg-ledger/40" />
          <Sk className="h-5 w-20 !rounded-full" />
        </div>
      </div>
      <div className="mb-5 space-y-3 border border-rule bg-card p-4">
        <Sk className="h-4 w-40" />
        <Sk className="h-24 w-full !bg-ledger/40" />
      </div>
      <div className="space-y-2 border-t border-rule pt-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex justify-between gap-3">
            <Sk className="h-3 w-24 !bg-ledger/40" />
            <Sk className="h-3 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
