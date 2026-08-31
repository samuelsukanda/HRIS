"use client";

import { useMemo, useState } from "react";
import { MapPin } from "@phosphor-icons/react";
import { Btn, PageHead, Stamp } from "@/components/ui";
import { useHris } from "@/lib/store";
import type { WorkLocation } from "@/lib/types";

export default function AdminLocations() {
  const { state, dispatch } = useHris();
  const locations = state.data.workLocations;
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name:"", branchId:"BR-JKT", latitude:-6.2, longitude:106.8, radiusM:100 });

  return (
    <>
      <PageHead
        title="Lokasi Kerja"
        sub="Setiap lokasi kerja memiliki titik koordinat dan radius geofence. Absensi onsite hanya valid di dalam radius; perubahan tercatat di audit log."
        action={<Btn variant="official" size="sm" onClick={()=> setShowForm(true)}>+ Lokasi</Btn>}
      />
      {showForm && (
        <div className="mb-6 border border-rule bg-card p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs">Nama<input value={form.name} onChange={e=> setForm({...form,name:e.target.value})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
            <label className="text-xs">Branch<select value={form.branchId} onChange={e=> setForm({...form,branchId:e.target.value})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm">{state.data.branches.map(b=> <option key={b.id} value={b.id}>{b.name}</option>)}</select></label>
            <label className="text-xs">Latitude<input type="number" step="0.0001" value={form.latitude} onChange={e=> setForm({...form,latitude:Number(e.target.value)})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
            <label className="text-xs">Longitude<input type="number" step="0.0001" value={form.longitude} onChange={e=> setForm({...form,longitude:Number(e.target.value)})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
            <label className="text-xs">Radius (m)<input type="number" value={form.radiusM} onChange={e=> setForm({...form,radiusM:Number(e.target.value)})} className="mt-1 w-full border border-rule bg-paper px-2 py-1.5 text-sm" /></label>
          </div>
          <div className="mt-3 flex gap-2">
            <Btn onClick={()=> { if(!form.name) return; dispatch({ type:"CREATE_LOCATION", location:{ id:`LOC-${Date.now()}`, name:form.name, branchId:form.branchId, latitude:form.latitude, longitude:form.longitude, radiusM:form.radiusM, allowedTypes:["onsite"] }}); setShowForm(false); setForm({ name:"", branchId:"BR-JKT", latitude:-6.2, longitude:106.8, radiusM:100 }); }}>Simpan</Btn>
            <Btn variant="ghost" onClick={()=> setShowForm(false)}>Batal</Btn>
          </div>
        </div>
      )}

      <div className="grid gap-5 md:grid-cols-2">
        {locations.map((loc) => (
          <LocationCard key={loc.id} loc={loc} />
        ))}
      </div>

      <section className="mt-8 border border-rule bg-card">
        <header className="border-b border-rule px-5 py-3.5">
          <h2 className="font-semibold">Kebijakan Mode WFH</h2>
        </header>
        <div className="grid gap-4 px-5 py-4 sm:grid-cols-3 text-sm">
          <PolicyRow label="GPS Kantor" value="TIDAK DIWAJIBKAN" />
          <PolicyRow label="Face Verification" value="WAJIB" />
          <PolicyRow label="Liveness / PAD" value="WAJIB" />
        </div>
        <footer className="border-t border-rule bg-paper px-5 py-3 text-xs leading-relaxed text-ink-soft">
          Rekaman WFH tetap melalui pipeline face &amp; liveness penuh tanpa validasi geofence,
          sesuai kebijakan PRD §26. Lokasi tidak direkam saat WFH.
        </footer>
      </section>
    </>
  );
}

function PolicyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b border-ledger/60 pb-2 sm:flex-col sm:items-start sm:border-b-0 sm:pb-0">
      <span className="text-xs tracking-wide text-ink-faint uppercase">{label}</span>
      <span className="tnum font-mono text-sm font-semibold">{value}</span>
    </div>
  );
}

function LocationCard({ loc }: { loc: WorkLocation }) {
  const { state, dispatch } = useHris();
  const [radius, setRadius] = useState(loc.radiusM);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({ name: loc.name, latitude: loc.latitude, longitude: loc.longitude });
  const dirty = radius !== loc.radiusM;

  // Titik contoh check-in hari ini untuk plot
  const { data } = state;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const samples = data.attendance
    .filter((a) => a.date === today && a.checkInSnap && a.checkInSnap.distanceM >= 0)
    .slice(0, 12)
    .map((a) => a.checkInSnap!);

  const size = 200;
  const c = size / 2;
  const maxDist = Math.max(loc.radiusM * 1.6, ...samples.map((s) => s.distanceM), 1);
  const scale = (c - 14) / maxDist;

  return (
    <section className="border border-rule bg-card">
      <header className="flex items-start justify-between gap-3 border-b border-rule px-5 py-4">
        <div className="flex-1">
          {edit ? (
            <div className="space-y-2">
              <input value={form.name} onChange={e=> setForm({...form,name:e.target.value})} className="w-full border border-rule bg-paper px-2 py-1 text-sm font-semibold" />
              <div className="grid grid-cols-2 gap-2">
                <input type="number" step="0.0001" value={form.latitude} onChange={e=> setForm({...form,latitude:Number(e.target.value)})} className="border border-rule bg-paper px-2 py-1 text-xs" />
                <input type="number" step="0.0001" value={form.longitude} onChange={e=> setForm({...form,longitude:Number(e.target.value)})} className="border border-rule bg-paper px-2 py-1 text-xs" />
              </div>
              <div className="flex gap-2"><Btn onClick={()=> { dispatch({type:"UPDATE_LOCATION", id:loc.id, data:{ name:form.name, latitude:form.latitude, longitude:form.longitude }}); setEdit(false); }} className="px-2 py-1 text-xs">Simpan</Btn><Btn variant="ghost" onClick={()=> setEdit(false)} className="px-2 py-1 text-xs">Batal</Btn></div>
            </div>
          ) : (
            <>
              <h3 className="font-semibold">{loc.name}</h3>
              <p className="text-xs text-ink-soft">{data.branches.find((b) => b.id === loc.branchId)?.name}</p>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Stamp kind="neutral"><MapPin size={11} weight="bold" /> Onsite</Stamp>
          {!edit && <button onClick={()=> setEdit(true)} className="text-xs text-official hover:underline">Edit</button>}
          <button onClick={()=> { if(confirm(`Hapus ${loc.name}?`)) dispatch({ type:"DELETE_LOCATION", id:loc.id }); }} className="text-xs text-stamp hover:underline">Hapus</button>
        </div>
      </header>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_150px]">
        <div>
          <dl className="space-y-1.5 text-sm">
            <div className="flex justify-between gap-2 border-b border-ledger/50 pb-1.5">
              <dt className="text-xs text-ink-faint uppercase">Latitude</dt>
              <dd className="tnum">{loc.latitude.toFixed(6)}</dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-ledger/50 pb-1.5">
              <dt className="text-xs text-ink-faint uppercase">Longitude</dt>
              <dd className="tnum">{loc.longitude.toFixed(6)}</dd>
            </div>
          </dl>

          <label className="mt-4 block">
            <span className="mb-1 flex items-baseline justify-between text-xs font-semibold tracking-wide text-ink-soft uppercase">
              Radius Geofence
              <span className="tnum font-mono text-sm font-semibold normal-case text-ink">{radius} m</span>
            </span>
            <input
              type="range"
              min={25}
              max={500}
              step={25}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              aria-label={`Radius geofence ${loc.name}`}
              className="w-full accent-[#c03a2c]"
            />
          </label>

          {dirty && (
            <div className="mt-3 flex items-center gap-2">
              <Btn
                onClick={() =>
                  dispatch({
                    type: "UPDATE_LOCATION",
                    id: loc.id,
                    data: { radiusM: radius },
                  })
                }
                className="px-3 py-1.5 text-xs"
              >
                Simpan Radius
              </Btn>
              <Btn variant="ghost" onClick={() => setRadius(loc.radiusM)} className="px-2 py-1.5 text-xs">
                Batal
              </Btn>
            </div>
          )}
        </div>

        {/* Plot sebaran check-in */}
        <figure className="mx-auto w-[150px] border border-rule bg-paper p-2">
          <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Sebaran check-in ${loc.name}`} className="block">
            <circle cx={c} cy={c} r={loc.radiusM * scale} fill="#2b4a6f08" stroke="#c4ceda" strokeWidth="1.5" strokeDasharray="4 3" />
            <rect x={c - 5} y={c - 5} width={10} height={10} fill="#2b4a6f" rx="1" />
            {samples.map((s, i) => {
              const dx = s.longitude - loc.longitude;
              const dy = s.latitude - loc.latitude;
              const dist = Math.hypot(dx * 111320 * Math.cos((loc.latitude * Math.PI) / 180), dy * 111320);
              const a = Math.atan2(dy, dx);
              const d = Math.min(dist, maxDist) * scale;
              const inside = dist <= loc.radiusM;
              return (
                <circle
                  key={i}
                  cx={c + Math.cos(a) * d}
                  cy={c - Math.sin(a) * d}
                  r={3}
                  fill={inside ? "#2b4a6f" : "#c03a2c"}
                  opacity={0.85}
                />
              );
            })}
          </svg>
          <figcaption className="tnum mt-1 text-center text-[10px] text-ink-faint">
            check-in hari ini
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
