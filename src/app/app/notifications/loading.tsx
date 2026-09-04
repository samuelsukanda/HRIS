import { ListSkeleton, Sk } from "@/components/skeletons";

export default function NotificationsLoading() {
  return (
    <div aria-busy="true" aria-label="Memuat notifikasi">
      <div className="mb-4 flex items-center justify-between">
        <Sk className="h-7 w-36" />
        <Sk className="h-8 w-28 !rounded-[4px]" />
      </div>
      <ListSkeleton rows={5} />
    </div>
  );
}
