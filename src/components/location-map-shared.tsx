"use client";

import { useEffect } from "react";
import { useMap, useMapEvents } from "react-leaflet";

export function MapViewport({ position }: { position: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(position);
  }, [map, position]);
  return null;
}

export function MapClickHandler({ onChange }: { onChange: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onChange(event.latlng.lat, event.latlng.lng) });
  return null;
}
