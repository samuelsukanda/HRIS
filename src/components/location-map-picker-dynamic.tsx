"use client";

import dynamic from "next/dynamic";

const LocationMapPicker = dynamic(() => import("./location-map-picker"), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center border border-rule bg-paper text-xs text-ink-faint sm:h-72">Memuat peta…</div>,
});

export default LocationMapPicker;
