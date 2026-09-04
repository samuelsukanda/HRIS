import { ListSkeleton, Sk } from "@/components/skeletons";

export default function PengumumanLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat pengumuman">
      <Sk className="h-7 w-48" />
      <Sk className="mt-1 mb-4 h-4 w-64 !bg-ledger/40" />
      <ListSkeleton rows={4} />
    </div>
  );
}
