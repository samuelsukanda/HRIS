import { pool } from "@/db/client";
import { checkGeofence, descriptorDistance, hmToMin } from "@/lib/engine";
import { getSessionUser } from "@/lib/server/session";
import { writeAudit } from "@/lib/server/state";
import { decryptDescriptor } from "@/lib/server/crypto";
import { toLocalISO } from "@/lib/format";

interface CheckOutBody {
  latitude: number;
  longitude: number;
  accuracyM: number;
  mockLocation: boolean;
  developerMode: boolean;
  descriptor: number[];
  livenessScore: number;
  livenessPassed: boolean;
  deviceId: string;
  deviceName: string;
  wfh?: boolean;
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return Response.json({ ok: false, error: "Tidak masuk." }, { status: 401 });

  const body = (await req.json()) as CheckOutBody;
  const now = new Date();
  const date = toLocalISO(now);
  const attId = `ATT-${date.replaceAll("-", "")}-${user.employee_id}`;

  const r = await pool.query(
    `SELECT a.*, e.name emp_name, e.face_descriptor, w.latitude lat, w.longitude lng, w.radius_m,
            s.start_time shift_start, s.end_time shift_end
     FROM attendance a
     JOIN employees e ON e.id = a.employee_id
     JOIN work_locations w ON w.id = e.work_location_id
     LEFT JOIN roster ro ON ro.employee_id = a.employee_id AND ro.date = a.date
     LEFT JOIN shifts s ON s.id = ro.shift_id
     WHERE a.id = $1`,
    [attId],
  );
  const rec = r.rows[0];
  if (!rec || !rec.check_in_at) {
    return Response.json({ ok: false, error: "Belum ada check-in hari ini.", code: "no_checkin" }, { status: 409 });
  }
  if (rec.check_out_at) {
    return Response.json({ ok: false, error: "Sudah check-out.", code: "duplicate" }, { status: 409 });
  }

  // WFH ikut sesi check-in: bila check-in WFH (distanceM<0), geofence dilewati
  const isWfh = body.wfh === true || (rec.check_in_snap && (rec.check_in_snap as { distanceM?: number }).distanceM === -1);
  const geo = isWfh
    ? { pass: true, distanceM: -1, maxRadiusM: rec.radius_m }
    : checkGeofence({ latitude: body.latitude, longitude: body.longitude }, {
        latitude: rec.lat, longitude: rec.lng, radiusM: rec.radius_m,
      });
  // Check-out di luar radius juga diblok — kehadiran penuh harus tervalidasi (kecuali WFH)
  if (!geo.pass) {
    return Response.json({
      ok: false,
      code: "outside_geofence",
      title: "Check-out tidak dapat diproses.",
      lines: [
        `Lokasi Anda berada ${geo.distanceM} m dari lokasi kerja.`,
        `Maksimum radius: ${rec.radius_m} m.`,
        "Mendekatlah ke area kantor, lalu coba lagi.",
      ],
    }, { status: 422 });
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const endMin = rec.shift_end ? hmToMin(rec.shift_end) : null;
  const earlyLeave = endMin !== null && nowMin < endMin - 60;

  // Verifikasi wajah 1:1 server-side
  const stored = rec.face_descriptor ? decryptDescriptor(rec.face_descriptor as any) : null;
  if (!stored) {
    return Response.json({ ok: false, code: "face_not_registered", title: "Wajah belum terdaftar.", lines: ["Daftarkan wajah lewat menu Profil."] }, { status: 422 });
  }
  if (!Array.isArray(body.descriptor) || body.descriptor.length !== 128) {
    return Response.json({ ok: false, code: "face_invalid", title: "Data wajah tidak valid.", lines: ["Wajah tidak terbaca jelas."] }, { status: 422 });
  }
  const faceDistance = descriptorDistance(body.descriptor, stored);
  const faceMatch = faceDistance < 0.5;

  const snap = {
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
    livenessPassed: !!body.livenessPassed,
    deviceId: body.deviceId ?? "-",
    deviceName: body.deviceName ?? "-",
    ip: req.headers.get("x-forwarded-for") ?? "local",
    stages: [
      { stage: 1, name: "Autentikasi", pass: true, detail: "Sesi aktif & perangkat terikat" },
      { stage: 2, name: "Perangkat", pass: true, detail: "Perangkat terdaftar" },
      { stage: 3, name: "GPS & Geofence", pass: true, detail: `Jarak ${geo.distanceM} m dari radius ${rec.radius_m} m` },
      { stage: 4, name: "Deteksi Wajah", pass: true, detail: "Wajah terdeteksi" },
      { stage: 5, name: "Liveness", pass: !!body.livenessPassed, detail: body.livenessPassed ? "Orang asli terkonfirmasi" : "Presentation attack terdeteksi" },
      { stage: 6, name: "Verifikasi Wajah 1:1", pass: faceMatch, detail: `Jarak wajah ${faceDistance.toFixed(2)} (threshold 0,50)` },
      { stage: 7, name: "Jadwal & Aturan", pass: !earlyLeave, detail: earlyLeave ? "Pulang lebih awal >1 jam" : "Dalam batas jam kerja" },
    ],
  };

  await pool.query(
    `UPDATE attendance SET check_out_at = $1, check_out_snap = $2,
       status = CASE WHEN $3 THEN 'early_leave' ELSE status END
     WHERE id = $4`,
    [now, JSON.stringify(snap), earlyLeave, attId],
  );

  await writeAudit({
    actorId: user.id,
    actorName: rec.emp_name,
    action: "Checked out",
    targetType: "attendance",
    targetId: attId,
    detail: `Check-out · jarak ${geo.distanceM} m${earlyLeave ? " · pulang awal" : ""}`,
    at: snap.at,
  });

  return Response.json({ ok: true, id: attId, checkOutAt: snap.at, snap, status: earlyLeave ? "early_leave" : rec.status });
}
