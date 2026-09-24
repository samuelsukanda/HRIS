"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { Bell, Trash } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";

export default function AdminNotificationsPage() {
  const { state, dispatch, refresh } = useHris();
  const { data } = state;

  // ponytail: ambil terbaru tiap buka halaman — tanpa realtime infra
  useEffect(() => { void refresh(); }, [refresh]);

  const notifs = useMemo(
    () => [...data.notifications].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [data.notifications],
  );

  const nameByUserId = useMemo(() => {
    const map = new Map<string, string>();
    for (const u of data.users) {
      const emp = data.employees.find((e) => e.id === u.employeeId);
      map.set(u.id, emp?.name ?? u.email);
    }
    return map;
  }, [data.users, data.employees]);

  function markRead(id: string) {
    dispatch({ type: "MARK_NOTIFICATION_READ", id });
  }
  function markAllRead() {
    for (const n of notifs) dispatch({ type: "MARK_NOTIFICATION_READ", id: n.id });
  }
  function remove(id: string) {
    void dispatch({ type: "DELETE_NOTIFICATION", id });
  }

  return (
    <>
      <PageHead
        title="Notifikasi"
        sub="Seluruh pemberitahuan di seluruh perusahaan, termasuk untuk karyawan."
        action={
          notifs.some((n) => !n.read) ? (
            <Btn variant="secondary" size="sm" onClick={markAllRead}>
              Tandai semua dibaca
            </Btn>
          ) : undefined
        }
      />
      {notifs.length === 0 ? (
        <EmptyState icon={Bell} title="Belum ada notifikasi" />
      ) : (
        <ul className="divide-y divide-ledger/60 border border-rule bg-card">
          {notifs.map((n) => (
            <li key={n.id} className="relative">
              {n.link ? (
                <Link
                  href={n.link}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`block px-4 py-3 pr-10 hover:bg-black/[0.02] ${!n.read ? "border-l-4 border-l-official bg-official/5" : ""}`}
                >
                  <NotifItem n={n} name={nameByUserId.get(n.userId) ?? n.userId} />
                </Link>
              ) : (
                <div
                  onClick={() => !n.read && markRead(n.id)}
                  className={`px-4 py-3 pr-10 ${!n.read ? "border-l-4 border-l-official bg-official/5" : ""}`}
                >
                  <NotifItem n={n} name={nameByUserId.get(n.userId) ?? n.userId} />
                </div>
              )}
              <button
                type="button"
                aria-label="Hapus notifikasi"
                title="Hapus"
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); remove(n.id); }}
                className="btn-press absolute top-2 right-2 cursor-pointer rounded-[4px] p-1.5 text-ink-faint hover:bg-black/[0.06] hover:text-stamp"
              >
                <Trash size={14} weight="bold" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NotifItem({ n, name }: { n: { title: string; body: string; type: string; read: boolean; createdAt: string }; name: string }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${!n.read ? "font-semibold" : ""}`}>{n.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{n.body}</p>
        <p className="tnum mt-1 text-[10px] text-ink-faint">
          {name} · {new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>
      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-official" />}
    </div>
  );
}