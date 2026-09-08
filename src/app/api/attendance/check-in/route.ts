import { pool } from "@/db/client";
import { checkGeofence, classifyCheckIn, computeRisk, descriptorDistance, runValidationPipeline, statusFromCheckIn } from "@/lib/engine";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import { decryptDescriptor } from "@/lib/server/crypto";
import { toLocalISO } from "@/lib/format";
import type { AttendanceRecord, VerificationSnapshot } from "@/lib/types";

interface CheckInBody {
  latitude: number;
  longitude: number;
  accuracyM: number;
  mockLocation: boolean;
  developerMode: boolean;
  /** Descriptor wajah live (128-dim) — dicocokkan server terhadap template terdaftar. */
  descriptor: number[];
  livenessScore: number;
  livenessPassed: boolean;
  deviceId: string;
  deviceName: string;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Tidak masuk." }, { status: 401 });

  const body = (await req.json()) as CheckInBody;
  const empR = await pool.query(
    `SELECT e.*, w.latitude lat, w.longitude lng, w.radius_m, w.name loc_name
     FROM employees e JOIN work_locations w ON w.id = e.work_location_id WHERE e.id = $1`,
    [user.employee_id],
  );
  const emp = empR.rows[0];
  if (!emp) return Response.json({ ok: false, error: "Karyawan tidak ditemukan." }, { status: 404 });

  const now = new Date();
  const date = toLocalISO(now);

  // Sudah absen hari ini?
  const existingId = `ATT-${date.replaceAll("-", "")}-${emp.id}`;
  const dup = await pool.query(`SELECT id, check_in_at FROM attendance WHERE id = $1`, [existingId]);
  if (dup.rows[0]?.check_in_at) {
    return Response.json({ ok: false, error: "Anda sudah melakukan check-in hari ini.", code: "duplicate" }, { status: 409 });
  }

  // ── Kebijakan WFH dari server (bukan klaim client) ──
  const setR = await pool.query(`SELECT key, value FROM settings WHERE key IN ('wfh_gps','wfh_face','wfh_liveness')`);
  const policy = Object.fromEntries(setR.rows.map((x: { key: string; value: string }) => [x.key, x.value]));
  const wfhFaceRequired = (policy.wfh_face ?? "WAJIB") === "WAJIB";
  const wfhLiveRequired = (policy.wfh_liveness ?? "WAJIB") === "WAJIB";
  const isWfh = (body as CheckInBody & { wfh?: boolean }).wfh === true;

  // ── 03 Geofence — hard gate di server (dilewati untuk WFH) ──
  const office = { latitude: emp.lat, longitude: emp.lng, radiusM: emp.radius_m };
  const geo = isWfh
    ? { pass: true, distanceM: -1, maxRadiusM: emp.radius_m }
    : checkGeofence({ latitude: body.latitude, longitude: body.longitude }, office);
  if (!geo.pass) {
    return Response.json({
      ok: false,
      code: "outside_geofence",
      title: "Absensi tidak dapat diproses.",
      lines: [
        `Lokasi Anda berada ${geo.distanceM} m dari lokasi kerja.`,
        `Maksimum radius: ${office.radiusM} m.`,
        "Mendekatlah ke area kantor, lalu coba lagi.",
      ],
    }, { status: 422 });
  }

  // ── Perangkat: dikenal dari riwayat snapshot? ──
  const hist = await pool.query(
    `SELECT check_in_snap, check_out_snap FROM attendance
     WHERE employee_id = $1 AND (check_in_snap IS NOT NULL OR check_out_snap IS NOT NULL) LIMIT 30`,
    [emp.id],
  );
  const knownDevices = new Set<string>();
  for (const row of hist.rows) {
    if (row.check_in_snap?.deviceId) knownDevices.add(row.check_in_snap.deviceId);
    if (row.check_out_snap?.deviceId) knownDevices.add(row.check_out_snap.deviceId);
  }
  const firstEver = knownDevices.size === 0;
  const deviceTrusted = firstEver || knownDevices.has(body.deviceId);

  // ── Jadwal & window ──
  const rosterR = await pool.query(`SELECT shift_id FROM roster WHERE employee_id = $1 AND date = $2`, [emp.id, date]);
  const shiftId = rosterR.rows[0]?.shift_id ?? null;
  let shift: { start: string; graceMinutes: number } | null = null;
  if (shiftId) {
    const s = await pool.query(`SELECT start_time, grace_minutes FROM shifts WHERE id = $1`, [shiftId]);
    if (s.rows[0]) shift = { start: s.rows[0].start_time, graceMinutes: s.rows[0].grace_minutes };
  }
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const withinWindow = shift ? Math.abs(nowMin - (+shift.start.slice(0, 2) * 60 + +shift.start.slice(3))) <= 60 : false;

