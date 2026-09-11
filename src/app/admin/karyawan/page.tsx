"use client";

import { useEffect, useMemo, useState } from "react";
import { MagnifyingGlass, SealCheck, WarningCircle, Trash, Pencil } from "@phosphor-icons/react";
import { Avatar, Btn, EmptyState, Field, IconBtn, Input, Modal, PageHead, Pager, Select, Stamp } from "@/components/ui";
import { fmtDateShortID, parseLocalISO } from "@/lib/format";
import { useHris } from "@/lib/store";
import { confirmDelete, showTempPassword, toastErr, toastOk } from "@/lib/swal";
import type { Employee } from "@/lib/types";

type EmploymentStatus = "probation" | "permanent" | "contract" | "intern" | "resigned";

export default function AdminEmployees() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const [q, setQ] = useState("");
  const [branchFilter, setBranchFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [selected, setSelected] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  // Form Fields — default dari data master pertama (bukan hardcode ID)
  const [name, setName] = useState("");
  const [nik, setNik] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branchId, setBranchId] = useState(data.branches[0]?.id ?? "");
  const [departmentId, setDepartmentId] = useState(data.departments[0]?.id ?? "");
  const [positionId, setPositionId] = useState(data.positions[0]?.id ?? "");
  const [workLocationId, setWorkLocationId] = useState(data.workLocations[0]?.id ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentStatus>("probation");
  const [baseSalary, setBaseSalary] = useState(10_000_000);
  const [allowance, setAllowance] = useState(2_000_000);
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [address, setAddress] = useState("");
  const [bankName, setBankName] = useState("BCA");
  const [bankAccount, setBankAccount] = useState("");
  const [emergencyName, setEmergencyName] = useState("");
  const [emergencyRelation, setEmergencyRelation] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);

  const rows = useMemo(
    () =>
      data.employees.filter((e) => {
        if (e.status === "resigned" || e.status === "inactive") return false;
        if (branchFilter !== "all" && e.branchId !== branchFilter) return false;
        if (deptFilter !== "all" && e.departmentId !== deptFilter) return false;
        if (!q.trim()) return true;
        const dep = data.departments.find((d) => d.id === e.departmentId)?.name ?? "";
        const pos = data.positions.find((p) => p.id === e.positionId)?.title ?? "";
        return `${e.name} ${e.id} ${dep} ${pos}`.toLowerCase().includes(q.toLowerCase());
      }),
    [data, q, branchFilter, deptFilter],
  );

  const emp = selected ? data.employees.find((e) => e.id === selected)! : null;
  const paged = rows.slice((page - 1) * LIMIT, page * LIMIT);

  function resetForm() {
    setName(""); setNik(""); setEmail(""); setPhone("");
    setBranchId(data.branches[0]?.id ?? ""); setDepartmentId(data.departments[0]?.id ?? "");
    setPositionId(data.positions[0]?.id ?? ""); setWorkLocationId(data.workLocations[0]?.id ?? "");
    setEmploymentType("probation"); setBaseSalary(10_000_000); setAllowance(2_000_000);
    setJoinDate(new Date().toISOString().slice(0, 10));
    setAddress(""); setBankName("BCA"); setBankAccount("");
    setEmergencyName(""); setEmergencyRelation(""); setEmergencyPhone("");
    setPhotoUrl("");
  }

  function handleAdd() {
    if (!name || !email) return;
    const newEmp: Employee = {
      id: `EMP-${String(data.employees.length + 100).padStart(3, "0")}`,
      nik, name, gender: "L", birthPlace: "Jakarta", birthDate: "1990-01-01", address,
      phone, email, joinDate, departmentId, positionId, branchId, workLocationId,
      employmentType, status: "active", bankName, bankAccount,
      emergencyContact: { name: emergencyName, relation: emergencyRelation, phone: emergencyPhone }, faceRegistered: false,
      baseSalary, allowance,
    };
    dispatch({ type: "CREATE_EMPLOYEE", employee: newEmp });
    setShowAddForm(false);
    resetForm();
    toastOk("Karyawan ditambahkan");
  }

  function startEdit(e: Employee) {
    setSelected(e.id);
    setName(e.name);
    setNik(e.nik);
    setEmail(e.email);
    setPhone(e.phone);
    setBranchId(e.branchId);
    setDepartmentId(e.departmentId);
    setPositionId(e.positionId);
    setWorkLocationId(e.workLocationId);
    setEmploymentType(e.employmentType);
    setBaseSalary(e.baseSalary || 0);
    setAllowance(e.allowance || 0);
    setJoinDate(e.joinDate);
    setAddress(e.address || "");
    setBankName(e.bankName || "");
    setBankAccount(e.bankAccount || "");
    setEmergencyName(e.emergencyContact?.name || "");
    setEmergencyRelation(e.emergencyContact?.relation || "");
    setEmergencyPhone(e.emergencyContact?.phone || "");
    setPhotoUrl(e.photoUrl ?? "");
    setShowEditForm(true);
  }

  function handleEdit() {
    if (!selected) return;
    dispatch({
      type: "UPDATE_EMPLOYEE",
      id: selected,
      data: {
        name, nik, email, phone, branchId, departmentId, positionId, workLocationId,
        employmentType, baseSalary, allowance, joinDate,
        address, bankName, bankAccount,
        emergencyContact: { name: emergencyName, relation: emergencyRelation, phone: emergencyPhone },
        photoUrl,
      },
    });
    setShowEditForm(false);
    setSelected(null);
    resetForm();
    toastOk("Data karyawan disimpan");
  }

  async function handlePhotoUpload(file?: File) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toastErr("Ukuran foto maksimal 2 MB.");
      return;
    }
    setPhotoBusy(true);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", "photo");
    try {
      const r = await fetch("/api/uploads", { method: "POST", body: fd });
      const j = await r.json() as { ok: boolean; url?: string; error?: string };
      if (j.ok && j.url) setPhotoUrl(j.url);
      else toastErr(j.error ?? "Upload foto gagal.");
    } catch {
      toastErr("Upload foto gagal. Coba lagi.");
    }
    setPhotoBusy(false);
  }

  async function handleDeactivate(id: string) {
    if (await confirmDelete("karyawan ini")) {
      dispatch({ type: "DELETE_EMPLOYEE", id });
      setSelected(null);
      toastOk("Karyawan dinonaktifkan");
    }
  }

  return (
    <>
      <PageHead
        title="Karyawan"
        sub="Kelola informasi, status, dan riwayat kepegawaian."
        action={
          <div className="flex items-center gap-3">
            <span className="tnum text-sm text-ink-faint">{rows.length} orang</span>
            <Btn variant="official" size="sm" onClick={() => { resetForm(); setShowAddForm(true); }}>+ Karyawan</Btn>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlass size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Cari nama, ID, departemen…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <div className="w-44 shrink-0">
          <Select value={branchFilter} onChange={(e) => setBranchFilter(e.target.value)} aria-label="Filter cabang">
            <option value="all">Semua cabang</option>
            {data.branches.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </Select>
        </div>
        <div className="w-44 shrink-0">
          <Select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} aria-label="Filter departemen">
            <option value="all">Semua dept</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MagnifyingGlass} title="Tidak ditemukan" body="Tidak ada karyawan yang cocok dengan pencarian atau filter cabang." />
      ) : (
        <div className="overflow-x-auto border border-rule bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-widest text-ink-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Nama</th>
                <th className="px-3 py-2.5 font-medium">Departemen</th>
                <th className="px-3 py-2.5 font-medium">Posisi</th>
                <th className="px-3 py-2.5 font-medium">Lokasi Kerja</th>
                <th className="px-3 py-2.5 font-medium">Wajah</th>
                <th className="px-3 py-2.5 font-medium">Status</th>
                <th className="px-3 py-2.5 text-center font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((e) => {
                const loc = data.workLocations.find((w) => w.id === e.workLocationId);
                return (
                  <tr
                    key={e.id}
                    className="border-b border-ledger/60 transition-colors last:border-b-0 hover:bg-black/[0.02]"
                  >
                    <td className="px-4 py-2.5 cursor-pointer" onClick={() => setSelected(e.id)}>
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} size={30} src={e.photoUrl} />
                        <span>
                          <span className="block font-semibold text-official">{e.name}</span>
                          <span className="tnum block text-xs text-ink-faint">{e.id}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{data.departments.find((d) => d.id === e.departmentId)?.name}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{data.positions.find((p) => p.id === e.positionId)?.title}</td>
                    <td className="px-3 py-2.5 text-ink-soft">{loc?.name.split("—")[0]?.trim()}</td>
                    <td className="px-3 py-2.5">
                      {e.faceRegistered ? (
                        <Stamp kind="approved"><SealCheck size={11} weight="bold" /> Terdaftar</Stamp>
                      ) : (
                        <Stamp kind="pending">Belum</Stamp>
                      )}
                    </td>
                    <td className="px-3 py-2.5">{empStatusStamp(e)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <div className="flex justify-center gap-1">
                        <IconBtn label={`Edit ${e.name}`} icon={Pencil} onClick={() => startEdit(e)} />
                        <IconBtn label={`Nonaktifkan ${e.name}`} icon={Trash} onClick={() => handleDeactivate(e.id)} className="hover:text-stamp" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} total={rows.length} limit={LIMIT} onChange={setPage} />

      {/* Details Modal */}
      <Modal open={!!emp && !showEditForm} onClose={() => setSelected(null)} title={emp ? emp.name : ""} wide>
        {emp && <EmployeeDetail emp={emp} />}
      </Modal>

      {/* Add / Edit Form Modal */}
      <Modal open={showAddForm || showEditForm} onClose={() => { setShowAddForm(false); setShowEditForm(false); setSelected(null); }} title={showEditForm ? "Edit Karyawan" : "Karyawan Baru"}>
        <div className="space-y-3">
          {showEditForm && (
          <div className="flex items-center gap-4 border border-dashed border-rule bg-paper p-3">
            <Avatar name={name || "Karyawan"} src={photoUrl || undefined} size={56} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap gap-2">
                <label className="btn-press inline-flex min-h-8 cursor-pointer items-center rounded-[4px] border border-rule bg-card px-3 py-1.5 text-xs font-semibold hover:border-ink-faint hover:text-official-deep">
                  {photoBusy ? "Mengunggah…" : "Ganti Foto"}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="sr-only"
                    disabled={photoBusy}
                    onChange={(e) => void handlePhotoUpload(e.target.files?.[0])}
                  />
                </label>
                {photoUrl && (
                  <Btn variant="ghost" size="sm" onClick={() => setPhotoUrl("")}>Hapus Foto</Btn>
                )}
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">JPG/PNG/WEBP, maksimal 2 MB.</p>
            </div>
          </div>
          )}
          <Field label="Nama Lengkap">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="NIK (16 Digit)">
            <Input value={nik} onChange={(e) => setNik(e.target.value)} maxLength={16} />
          </Field>
          <Field label="Email">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} disabled={showEditForm} />
          </Field>
          <Field label="Telepon">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Alamat">
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cabang">
              <Select value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {data.branches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              </Select>
            </Field>
            <Field label="Departemen">
              <Select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)}>
                {data.departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Posisi">
              <Select value={positionId} onChange={(e) => setPositionId(e.target.value)}>
                {data.positions.map((p) => <option key={p.id} value={p.id}>{p.title}</option>)}
              </Select>
            </Field>
            <Field label="Lokasi Kerja">
              <Select value={workLocationId} onChange={(e) => setWorkLocationId(e.target.value)}>
                {data.workLocations.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipe Kontrak">
              <Select value={employmentType} onChange={(e) => setEmploymentType(e.target.value as EmploymentStatus)}>
                <option value="probation">Probation</option>
                <option value="permanent">Permanen</option>
                <option value="contract">Kontrak</option>
                <option value="intern">Intern</option>
              </Select>
            </Field>
            <Field label="Tanggal Gabung">
              <Input type="date" value={joinDate} onChange={(e) => setJoinDate(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Gaji Pokok">
              <Input type="number" value={baseSalary} onChange={(e) => setBaseSalary(Number(e.target.value))} />
            </Field>
            <Field label="Tunjangan">
              <Input type="number" value={allowance} onChange={(e) => setAllowance(Number(e.target.value))} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Bank">
              <Select value={bankName} onChange={(e) => setBankName(e.target.value)}>
                <option value="">— Pilih Bank —</option>
                <option value="BCA">BCA</option>
                <option value="Mandiri">Mandiri</option>
                <option value="BRI">BRI</option>
                <option value="BNI">BNI</option>
                <option value="CIMB">CIMB Niaga</option>
                <option value="BTN">BTN</option>
                <option value="Danamon">Danamon</option>
              </Select>
            </Field>
            <Field label="No. Rekening">
              <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} />
            </Field>
          </div>
          <hr className="border-rule" />
          <p className="text-xs font-semibold text-ink-soft">Kontak Darurat</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nama">
              <Input value={emergencyName} onChange={(e) => setEmergencyName(e.target.value)} />
            </Field>
            <Field label="Hubungan">
              <Select value={emergencyRelation} onChange={(e) => setEmergencyRelation(e.target.value)}>
                <option value="">— Pilih —</option>
                <option value="Suami">Suami</option>
                <option value="Istri">Istri</option>
                <option value="Orang Tua">Orang Tua</option>
                <option value="Saudara">Saudara</option>
                <option value="Lainnya">Lainnya</option>
              </Select>
            </Field>
          </div>
          <Field label="No. HP">
            <Input value={emergencyPhone} onChange={(e) => setEmergencyPhone(e.target.value)} />
          </Field>
          {showEditForm && <AccountSection employeeId={selected!} />}
          <Btn variant="official" onClick={showEditForm ? handleEdit : handleAdd} disabled={!name || !email} className="w-full">
            {showEditForm ? "Simpan Perubahan" : "Simpan Karyawan"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}

function AccountSection({ employeeId }: { employeeId: string }) {
  const { state, refresh } = useHris();
  const account = state.data.users.find((u) => u.employeeId === employeeId);
  const [role, setRole] = useState(account?.role ?? "employee");
  const [busy, setBusy] = useState(false);
  const [loginActive, setLoginActive] = useState<boolean | null>(null);
  useEffect(() => {
    if (!account) return;
    void fetch(`/api/users/${account.id}`)
      .then((r) => r.json())
      .then((j) => { if (typeof j.user?.active === "boolean") setLoginActive(j.user.active); })
      .catch(() => undefined);
  }, [account?.id]);
  async function createAccount() {
    setBusy(true);
    const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId, role }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) {
      void showTempPassword(j.email ?? "", j.tempPassword).then(() => toastOk("Akun login dibuat"));
      void refresh();
    } else {
      toastErr(j.error ?? "Gagal membuat akun.");
    }
  }
  if (!account) {
    return (
      <div className="border border-rule bg-paper p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="font-mono text-[11px] tracking-widest text-ink-faint uppercase">Akun Login</p>
          <Stamp kind="pending">Belum ada akun</Stamp>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Role</p>
            <Select value={role} onChange={(e) => setRole(e.target.value as never)} aria-label="Role akun baru" className="min-w-0 py-1.5 text-xs">
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr_admin">HR Admin</option>
              <option value="hr_manager">HR Manager</option>
              <option value="finance">Finance</option>
              <option value="super_admin">Super Admin</option>
            </Select>
          </div>
          <div className="min-w-0">
            <p className="mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Akses Login</p>
            <Btn variant="official" size="sm" disabled={busy} onClick={() => void createAccount()} className="w-full">
              Buat Akun
            </Btn>
          </div>
        </div>
      </div>
    );
  }
  async function save(patch: Record<string, unknown>, msg: string) {
    setBusy(true);
    const r = await fetch(`/api/users/${account!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) {
      toastOk(msg);
      if (typeof (patch as { active?: unknown }).active === "boolean") {
        setLoginActive((patch as { active: boolean }).active);
      } else {
        void refresh();
      }
    } else {
      toastErr(j.error ?? "Gagal.");
    }
  }
  return (
    <div className="border border-rule bg-paper p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-widest text-ink-faint uppercase">Akun Login</p>
        {loginActive !== null && (
          <Stamp kind={loginActive ? "approved" : "rejected"}>
            {loginActive ? <><SealCheck size={11} weight="bold" /> Aktif</> : "Nonaktif"}
          </Stamp>
        )}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Role</p>
          <div className="flex items-center gap-2">
            <Select value={role} onChange={(e) => setRole(e.target.value as never)} aria-label="Role akun" className="min-w-0 flex-1 py-1.5 text-xs">
              <option value="employee">Employee</option>
              <option value="manager">Manager</option>
              <option value="hr_admin">HR Admin</option>
              <option value="hr_manager">HR Manager</option>
              <option value="finance">Finance</option>
              <option value="super_admin">Super Admin</option>
            </Select>
            <Btn variant="secondary" size="sm" disabled={busy || role === account.role} onClick={() => void save({ role }, "Role diperbarui")}>Simpan</Btn>
          </div>
        </div>
        <div className="min-w-0">
          <p className="mb-1 text-xs font-semibold tracking-wide text-ink-soft uppercase">Akses Login</p>
          {loginActive === false ? (
            <Btn variant="official" size="sm" disabled={busy} onClick={() => void save({ active: true }, "Login diaktifkan")} className="w-full">
              Aktifkan Login
            </Btn>
          ) : (
            <Btn variant="danger" size="sm" disabled={busy || loginActive === null} onClick={() => void save({ active: false }, "Login dinonaktifkan")} className="w-full">
              Nonaktifkan Login
            </Btn>
          )}
        </div>
      </div>
    </div>
  );
}

function empStatusStamp(e: Employee) {  if (e.status === "on_leave") return <Stamp kind="neutral">On Leave</Stamp>;
  if (e.employmentType === "probation") return <Stamp kind="pending">Probation</Stamp>;
  if (e.employmentType === "contract") return <Stamp kind="neutral">Kontrak</Stamp>;
  if (e.employmentType === "intern") return <Stamp kind="neutral">Intern</Stamp>;
  return <Stamp kind="approved">Permanen</Stamp>;
}

function EmployeeDetail({ emp }: { emp: Employee }) {
  const { state } = useHris();
  const { data } = state;
  const dept = data.departments.find((d) => d.id === emp.departmentId);
  const pos = data.positions.find((p) => p.id === emp.positionId);
  const loc = data.workLocations.find((w) => w.id === emp.workLocationId);
  const branch = data.branches.find((b) => b.id === emp.branchId);
  const manager = data.employees.find((m) => m.id === emp.managerId);

  // Riwayat absensi 14 hari terakhir
  const history = data.attendance
    .filter((a) => a.employeeId === emp.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 14);

  return (
    <div className="grid gap-6 sm:grid-cols-[200px_1fr]">
      <aside className="space-y-4">
        <div className="flex flex-col items-center gap-3 border border-rule bg-paper p-5">
          <Avatar name={emp.name} size={84} src={emp.photoUrl} />
          <p className="tnum text-center font-mono text-xs text-ink-faint">{emp.id}</p>
          {empStatusStamp(emp)}
        </div>
        <dl className="space-y-2 text-sm">
          <Row k="NIK" v={emp.nik} mono />
          <Row k="Cabang" v={branch?.name ?? "—"} />
          <Row k="Departemen" v={dept?.name ?? "—"} />
          <Row k="Posisi" v={pos?.title ?? "—"} />
          <Row k="Atasan" v={manager?.name ?? "—"} />
          <Row k="Bergabung" v={fmtDateShortID(emp.joinDate)} />
          <Row k="Telepon" v={emp.phone} mono />
          <Row k="Email" v={emp.email} />
        </dl>
      </aside>

      <div className="min-w-0 space-y-6">
        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Lokasi &amp; Absensi</h3>
          <div className="border border-rule bg-paper p-4 text-sm leading-relaxed">
            <p className="font-semibold">{loc?.name}</p>
            <p className="tnum mt-1 text-xs text-ink-soft">
              {loc?.latitude.toFixed(6)}, {loc?.longitude.toFixed(6)} · radius{" "}
              {loc?.radiusM} m · tipe: {loc?.allowedTypes.join(", ")}
            </p>
            <p className={`mt-3 flex items-center gap-1.5 text-xs ${emp.faceRegistered ? "text-official-deep" : "text-stamp-deep"}`}>
              {emp.faceRegistered ? <SealCheck size={13} weight="bold" /> : <WarningCircle size={13} weight="fill" />}
              {emp.faceRegistered ? "Template wajah terdaftar & terenkripsi." : "Wajah belum terdaftar — absensi face verification tidak dapat diproses."}
            </p>
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Kontak Darurat &amp; Bank</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="border border-rule bg-paper p-3 text-sm">
              <p className="font-semibold">{emp.emergencyContact?.name || "—"}</p>
              <p className="text-xs text-ink-soft">{emp.emergencyContact?.relation} · {emp.emergencyContact?.phone}</p>
            </div>
            <div className="border border-rule bg-paper p-3 text-sm">
              <p className="font-semibold">{emp.bankName || "—"}</p>
              <p className="tnum text-xs text-ink-soft">{emp.bankAccount || "—"}</p>
            </div>
          </div>
        </section>

        <section>
          <h3 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Riwayat Kehadiran — 14 Hari</h3>
          {history.length === 0 ? (
            <p className="text-sm text-ink-soft">Belum ada absen.</p>
          ) : (
            <ul className="divide-y divide-ledger/60 border border-rule bg-card px-4">
              {history.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-ink-soft">
                    {parseLocalISO(a.date).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" })}
                  </span>
                  <span className="tnum text-xs text-ink-faint">
                    {a.checkInAt ? new Date(a.checkInAt).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }) : "—"}
                  </span>
                  <StatusMini status={a.status} risk={a.riskScore} />
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-ledger/50 pb-1.5 last:border-b-0">
      <dt className="shrink-0 text-xs text-ink-faint uppercase">{k}</dt>
      <dd className={`${mono ? "tnum" : ""} truncate text-right`}>{v}</dd>
    </div>
  );
}

function StatusMini({ status, risk }: { status: string; risk: number }) {
  const label =
    status === "present" ? "Present" : status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ");
  return (
    <span className="flex items-center gap-2">
      {risk >= 60 && <span className="tnum rounded-[3px] border border-stamp/40 px-1.5 py-0.5 text-[10px] font-semibold text-stamp-deep">RISK {risk}</span>}
      <StatusDot status={status} />
      <span className="w-16 text-xs">{label}</span>
    </span>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = ["present", "wfh"].includes(status)
    ? "bg-official"
    : ["late", "absent", "early_leave"].includes(status)
      ? "bg-stamp"
      : "bg-ledger";
  return <span aria-hidden className={`inline-block h-2 w-2 shrink-0 rounded-full ${color}`} />;
}
