"use client";

import { useMemo, useState } from "react";
import { GraduationCap, Pencil, Trash } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, IconBtn, Input, Modal, PageHead, Pager, Select, Stamp, Textarea } from "@/components/ui";
import { useHris } from "@/lib/store";
import { confirmDelete, toastOk } from "@/lib/swal";
import type { Training } from "@/lib/types";

type TrainingStatus = "upcoming" | "ongoing" | "completed";

const STATUS_KIND: Record<TrainingStatus, "pending" | "approved" | "neutral"> = {
  upcoming: "pending",
  ongoing: "neutral",
  completed: "approved",
};

export default function AdminPelatihan() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const LIMIT = 10;

  // Form Fields
  const [title, setTitle] = useState("");
  const [provider, setProvider] = useState("");
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [maxParticipants, setMaxParticipants] = useState(20);
  const [status, setStatus] = useState<TrainingStatus>("upcoming");

  const trainings = useMemo(() =>
    data.trainings
      .filter((t) => {
        if (!q.trim()) return true;
        return `${t.title} ${t.provider} ${t.description}`.toLowerCase().includes(q.toLowerCase());
      })
      .map((t) => ({
        ...t,
        enrolled: data.trainingEnrollments.filter((e) => e.trainingId === t.id && e.status !== "cancelled").length,
        enrollments: data.trainingEnrollments.filter((e) => e.trainingId === t.id),
      })),
    [data.trainings, data.trainingEnrollments, q],
  );
  const pagedTrainings = trainings.slice((page - 1) * LIMIT, page * LIMIT);

  function resetForm() {
    setTitle(""); setProvider(""); setStartDate(new Date().toISOString().slice(0, 10));
    setEndDate(new Date().toISOString().slice(0, 10)); setDescription(""); setMaxParticipants(20);
    setStatus("upcoming"); setEditId(null); setShowForm(false);
  }

  function startEdit(t: Training) {
    setEditId(t.id);
    setTitle(t.title);
    setProvider(t.provider);
    setStartDate(t.startDate);
    setEndDate(t.endDate);
    setDescription(t.description);
    setMaxParticipants(t.maxParticipants);
    setStatus(t.status as TrainingStatus);
    setShowForm(true);
  }

  function handleSave() {
    if (!title || !provider) return;
    if (editId) {
      dispatch({
        type: "UPDATE_TRAINING",
        id: editId,
        data: { title, provider, startDate, endDate, description, maxParticipants, status },
      });
      toastOk("Pelatihan disimpan");
    } else {
      const newTraining: Training = {
        id: `TRN-${String(data.trainings.length + 100).padStart(3, "0")}`,
        title, provider, startDate, endDate, description, maxParticipants, status,
      };
      dispatch({ type: "CREATE_TRAINING", training: newTraining });
      toastOk("Pelatihan ditambahkan");
    }
    resetForm();
  }

  async function handleDelete(id: string) {
    const t = data.trainings.find((x) => x.id === id);
    if (await confirmDelete(t?.title ?? "pelatihan ini")) {
      dispatch({ type: "DELETE_TRAINING", id });
      toastOk("Pelatihan dihapus");
    }
  }

  return (
    <>
      <PageHead
        title="Pelatihan"
        sub="Jadwal pelatihan, pendaftaran, dan tracking completion karyawan."
        action={<Btn variant="official" size="sm" onClick={() => { resetForm(); setShowForm(true); }}>+ Pelatihan</Btn>}
      />
      <div className="mb-4 max-w-md">
        <Input placeholder="Cari judul / provider…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {trainings.length === 0 ? (
        <EmptyState icon={GraduationCap} title="Belum ada pelatihan" body="Buat jadwal pelatihan baru untuk karyawan." />
      ) : (
        <div className="space-y-4">
          {pagedTrainings.map((t) => (
            <section key={t.id} className="border border-rule bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-official">{t.title}</h3>
                  <p className="text-xs text-ink-soft">{t.provider} · {t.startDate} — {t.endDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Stamp kind={STATUS_KIND[t.status as TrainingStatus] ?? "neutral"}>{t.status}</Stamp>
                  <IconBtn label={`Edit ${t.title}`} icon={Pencil} onClick={() => startEdit(t as any)} />
                  <IconBtn label={`Hapus ${t.title}`} icon={Trash} onClick={() => handleDelete(t.id)} />
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-soft">{t.description}</p>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-ink-faint">{t.enrolled}/{t.maxParticipants} peserta terdaftar</span>
                <div className="flex-1 mx-4 h-1.5 rounded-full bg-ink/5">
                  <div className="h-full rounded-full bg-official" style={{ width: `${Math.min(100, (t.enrolled / t.maxParticipants) * 100)}%` }} />
                </div>
              </div>
              {t.enrollments.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {t.enrollments.filter((e) => e.status !== "cancelled").map((e) => {
                    const emp = data.employees.find((em) => em.id === e.employeeId);
                    return (
                      <span key={e.id} className={`inline-block rounded border px-2 py-0.5 text-[10px] font-medium ${e.status === "completed" ? "border-official/30 bg-official/5 text-official" : "border-rule bg-paper text-ink-soft"}`}>
                        {emp?.name ?? e.employeeId}
                      </span>
                    );
                  })}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
      <Pager page={page} total={trainings.length} limit={LIMIT} onChange={setPage} />

      <Modal open={showForm} onClose={resetForm} title={editId ? "Edit Pelatihan" : "Pelatihan Baru"}>
        <div className="space-y-3">
          <Field label="Judul Pelatihan">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </Field>
          <Field label="Penyelenggara / Provider">
            <Input value={provider} onChange={(e) => setProvider(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Mulai">
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </Field>
            <Field label="Selesai">
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kuota Peserta">
              <Input type="number" value={maxParticipants} onChange={(e) => setMaxParticipants(Number(e.target.value))} />
            </Field>
            <Field label="Status">
              <Select value={status} onChange={(e) => setStatus(e.target.value as TrainingStatus)}>
                <option value="upcoming">Upcoming</option>
                <option value="ongoing">Ongoing</option>
                <option value="completed">Completed</option>
              </Select>
            </Field>
          </div>
          <Field label="Deskripsi">
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </Field>
          <Btn variant="official" onClick={handleSave} disabled={!title || !provider} className="w-full">
            {editId ? "Simpan Perubahan" : "Buat Jadwal"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