  // ── Verifikasi wajah 1:1 — descriptor live vs template terdaftar (server-side) ──
  // WFH ikut policy server: bila TIDAK DIWAJIBKAN, tahap dilewati (tetap tercatat di snapshot)
  const stored = emp.face_descriptor ? decryptDescriptor(emp.face_descriptor as any) : null;
  if (!stored && (wfhFaceRequired || !isWfh)) {
    return Response.json({
      ok: false,
      code: "face_not_registered",
      title: "Wajah belum terdaftar.",
      lines: ["Daftarkan wajah Anda lewat menu Profil sebelum absen.", "Registrasi memakan waktu ±20 detik."],
    }, { status: 422 });
  }
  if (!Array.isArray(body.descriptor) || body.descriptor.length !== 128) {
    if (!isWfh || wfhFaceRequired) {
      return Response.json({
        ok: false,
        code: "face_invalid",
        title: "Data wajah tidak valid.",
        lines: ["Wajah tidak terbaca jelas.", "Pastikan pencahayaan cukup dan wajah menghadap kamera."],
      }, { status: 422 });
    }
  }
  const hasDescriptor = Array.isArray(body.descriptor) && body.descriptor.length === 128 && !!stored;
  const faceDistance = hasDescriptor ? descriptorDistance(body.descriptor as number[], stored as number[]) : 1;
  const faceMatch = hasDescriptor ? faceDistance < 0.5 : false;
  const livenessOk = !!body.livenessPassed || (isWfh && !wfhLiveRequired);

  // ── Pipeline penuh di server ──
  const pipeline = runValidationPipeline({
    authenticated: true,
    deviceTrusted,
    gpsActive: isWfh || Number.isFinite(body.latitude),
    geofence: geo,
    mockLocation: !!body.mockLocation,
    faceDetected: hasDescriptor,
    livenessPassed: livenessOk,
    faceScore: faceMatch ? 0.95 : 0.6,
    faceMatch: faceMatch || (isWfh && !wfhFaceRequired),
    faceDetail: hasDescriptor ? `Jarak wajah ${faceDistance.toFixed(2)} (threshold 0,50)` : "Verifikasi wajah dilewati (policy WFH)",
    hasScheduleToday: !!shift,
    withinCheckInWindow: withinWindow,
  });

  const risk = computeRisk({
    mockLocation: !!body.mockLocation,
    developerMode: !!body.developerMode,
    accuracyM: body.accuracyM ?? 0,
    faceScore: faceMatch ? 0.95 : 0.6,
    livenessPassed: livenessOk,
    distanceOverByM: 0,
    deviceChanged: !deviceTrusted && !firstEver,
  });

  const criticalFail = pipeline.stages.find((s) => !s.pass && [3, 5, 6].includes(s.stage));
  const faceGateOk = faceMatch || (isWfh && !wfhFaceRequired);
  const verificationStatus = criticalFail
    ? "rejected"
    : risk.score >= 60
      ? "review"
      : pipeline.valid && faceGateOk
        ? "valid"
        : "review";

  const classification = shift ? classifyCheckIn(shift as never, now) : { kind: "early" as const, lateMinutes: 0 };
  // WFH tercatat sebagai status wfh agar rekap & UI konsisten
  const finalStatus = isWfh ? ("wfh" as const) : statusFromCheckIn(classification);

  const snap: VerificationSnapshot = {
    at: now.toISOString(),
    latitude: body.latitude,
    longitude: body.longitude,
    accuracyM: body.accuracyM ?? 0,
    distanceM: geo.distanceM,
    mockLocation: !!body.mockLocation,
    developerMode: !!body.developerMode,
    faceScore: Math.max(0, Math.min(1, 1 - faceDistance)),
    faceDistance,
    livenessScore: body.livenessScore ?? 0,
    livenessPassed: livenessOk,
    deviceId: body.deviceId ?? "-",
    deviceName: body.deviceName ?? "-",
    ip: req.headers.get("x-forwarded-for") ?? "local",
    stages: pipeline.stages,
  };

  await pool.query(
    `INSERT INTO attendance (id,employee_id,date,check_in_at,check_in_snap,status,risk_score,verification_status,rejection_reason,corrections)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'[]'::jsonb)
     ON CONFLICT (id) DO NOTHING`,
    [
      existingId, emp.id, date, now,
      JSON.stringify(snap),
      finalStatus,
      risk.score,
      verificationStatus,
      criticalFail ? criticalFail.detail : null,
    ],
  );

  const actorName = emp.name;
  await writeAudit({
    actorId: user.id,
    actorName,
    action: verificationStatus === "rejected" ? "Attendance rejected" : "Checked in",
    targetType: "attendance",
    targetId: existingId,
    detail: isWfh ? `Check-in WFH · risiko ${risk.score}/100 (${verificationStatus})` : `Check-in ${emp.loc_name} · jarak ${geo.distanceM} m · risiko ${risk.score}/100 (${verificationStatus})`,
    at: snap.at,
  });

  const record: AttendanceRecord = {
    id: existingId,
    employeeId: emp.id,
    date,
    checkInAt: snap.at,
    checkInSnap: snap,
    status: finalStatus,
    riskScore: risk.score,
    verificationStatus,
    rejectionReason: criticalFail?.detail,
    corrections: [],
  };
  return Response.json({ ok: true, record });
}
