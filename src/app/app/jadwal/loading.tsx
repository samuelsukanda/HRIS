import { Sk } from "@/components/skeletons";

export default function JadwalLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat jadwal">
      <Sk className="h-7 w-40" />
      <Sk className="mt-1 mb-4 h-4 w-64 !bg-ledger/40" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="flex items-center gap-4 border border-rule bg-card px-4 py-3">
            <Sk className="h-8 w-24 shrink-0" />
            <div className="flex-1 space-y-1.5">
              <Sk className="h-5 w-32" />
              <Sk className="h-3 w-48 !bg-ledger/40" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
