import { ListSkeleton, PageHeadSkeleton, Sk } from "@/components/skeletons";

export default function MasterLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat master data">
      <PageHeadSkeleton withAction={false} />
      <div className="mb-4 flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Sk key={i} className="h-9 w-24 !rounded-none" />
        ))}
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}
