"use client";

import dynamic from "next/dynamic";

const LocationMiniMap = dynamic(() => import("./location-mini-map"), {
  ssr: false,
  loading: () => <div className="flex h-[150px] items-center justify-center border border-rule bg-paper text-xs text-ink-faint">Memuat peta…</div>,
});

export default LocationMiniMap;
