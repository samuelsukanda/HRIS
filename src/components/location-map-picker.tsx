"use client";

import { useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { Btn } from "@/components/ui";
import { MapAttribution, MapClickHandler, MapViewport } from "./location-map-shared";

const markerIcon = L.divIcon({
  className: "hris-map-marker",
  html: '<span aria-hidden="true"></span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

type GeoResult = { label: string; latitude: number; longitude: number };

type LocationMapPickerProps = {
  latitude: number;
  longitude: number;
  radiusM: number;
  onChange: (latitude: number, longitude: number) => void;
};

type SearchStatus = "idle" | "loading" | "error" | "empty";

export default function LocationMapPicker({ latitude, longitude, radiusM, onChange }: LocationMapPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<GeoResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>("idle");
  const [open, setOpen] = useState(false);

  const validPosition = Number.isFinite(latitude) && Number.isFinite(longitude);
  const position: [number, number] = [
    validPosition ? Math.max(-90, Math.min(90, latitude)) : -6.2,
    validPosition ? Math.max(-180, Math.min(180, longitude)) : 106.8,
  ];

  async function search() {
    const q = query.trim();
    if (q.length < 3 || status === "loading") return;
    setStatus("loading");
    setOpen(true);
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`, { signal: AbortSignal.timeout(10000) });
      const data = (await res.json()) as { results?: GeoResult[] };
      if (!res.ok) { setStatus("error"); return; }
      setResults(data.results ?? []);
      setStatus((data.results?.length ?? 0) > 0 ? "idle" : "empty");
    } catch {
      setStatus("error");
    }
  }

  function pick(r: GeoResult) {
    onChange(r.latitude, r.longitude);
    setOpen(false);
    setStatus("idle");
  }

  return (
    <div className="overflow-hidden border border-rule bg-paper">
      <form
        onSubmit={(e) => { e.preventDefault(); void search(); }}
        className="flex items-center gap-2 border-b border-rule p-2"
      >
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari nama tempat atau alamat…"
          aria-label="Cari nama tempat atau alamat"
          className="min-w-0 flex-1 border border-rule bg-card px-2 py-1.5 text-sm"
        />
        <Btn type="submit" variant="secondary" size="sm" disabled={query.trim().length < 3 || status === "loading"}>
          {status === "loading" ? "Mencari…" : "Cari"}
        </Btn>
      </form>
      {status === "empty" && <p className="border-b border-rule px-3 py-2 text-xs text-ink-soft">Lokasi tidak ditemukan. Coba kata kunci lain.</p>}
      {status === "error" && <p className="border-b border-rule px-3 py-2 text-xs text-stamp-deep">Gagal mencari, coba lagi.</p>}
      {open && results.length > 0 && (
        <ul className="max-h-40 divide-y divide-ledger/60 overflow-y-auto border-b border-rule">
          {results.map((r, i) => (
            <li key={`${r.latitude}-${r.longitude}-${i}`}>
              <button
                type="button"
                onClick={() => pick(r)}
                className="block w-full cursor-pointer px-3 py-2 text-left text-xs leading-snug text-ink hover:bg-card"
              >
                <span className="line-clamp-2">{r.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <MapContainer center={position} zoom={16} scrollWheelZoom className="h-64 w-full sm:h-72" aria-label="Peta titik lokasi kerja">
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <MapAttribution />
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
