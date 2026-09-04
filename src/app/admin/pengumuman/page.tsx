"use client";

import { useState } from "react";
import { Megaphone, Pencil, Trash } from "@phosphor-icons/react";
import { Btn, EmptyState, Field, IconBtn, Input, Modal, PageHead, Select, Textarea } from "@/components/ui";
import { useHris } from "@/lib/store";
import { confirmDelete, toastOk } from "@/lib/swal";

type Cat = "pengumuman" | "kebijakan" | "libur" | "acara";

export default function AdminPengumumanPage() {
  const { state, dispatch } = useHris();
  const { data } = state;
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Cat>("pengumuman");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  function reset() {
    setTitle(""); setBody(""); setCategory("pengumuman"); setDate(new Date().toISOString().slice(0, 10));
    setShowForm(false); setEditId(null);
  }

  function openEdit(a: { id: string; title: string; body: string; category: Cat; date: string }) {
    setEditId(a.id); setTitle(a.title); setBody(a.body); setCategory(a.category); setDate(a.date); setShowForm(true);
  }

  async function submit() {
    if (!title.trim() || !body.trim()) return;
    if (editId) {
      dispatch({ type: "UPDATE_ANNOUNCEMENT", id: editId, title: title.trim(), body: body.trim(), category, date });
      toastOk("Pengumuman disimpan");
    } else {
      const id = `ANN-${String(data.announcements.length + 1).padStart(3, "0")}`;
      dispatch({ type: "CREATE_ANNOUNCEMENT", announcement: { id, title: title.trim(), body: body.trim(), category, date } });
      toastOk("Pengumuman diterbitkan");
    }
    reset();
  }

  async function del(id: string) {
    const a = data.announcements.find((x) => x.id === id);
    if (await confirmDelete(a?.title ?? "pengumuman ini")) {
      dispatch({ type: "DELETE_ANNOUNCEMENT", id });
      toastOk("Pengumuman dihapus");
    }
  }

  return (
    <>
      <PageHead
        title="Pengumuman"
        sub="Kelola dan publikasikan informasi penting untuk seluruh karyawan."
        action={<Btn variant="official" size="sm" onClick={() => { reset(); setShowForm(true); }}>+ Pengumuman</Btn>}
      />

      {data.announcements.length === 0 ? (
        <EmptyState icon={Megaphone} title="Belum ada pengumuman" body="Buat pengumuman baru untuk karyawan." />
      ) : (
        <ul className="space-y-3">
          {data.announcements.map((a) => (
            <li key={a.id} className="border border-rule bg-card p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">{a.title}</h3>
                <div className="flex items-center gap-2">
                  <span className="shrink-0 rounded bg-ink/5 px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-soft">{a.category}</span>
                  <IconBtn label={`Edit ${a.title}`} icon={Pencil} onClick={() => openEdit(a)} />
                  <IconBtn label={`Hapus ${a.title}`} icon={Trash} onClick={() => del(a.id)} className="hover:text-stamp" />
                </div>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{a.body}</p>
              <p className="tnum mt-2 text-[10px] text-ink-faint">{a.date}</p>
            </li>
          ))}
        </ul>
      )}

      <Modal open={showForm} onClose={reset} title={editId ? "Edit Pengumuman" : "Pengumuman Baru"}>
        <div className="space-y-3">
          <Field label="Judul">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul pengumuman" />
          </Field>
          <Field label="Kategori">
            <Select value={category} onChange={(e) => setCategory(e.target.value as Cat)}>
              <option value="pengumuman">Pengumuman</option>
              <option value="kebijakan">Kebijakan</option>
              <option value="libur">Libur</option>
              <option value="acara">Acara</option>
            </Select>
          </Field>
          <Field label="Tanggal">
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </Field>
          <Field label="Isi">
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Isi pengumuman..." />
          </Field>
          <Btn variant="official" onClick={submit} disabled={!title.trim() || !body.trim()} className="w-full">
            {editId ? "Simpan Perubahan" : "Publikasikan"}
          </Btn>
        </div>
      </Modal>
    </>
  );
}
