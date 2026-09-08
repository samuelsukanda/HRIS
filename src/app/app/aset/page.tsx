"use client";

import { useMemo, useState } from "react";
import { Package } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, Input, PageHead, Select, Stamp, StatusStamp, Textarea } from "@/components/ui";
import { confirmDelete, toastOk } from "@/lib/swal";
import { currentUser, useHris } from "@/lib/store";

export default function MyAset() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const [category, setCategory] = useState("laptop");
  const [description, setDescription] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const myAssignments = useMemo(() =>
    me ? data.assetAssignments
      .filter((a) => a.employeeId === me.employee.id)
      .map((a) => ({
        ...a,
        asset: data.assets.find((as) => as.id === a.assetId),
      }))
      .sort((a, b) => (a.returnedAt ? 1 : 0) - (b.returnedAt ? 1 : 0))
    : [],
    [data.assetAssignments, data.assets, me],
  );
  const myRequests = useMemo(() =>
    me ? data.assetRequests.filter((r) => r.employeeId === me.employee.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : [],
    [data.assetRequests, me],
  );

  const active = myAssignments.filter((a) => !a.returnedAt);
  const history = myAssignments.filter((a) => a.returnedAt);

  function submitRequest() {
    setErr(null);
    if (!me) return;
    if (description.trim().length < 10) return setErr("Jelaskan kebutuhan minimal satu kalimat.");
    dispatch({
      type: "REQUEST_ASSET",
      request: { id: `ARQ-${Date.now().toString(36).toUpperCase()}`, employeeId: me.employee.id, category, description: description.trim(), status: "pending", createdAt: new Date().toISOString() },
    });
    setDescription(""); toastOk("Permintaan aset dikirim");
  }

  async function doReturn(id: string) {
    if (await confirmDelete("aset ini (ajukan pengembalian)")) {
      dispatch({ type: "RETURN_ASSET", assignmentId: id });
      toastOk("Pengembalian diajukan");
    }
  }

  return (
    <>
      <PageHead title="Aset Saya" sub="Aset yang ditugaskan kepada Anda." />
      <section className="mb-6 border border-rule bg-card p-4">
        <h2 className="mb-3 text-sm font-semibold">Ajukan Kebutuhan Aset</h2>
        <div className="space-y-3">
          <Field label="Kategori">
            <Select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="laptop">Laptop</option>
              <option value="phone">Phone</option>
              <option value="monitor">Monitor</option>
              <option value="furniture">Furniture</option>
              <option value="vehicle">Vehicle</option>
              <option value="other">Other</option>
            </Select>
          </Field>
          <Field label="Kebutuhan"><Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Contoh: butuh monitor eksternal untuk WFH…" /></Field>
          {err && <p role="alert" className="text-xs font-medium text-stamp-deep">{err}</p>}
          <Btn onClick={submitRequest}>Kirim Permintaan</Btn>
        </div>
      </section>
      {myRequests.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Permintaan Saya</h2>
          <ul className="space-y-2">
            {myRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 border border-rule bg-card p-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold capitalize">{r.category}</p>
                  <p className="truncate text-xs text-ink-soft">{r.description}</p>
                </div>
                <StatusStamp status={r.status} />
              </li>
            ))}
          </ul>
        </section>
      )}
      {myAssignments.length === 0 ? (
        <EmptyState icon={Package} title="Belum ada aset" body="Aset yang ditugaskan ke Anda akan muncul di sini." />
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Aset Aktif</h2>
              <div className="space-y-2">
                {active.map((a) => (
                  <div key={a.id} className="border border-rule bg-card p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{a.asset?.name ?? a.assetId}</p>
                      <Stamp kind="pending">Active</Stamp>
                    </div>
                    <p className="tnum mt-1 text-xs text-ink-soft">Serial: {a.asset?.serialNumber} · Sejak: {new Date(a.assignedAt).toLocaleDateString("id-ID")}</p>
                    <Btn variant="secondary" size="sm" className="mt-2" onClick={() => void doReturn(a.id)}>Ajukan Pengembalian →</Btn>
                  </div>
                ))}
              </div>
            </section>
          )}
          {history.length > 0 && (
            <section>
              <h2 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Riwayat</h2>
              <div className="space-y-2">
                {history.map((a) => (
                  <div key={a.id} className="border border-rule bg-card p-3 opacity-60">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">{a.asset?.name ?? a.assetId}</p>
                      <Stamp kind="neutral">Returned</Stamp>
                    </div>
                    <p className="tnum mt-1 text-xs text-ink-soft">{a.asset?.serialNumber}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </>
  );
}
