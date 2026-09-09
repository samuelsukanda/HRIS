"use client";

import { useMemo, useState } from "react";
import { Package, Pencil, Trash } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, IconBtn, Input, Modal, PageHead, Pager, Select, Stamp, Textarea } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";
import { confirmDelete, toastOk } from "@/lib/swal";
import type { Asset } from "@/lib/types";

type AssetStatus = "available" | "assigned" | "maintenance" | "retired";

const STATUS_KIND: Record<AssetStatus, "approved" | "pending" | "rejected" | "neutral"> = {
  available: "approved",
  assigned: "pending",
  maintenance: "rejected",
  retired: "neutral",
};

export default function AdminAset() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const [assignTarget, setAssignTarget] = useState<{ assetId: string } | null>(null);
  const [empId, setEmpId] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const LIMIT = 10;

  // Form Fields for Asset
  const [name, setName] = useState("");
  const [category, setCategory] = useState<"laptop" | "phone" | "monitor" | "furniture" | "vehicle" | "other">("laptop");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchasePrice, setPurchasePrice] = useState(0);
  const [status, setStatus] = useState<AssetStatus>("available");
  const [notes, setNotes] = useState("");

  const assetList = useMemo(() =>
    data.assets
      .filter((a) => {
        if (!q.trim()) return true;
        return `${a.name} ${a.category} ${a.serialNumber}`.toLowerCase().includes(q.toLowerCase());
      })
      .map((a) => ({
        ...a,
        assignment: data.assetAssignments.find((aa) => aa.assetId === a.id && !aa.returnedAt),
        assignee: data.employees.find((e) => {
          const aa = data.assetAssignments.find((a2) => a2.assetId === a.id && !a2.returnedAt);
          return aa && e.id === aa.employeeId;
        }),
      })),
    [data.assets, data.assetAssignments, data.employees, q],
  );
  const pagedAssets = assetList.slice((page - 1) * LIMIT, page * LIMIT);

  function resetForm() {
    setName(""); setCategory("laptop"); setBrand(""); setModel(""); setSerialNumber("");
    setPurchaseDate(""); setPurchasePrice(0); setStatus("available"); setNotes("");
    setEditId(null); setShowForm(false);
  }

  function startEdit(a: Asset) {
    setEditId(a.id);
    setName(a.name);
    setCategory(a.category);
    setBrand(a.brand || "");
    setModel(a.model || "");
    setSerialNumber(a.serialNumber || "");
    setPurchaseDate(a.purchaseDate || "");
    setPurchasePrice(a.purchasePrice || 0);
    setStatus(a.status as AssetStatus);
    setNotes(a.notes || "");
    setShowForm(true);
  }

  function handleSave() {
    if (!name || !category) return;
    if (editId) {
      dispatch({
        type: "UPDATE_ASSET",
        id: editId,
        data: { name, category, brand, model, serialNumber, purchaseDate, purchasePrice, status, notes },
      });
      toastOk("Aset disimpan");
    } else {
      const newAsset: Asset = {
        id: `AST-${String(data.assets.length + 100).padStart(3, "0")}`,
        name, category, brand, model, serialNumber, purchaseDate, purchasePrice, status, notes,
      };
      dispatch({ type: "CREATE_ASSET", asset: newAsset });
      toastOk("Aset ditambahkan");
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    const a = data.assets.find((x) => x.id === id);
    if (await confirmDelete(a?.name ?? "aset ini")) {
      dispatch({ type: "DELETE_ASSET", id });
      toastOk("Aset dihapus");
    }
  }

  function doAssign() {
    if (!assignTarget || !empId || !me) return;
    dispatch({
      type: "ASSIGN_ASSET",
      assignment: {
        id: `AA-${String(data.assetAssignments.length + 1).padStart(3, "0")}`,
        assetId: assignTarget.assetId,
        employeeId: empId,
        assignedAt: new Date().toISOString(),
      },
    });
    setAssignTarget(null);
    setEmpId("");
    toastOk("Aset ditugaskan");
  }

  function doReturn(assignmentId: string) {
    dispatch({ type: "RETURN_ASSET", assignmentId });
    toastOk("Aset dikembalikan");
  }

  const pendingRequests = data.assetRequests.filter((r) => r.status === "pending");
  function decideRequest(id: string, approve: boolean) {
    dispatch({ type: "DECIDE_ASSET_REQUEST", id, approve });
    toastOk(approve ? "Permintaan disetujui" : "Permintaan ditolak");
  }

  return (
    <>
      <PageHead
        title="Aset"
        sub="Kelola inventaris aset perusahaan, penugasan kepada karyawan, dan pantau status pengembaliannya."
        action={<Btn variant="official" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Aset</Btn>}
      />
      {pendingRequests.length > 0 && (
        <section className="mb-6 border border-rule bg-card">
          <header className="flex items-baseline justify-between border-b border-rule px-5 py-3.5">
            <h2 className="font-semibold">Permintaan Aset</h2>
            <span className="tnum text-xs text-ink-faint">{pendingRequests.length} pending</span>
          </header>
          <ul className="divide-y divide-ledger/50">
            {pendingRequests.map((r) => {
              const emp = data.employees.find((e) => e.id === r.employeeId);
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{emp?.name ?? r.employeeId} <span className="font-normal text-ink-faint capitalize">· {r.category}</span></p>
                    <p className="truncate text-xs text-ink-soft">{r.description}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Btn variant="official" size="sm" onClick={() => decideRequest(r.id, true)}>Setujui</Btn>
                    <Btn variant="secondary" size="sm" onClick={() => decideRequest(r.id, false)}>Tolak</Btn>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="mb-4 max-w-md">
        <Input placeholder="Cari nama / kategori / serial…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {assetList.length === 0 ? (
        <EmptyState icon={Package} title="Belum ada aset" body="Daftarkan aset perusahaan untuk mulai tracking." />
      ) : (
        <div className="overflow-x-auto border border-rule bg-card">
          <table className="w-full min-w-[750px] text-sm">
            <thead>
              <tr className="border-b border-rule font-mono text-[10px] tracking-widest text-ink-faint uppercase">
                <th className="px-4 py-2.5 text-left">Nama Aset</th>
                <th className="px-3 py-2.5 text-left">Kategori</th>
                <th className="px-3 py-2.5 text-left">Serial</th>
                <th className="px-3 py-2.5 text-center">Status</th>
                <th className="px-3 py-2.5 text-left">Ditugaskan ke</th>
                <th className="px-3 py-2.5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ledger/50">
              {pagedAssets.map((a) => (
                <tr key={a.id} className="hover:bg-black/[0.02]">
                  <td className="px-4 py-3">
                    <p className="font-medium text-official">{a.name}</p>
                    <p className="tnum text-[10px] text-ink-faint">{a.id}</p>
                  </td>
                  <td className="px-3 py-3 capitalize text-xs">{a.category}</td>
                  <td className="tnum px-3 py-3 font-mono text-xs text-ink-soft">{a.serialNumber}</td>
                  <td className="px-3 py-3 text-center"><Stamp kind={STATUS_KIND[a.status as AssetStatus]}>{a.status}</Stamp></td>
                  <td className="px-3 py-3 text-xs text-ink-soft">{a.assignee?.name ?? "—"}</td>
                  <td className="px-3 py-3 text-center">
                    <div className="flex items-center justify-center gap-2">
                      {a.status === "available" && (
                        <Btn variant="secondary" size="sm" onClick={() => setAssignTarget({ assetId: a.id })}>Assign</Btn>
                      )}
                      {a.assignment && (
                        <Btn variant="ghost" size="sm" onClick={() => doReturn(a.assignment!.id)}>Return</Btn>
                      )}
                      <IconBtn label={`Edit ${a.name}`} icon={Pencil} onClick={() => startEdit(a as any)} />
                      <IconBtn label={`Hapus ${a.name}`} icon={Trash} onClick={() => handleDelete(a.id)} className="hover:text-stamp" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} total={assetList.length} limit={LIMIT} onChange={setPage} />

      {/* Assign Modal */}
      {assignTarget && (
        <Modal open={!!assignTarget} onClose={() => setAssignTarget(null)} title="Assign Aset">
          <div className="space-y-3">
            <div>
              <label className="mb-1 block font-mono text-[11px] tracking-widest text-ink-faint uppercase">Karyawan</label>
              <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="w-full border border-rule bg-card px-3 py-2 text-sm">
                <option value="">Pilih karyawan</option>
                {data.employees.filter((e) => e.status === "active").map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </select>
            </div>
            <Btn variant="official" onClick={doAssign} disabled={!empId}>Assign Sekarang</Btn>
          </div>
        </Modal>
      )}

      {/* Add / Edit Form Modal */}
      <Modal open={showForm} onClose={resetForm} title={editId ? "Edit Aset" : "Aset Baru"}>
        <div className="space-y-3">
          <Field label="Nama Aset">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Contoh: MacBook Pro M3" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kategori">
              <Select value={category} onChange={(e) => setCategory(e.target.value as any)}>
                <option value="laptop">Laptop</option>
                <option value="monitor">Monitor</option>
                <option value="phone">Phone</option>
                <option value="furniture">Furniture</option>
                <option value="vehicle">Vehicle</option>
                <option value="other">Other</option>
              </Select>
            </Field>
            <Field label="No. Serial (S/N)">
              <Input value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} placeholder="Contoh: C02X1234XXXX" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Merk / Brand">
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Contoh: Apple" />
            </Field>
            <Field label="Model / Tipe">
              <Input value={model} onChange={(e) => setModel(e.target.value)} placeholder="Contoh: M3 Pro 14 inch" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tanggal Pembelian">
              <Input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
            </Field>
            <Field label="Harga Beli">
              <Input type="number" value={purchasePrice} onChange={(e) => setPurchasePrice(Number(e.target.value))} />
            </Field>
          </div>
          <Field label="Status Aset">
            <Select value={status} onChange={(e) => setStatus(e.target.value as AssetStatus)}>
              <option value="available">Available</option>
              <option value="assigned">Assigned</option>
              <option value="maintenance">Maintenance</option>
              <option value="retired">Retired</option>
            </Select>
          </Field>
          <Field label="Catatan Tambahan">
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
          </Field>
          <Btn variant="official" onClick={handleSave} disabled={!name} className="w-full">
            {editId ? "Simpan Perubahan" : "Simpan Aset"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
