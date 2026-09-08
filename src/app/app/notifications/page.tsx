"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Bell } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";

export default function NotificationsPage() {
  const { state, dispatch, refresh } = useHris();
  const { data } = state;
  const me = currentUser(state);

  // ponytail: ambil terbaru tiap buka halaman — tanpa realtime infra
  // eslint-disable-next-line react-hooks/set-state-in-effect -- refresh eksplisit saat mount, bukan derive-state
  useEffect(() => { void refresh(); }, [refresh]);

  const myNotifs = me
    ? data.notifications
        .filter((n) => n.userId === me.user.id)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    : [];

  function markRead(id: string) {
    dispatch({ type: "MARK_NOTIFICATION_READ", id });
  }

  function markAllRead() {
    if (me) dispatch({ type: "MARK_ALL_NOTIFICATIONS_READ", userId: me.user.id });
  }

  return (
    <>
      <PageHead
        title="Notifikasi"
        sub="Pemberitahuan penting dari sistem HRIS."
        action={
          myNotifs.some((n) => !n.read) ? (
            <Btn variant="secondary" size="sm" onClick={markAllRead}>
              Tandai semua dibaca
            </Btn>
          ) : undefined
        }
      />
      {myNotifs.length === 0 ? (
        <EmptyState icon={Bell} title="Tidak ada notifikasi" body="Notifikasi akan muncul saat ada pengajuan yang perlu persetujuan." />
      ) : (
        <ul className="divide-y divide-ledger/60 border border-rule bg-card">
          {myNotifs.map((n) => (
            <li key={n.id}>
              {n.link ? (
                <Link
                  href={n.link}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`block px-4 py-3 hover:bg-black/[0.02] ${!n.read ? "border-l-4 border-l-official bg-official/5" : ""}`}
                >
                  <NotifItem n={n} />
                </Link>
              ) : (
                <div
                  onClick={() => !n.read && markRead(n.id)}
                  className={`px-4 py-3 ${!n.read ? "border-l-4 border-l-official bg-official/5" : ""}`}
                >
                  <NotifItem n={n} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function NotifItem({ n }: { n: { title: string; body: string; type: string; read: boolean; createdAt: string } }) {
  return (
    <div className="flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <p className={`text-sm ${!n.read ? "font-semibold" : ""}`}>{n.title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-ink-soft">{n.body}</p>
        <p className="tnum mt-1 text-[10px] text-ink-faint">{new Date(n.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
      </div>
      {!n.read && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-official" />}
    </div>
  );
}
