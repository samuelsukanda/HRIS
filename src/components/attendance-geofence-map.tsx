"use client";

import { useEffect } from "react";
import { latLngBounds } from "leaflet";
import { Circle, CircleMarker, MapContainer, Polyline, TileLayer, useMap } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export type GeofenceCheckIn = { latitude: number; longitude: number; distanceM: number };

/** Peta real posisi check-in terhadap radius geofence lokasi kerja */
export default function AttendanceGeofenceMap({
  latitude,
  longitude,
  radiusM,
  name,
  checkIn,
}: {
  latitude: number;
  longitude: number;
  radiusM: number;
  name: string;
  checkIn?: GeofenceCheckIn;
}) {
  const center: [number, number] = [latitude, longitude];
  const inside = checkIn ? checkIn.distanceM <= radiusM : true;

  return (
    <figure className="border border-rule bg-card p-3">
      <MapContainer
        center={center}
        zoom={16}
        scrollWheelZoom={false}
        zoomControl={false}
        attributionControl={false}
        className="h-[240px] w-full"
        aria-label="Peta lokasi check-in terhadap radius lokasi kerja"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <MapFit center={center} checkIn={checkIn} />
        <Circle center={center} radius={Math.max(0, radiusM)} pathOptions={{ color: "#c4ceda", fillColor: "#2b4a6f", fillOpacity: 0.08, weight: 1.5, dashArray: "4 3" }} />
        {checkIn && (
          <Polyline positions={[center, [checkIn.latitude, checkIn.longitude]]} pathOptions={{ color: "#dbd9d0", weight: 1 }} />
        )}
        <CircleMarker center={center} radius={6} pathOptions={{ color: "#fcfbf7", fillColor: "#2b4a6f", fillOpacity: 1, weight: 2 }} />
        {checkIn && (
          <CircleMarker center={[checkIn.latitude, checkIn.longitude]} radius={6} pathOptions={{ color: "#fcfbf7", fillColor: inside ? "#2b4a6f" : "#c03a2c", fillOpacity: 1, weight: 2 }} />
        )}
      </MapContainer>
      <figcaption className="tnum mt-2 text-center text-xs text-ink-soft">
        {name.split("—")[0]?.trim()} ·{" "}
        {checkIn
          ? `jarak ${checkIn.distanceM} m · radius ${radiusM} m`
          : "mode WFH — radius kantor tidak diterapkan"}
      </figcaption>
    </figure>
  );
}

/** Pasang viewport: fit bounds agar titik kantor & check-in terlihat bersamaan */
function MapFit({ center, checkIn }: { center: [number, number]; checkIn?: GeofenceCheckIn }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    if (checkIn) {
      const bounds = latLngBounds([center, [checkIn.latitude, checkIn.longitude]]);
      map.fitBounds(bounds, { padding: [24, 24], maxZoom: 18 });
    } else {
      map.setView(center, 16);
    }
  }, [map, center, checkIn]);
  return null;
}
