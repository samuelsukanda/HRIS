"use client";

import dynamic from "next/dynamic";

const AttendanceGeofenceMap = dynamic(() => import("./attendance-geofence-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[264px] items-center justify-center border border-rule bg-paper text-xs text-ink-faint">
      Memuat peta…
    </div>
  ),
});

export default AttendanceGeofenceMap;
