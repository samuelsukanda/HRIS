"use client";

import { useMemo } from "react";
import { GraduationCap } from "@phosphor-icons/react";
import { Btn, EmptyState, PageHead, Stamp } from "@/components/ui";
import { confirmDelete, toastOk } from "@/lib/swal";
import { currentUser, useHris } from "@/lib/store";

export default function MyPelatihan() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const me = currentUser(state);

  const trainings = useMemo(() =>
    data.trainings.map((t) => {
      const myEnroll = data.trainingEnrollments.find((e) => e.trainingId === t.id && e.employeeId === me?.employee.id && e.status !== "cancelled");
      return { ...t, enrolled: !!myEnroll, myEnrollment: myEnroll };
    }),
    [data.trainings, data.trainingEnrollments, me],
  );

  const myEnrolled = useMemo(() =>
    data.trainingEnrollments.filter((e) => e.employeeId === me?.employee.id && e.status !== "cancelled"),
    [data.trainingEnrollments, me],
  );

  function enroll(trainingId: string) {
    if (!me) return;
    dispatch({
      type: "ENROLL_TRAINING",
      enrollment: {
        id: `TRE-${String(data.trainingEnrollments.length + 1).padStart(3, "0")}`,
        trainingId,
        employeeId: me.employee.id,
        status: "enrolled",
        enrolledAt: new Date().toISOString(),
      },
    });
    toastOk("Berhasil mendaftar pelatihan");
  }

  async function cancel(enrollmentId: string) {
    if (await confirmDelete("pendaftaran pelatihan ini")) {
      dispatch({ type: "CANCEL_ENROLLMENT", id: enrollmentId });
      toastOk("Pendaftaran dibatalkan");
    }
  }

  return (
    <>
      <PageHead title="Pelatihan" sub="Lihat pelatihan yang tersedia dan riwayat pelatihan Anda." />

      {myEnrolled.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Pelatihan Saya</h2>
          <div className="space-y-2">
            {myEnrolled.map((e) => {
              const t = data.trainings.find((tr) => tr.id === e.trainingId);
              return (
                <div key={e.id} className="flex items-center justify-between border border-rule bg-card p-3">
                  <div>
                    <p className="text-sm font-semibold">{t?.title}</p>
                    <p className="text-xs text-ink-soft">{t?.startDate} — {t?.endDate}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Stamp kind={e.status === "completed" ? "approved" : "pending"}>{e.status}</Stamp>
                    {e.status === "enrolled" && (
                      <Btn variant="danger" size="sm" onClick={() => cancel(e.id)}>Cancel</Btn>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-2 font-mono text-[11px] tracking-widest text-ink-faint uppercase">Pelatihan Tersedia</h2>
        {trainings.length === 0 ? (
          <EmptyState icon={GraduationCap} title="Belum ada pelatihan" body="Cek kembali nanti untuk jadwal pelatihan baru." />
        ) : (
          <div className="space-y-3">
            {trainings.map((t) => (
              <section key={t.id} className="border border-rule bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{t.title}</h3>
                    <p className="text-xs text-ink-soft">{t.provider} · {t.startDate} — {t.endDate}</p>
                  </div>
                  <Stamp kind={t.status === "completed" ? "approved" : t.enrolled ? "pending" : "neutral"}>
                    {t.enrolled ? "Enrolled" : t.status}
                  </Stamp>
                </div>
                <p className="mt-2 text-sm text-ink-soft">{t.description}</p>
                {!t.enrolled && t.status === "upcoming" && (
                  <Btn variant="official" size="sm" onClick={() => enroll(t.id)} className="mt-3">
                    Daftar
                  </Btn>
                )}
              </section>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
