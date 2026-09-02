"use client";

import { useEffect } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer, useMap, useMapEvents } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const markerIcon = L.divIcon({
  className: "hris-map-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

type LocationMapPickerProps = {
  latitude: number;
  longitude: number;
  radiusM: number;
  onChange: (latitude: number, longitude: number) => void;
};

export default function LocationMapPicker({ latitude, longitude, radiusM, onChange }: LocationMapPickerProps) {
  const validPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const position: [number, number] = [
    validPosition ? Math.max(-90, Math.min(90, latitude)) : -6.2,
    validPosition ? Math.max(-180, Math.min(180, longitude)) : 106.8,
  ];

  return (
    <div className="overflow-hidden border border-rule bg-paper">
      <MapContainer center={position} zoom={16} scrollWheelZoom className="h-64 w-full sm:h-72" aria-label="Peta titik lokasi kerja">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapViewport position={position} />
        <MapClickHandler onChange={onChange} />
        <Marker
          position={position}
          icon={markerIcon}
          draggable
          eventHandlers={{ dragend: (event) => {
            const next = event.target.getLatLng();
            onChange(next.lat, next.lng);
          } }}
        />
        <Circle center={position} radius={Math.max(0, radiusM)} pathOptions={{ color: "#c03a2c", fillColor: "#c03a2c", fillOpacity: 0.12, weight: 1.5 }} />
      </MapContainer>
      <p className="border-t border-rule px-3 py-2 text-xs text-ink-soft">Klik peta atau geser pin untuk mengubah titik lokasi.</p>
    </div>
  );
}

function MapClickHandler({ onChange }: { onChange: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onChange(event.latlng.lat, event.latlng.lng) });
  return null;
}

function MapViewport({ position }: { position: [number, number] }) {
  const map = useMap();

  useEffect(() => {
    map.setView(position);
  }, [map, position]);

  return null;
}
