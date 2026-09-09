"use client";

import { Circle, CircleMarker, MapContainer, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MapViewport } from "./location-map-shared";

export type CheckinPoint = { latitude: number; longitude: number; inside: boolean };

export default function LocationMiniMap({
  latitude,
  longitude,
  radiusM,
  points,
}: {
  latitude: number;
  longitude: number;
  radiusM: number;
  points: CheckinPoint[];
}) {
  const center: [number, number] = [latitude, longitude];
  return (
    <div className="overflow-hidden border border-rule bg-paper">
      <MapContainer center={center} zoom={16} scrollWheelZoom={false} dragging={false} doubleClickZoom={false} touchZoom={false} keyboard={false} zoomControl={false} attributionControl={false} className="h-[150px] w-full" aria-label="Peta titik lokasi dan check-in hari ini">
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapViewport position={center} />
        <Circle center={center} radius={Math.max(0, radiusM)} pathOptions={{ color: "#94a3b8", fillColor: "#2b4a6f", fillOpacity: 0.08, weight: 1.5, dashArray: "4 3" }} />
        <CircleMarker center={center} radius={4} pathOptions={{ color: "#2b4a6f", fillColor: "#2b4a6f", fillOpacity: 1, weight: 0 }} />
        {points.map((p, i) => (
          <CircleMarker key={i} center={[p.latitude, p.longitude]} radius={3} pathOptions={{ color: p.inside ? "#2b4a6f" : "#c03a2c", fillColor: p.inside ? "#2b4a6f" : "#c03a2c", fillOpacity: 0.85, weight: 0 }} />
        ))}
      </MapContainer>
      <p className="tnum border-t border-rule px-2 py-1 text-center text-[10px] text-ink-faint">
        peta real · check-in hari ini
      </p>
    </div>
  );
}
