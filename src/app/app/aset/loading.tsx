import { ListSkeleton, PageHeadSkeleton } from "@/components/skeletons";

export default function AsetLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat aset">
      <PageHeadSkeleton withAction={false} />
      <ListSkeleton rows={4} />
    </div>
  );
}
