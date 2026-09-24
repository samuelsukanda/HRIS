"use client";

import { useMemo, useState } from "react";
import { Key, MagnifyingGlass, Play, Prohibit } from "@phosphor-icons/react";
import { Avatar, Btn, EmptyState, IconBtn, Input, PageHead, Pager, Select, Stamp } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";
import { showTempPassword, toastErr, toastOk } from "@/lib/swal";
import type { User } from "@/lib/types";
import { isHr } from "@/lib/roles";

export default function AdminAccounts() {
  const { state } = useHris();
  const { data } = state;
  const me = currentUser(state);
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const LIMIT = 10;

  const rows = useMemo(() => {
    if (!me || !isHr(me.user.role)) return [];
    return data.employees
      .filter((e) => e.status !== "resigned" && e.status !== "inactive")
      .filter((e) => {
        const account = data.users.find((u) => u.employeeId === e.id);
        if (statusFilter === "with" && !account) return false;
        if (statusFilter === "without" && account) return false;
        if (!q.trim()) return true;
        return `${e.name} ${e.id} ${e.email}`.toLowerCase().includes(q.toLowerCase());
      });
  }, [data, q, statusFilter, me]);

  const paged = rows.slice((page - 1) * LIMIT, page * LIMIT);

  if (!state.session) return null;
  if (!me || !isHr(me.user.role)) {
    return (
      <>
        <PageHead title="Kelola Akun" sub="Kelola akun login karyawan." />
        <EmptyState icon={Prohibit} title="Akses ditolak" body="Hanya HR dan super admin yang dapat mengelola akun login." />
      </>
    );
  }

  return (
    <>
      <PageHead
        title="Kelola Akun"
        sub="Buat akun login karyawan, atur role, reset password, dan atur akses login."
        action={
          <div className="flex items-center gap-3">
            <span className="tnum text-sm text-ink-faint">{rows.length} karyawan</span>
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-56 flex-1">
          <MagnifyingGlass size={15} className="absolute top-1/2 left-3 -translate-y-1/2 text-ink-faint" />
          <Input placeholder="Cari nama, ID, email…" value={q} onChange={(e) => setQ(e.target.value)} className="pl-8" />
        </div>
        <div className="w-44 shrink-0">
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filter status akun">
            <option value="all">Semua status</option>
            <option value="with">Ada akun</option>
            <option value="without">Belum ada akun</option>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState icon={MagnifyingGlass} title="Tidak ditemukan" body="Tidak ada karyawan yang cocok dengan pencarian atau filter." />
      ) : (
        <div className="overflow-x-auto border border-rule bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-rule text-left font-mono text-[11px] tracking-widest text-ink-faint uppercase">
                <th className="px-4 py-2.5 font-medium">Karyawan</th>
                <th className="px-3 py-2.5 font-medium">Email</th>
                <th className="px-3 py-2.5 font-medium">Role</th>
                <th className="px-3 py-2.5 font-medium">Status Akun</th>
                <th className="px-3 py-2.5 text-center font-medium">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paged.map((e) => {
                const account = data.users.find((u) => u.employeeId === e.id);
                return (
                  <tr key={e.id} className="border-b border-ledger/60 transition-colors last:border-b-0 hover:bg-black/[0.02]">
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={e.name} size={30} src={e.photoUrl} />
                        <span>
                          <span className="block font-semibold text-official">{e.name}</span>
                          <span className="tnum block text-xs text-ink-faint">{e.id}</span>
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-ink-soft">{e.email || "—"}</td>
                    <td className="px-3 py-2.5">{account ? <RoleCell user={account} /> : <span className="text-ink-faint">—</span>}</td>
                    <td className="px-3 py-2.5">
                      {!account ? (
                        <Stamp kind="pending">Belum ada akun</Stamp>
                      ) : account.active === false ? (
                        <Stamp kind="rejected">Nonaktif</Stamp>
                      ) : (
                        <Stamp kind="approved">Aktif</Stamp>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <AccountActions employeeId={e.id} account={account} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Pager page={page} total={rows.length} limit={LIMIT} onChange={setPage} />
    </>
  );
}

function RoleCell({ user }: { user: User }) {
  const { refresh } = useHris();
  const [role, setRole] = useState<User["role"]>(user.role);
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await fetch(`/api/users/${user.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ role }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) {
      toastOk("Role diperbarui");
      void refresh();
    } else {
      toastErr(j.error ?? "Gagal memperbarui role.");
    }
  }
  return (
    <div className="flex items-center gap-1.5">
      <Select value={role} onChange={(e) => setRole(e.target.value as User["role"])} aria-label={`Role ${user.email}`} className="min-w-0 py-1 text-xs">
        <option value="employee">Employee</option>
        <option value="supervisor">Supervisor</option>
        <option value="manager">Manager</option>
        <option value="hr">HR</option>
        <option value="super_admin">Super Admin</option>
      </Select>
      <Btn variant="secondary" size="sm" disabled={busy || role === user.role} onClick={() => void save()}>Simpan</Btn>
    </div>
  );
}

function AccountActions({ employeeId, account }: { employeeId: string; account?: User }) {
  const { refresh } = useHris();
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    const r = await fetch("/api/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ employeeId }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) {
      void showTempPassword(j.email ?? "", j.tempPassword).then(() => toastOk("Akun login dibuat"));
      void refresh();
    } else {
      toastErr(j.error ?? "Gagal membuat akun.");
    }
  }
  async function toggleActive(active: boolean) {
    setBusy(true);
    const r = await fetch(`/api/users/${account!.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) {
      toastOk(active ? "Login diaktifkan" : "Login dinonaktifkan");
      void refresh();
    } else {
      toastErr(j.error ?? "Gagal memperbarui status login.");
    }
  }
  async function resetPassword() {
    setBusy(true);
    const r = await fetch(`/api/users/${account!.id}/reset-password`, { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (j.ok) {
      void showTempPassword(account!.email, j.tempPassword).then(() => toastOk("Password direset"));
    } else {
      toastErr(j.error ?? "Gagal reset password.");
    }
  }
  if (!account) {
    return <Btn variant="official" size="sm" disabled={busy} onClick={() => void create()}>Buat Akun</Btn>;
  }
  return (
    <div className="flex justify-center gap-1">
      <IconBtn label="Reset password" icon={Key} disabled={busy} onClick={() => void resetPassword()} />
      {account.active === false ? (
        <IconBtn label="Aktifkan login" icon={Play} disabled={busy} onClick={() => void toggleActive(true)} />
      ) : (
        <IconBtn label="Nonaktifkan login" icon={Prohibit} disabled={busy} onClick={() => void toggleActive(false)} className="hover:text-stamp" />
      )}
    </div>
  );
}
