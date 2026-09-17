import { pool } from "@/db/client";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";

const HR = ["hr_manager","hr_admin","super_admin"];

export async function GET() {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  const r = await pool.query(`SELECT * FROM settings`);
  return Response.json({ settings: Object.fromEntries(r.rows.map((x: { key: string; value: string }) => [x.key, x.value])) });
}

export async function PATCH(req: Request) {
  const u = await getSessionUser(); if (!u) return Response.json({ ok: false }, { status: 401 });
  if (!HR.includes(u.role)) return Response.json({ ok: false }, { status: 403 });
  const body = await req.json() as Record<string, string>;
  const actor = (await pool.query(`SELECT name FROM employees WHERE id=$1`, [u.employee_id])).rows[0]?.name ?? u.employee_id;
  const ALLOWED_KEYS = new Set(["wfh_gps", "wfh_face", "wfh_liveness", "checkin_window", "ot_mode", "ot_flat_rate", "alpha_mode", "alpha_flat_rate"]);
  const entries = Object.entries(body).filter(([k]) => ALLOWED_KEYS.has(k));
  if (entries.length === 0) return Response.json({ ok: false, error: "Key tidak dikenal." }, { status: 400 });
  const MODES: Record<string, string[]> = { ot_mode: ["formula", "flat"], alpha_mode: ["proportional", "flat"] };
  for (const [key, value] of entries) {
    if (key === "checkin_window" && (!/^\d+$/.test(value) || Number(value) < 5 || Number(value) > 720)) {
      return Response.json({ ok: false, error: "Window 5–720 menit." }, { status: 400 });
    }
    if (MODES[key] && !MODES[key].includes(value)) {
      return Response.json({ ok: false, error: `Nilai ${key} tidak valid.` }, { status: 400 });
    }
    if ((key === "ot_flat_rate" || key === "alpha_flat_rate") && (!/^\d+$/.test(value) || Number(value) > 100_000_000)) {
      return Response.json({ ok: false, error: "Tarif harus angka 0–100.000.000." }, { status: 400 });
    }
    await pool.query(`INSERT INTO settings (key,value,updated_at) VALUES ($1,$2,NOW()) ON CONFLICT (key) DO UPDATE SET value=$2, updated_at=NOW()`, [key, value]);
    await writeAudit({ actorId: u.id, actorName: actor, action: "Setting updated", targetType: "setting", targetId: key, detail: `${key}=${value}`, at: new Date().toISOString() });
  }
  return Response.json({ ok: true });
}
