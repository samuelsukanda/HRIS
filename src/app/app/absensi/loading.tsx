import { Sk } from "@/components/skeletons";

export default function AbsensiLoading() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Memuat absensi">
      <div className="space-y-1">
        <Sk className="h-7 w-40" />
        <Sk className="h-4 w-64 !bg-ledger/40" />
      </div>
      <div className="space-y-2 border border-rule bg-card p-4">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center gap-3">
            <Sk className="h-6 w-6 shrink-0 !rounded-full" />
            <Sk className="h-4 flex-1" />
          </div>
        ))}
      </div>
      <Sk className="h-14 w-full !rounded-[4px] !bg-ledger/60" />
    </div>
  );
}
