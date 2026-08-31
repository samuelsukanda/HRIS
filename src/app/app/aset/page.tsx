"use client";

import { useMemo } from "react";
import { Package } from "@phosphor-icons/react";
import { EmptyState, PageHead, Stamp } from "@/components/ui";
import { currentUser, useHris } from "@/lib/store";

export default function MyAset() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);

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

  const active = myAssignments.filter((a) => !a.returnedAt);
  const history = myAssignments.filter((a) => a.returnedAt);

  return (
    <>
      <PageHead title="Aset Saya" sub="Aset yang ditugaskan kepada Anda." />
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
                    <button onClick={()=> dispatch({ type:"RETURN_ASSET", assignmentId:a.id })} className="mt-2 text-xs text-official hover:underline">Ajukan Pengembalian →</button>
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
