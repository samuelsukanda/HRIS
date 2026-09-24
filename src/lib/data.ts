// Data demo HRIS — sintetik & deterministik (mulberry32) agar stabil antar sesi
import { checkGeofence, runValidationPipeline } from "./engine";
import { toLocalISO } from "./format";
import type {
  Announcement,
  ApprovalEntry,
  Asset,
  AssetAssignment,
  AttendanceRecord,
  AuditLogEntry,
  Bank,
  Branch,
  Candidate,
  Department,
  Employee,
  HrisData,
  JobPosting,
  LeaveRequest,
  LeaveType,
  Notification,
  OvertimeRequest,
  PerformanceReview,
  Position,
  Reimbursement,
  RosterEntry,
  Shift,
  Training,
  TrainingEnrollment,
  User,
  VerificationSnapshot,
  WorkLocation,
} from "./types";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20260826);
const pick = <T,>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!;

// ── Organisasi ───────────────────────────────────────────────────────
export const branches: Branch[] = [
  { id: "BR-JKT", name: "Kantor Pusat Jakarta", city: "Jakarta" },
  { id: "BR-BDG", name: "Cabang Bandung", city: "Bandung" },
  { id: "BR-SBY", name: "Klinik Surabaya", city: "Surabaya" },
  { id: "BR-SBG", name: "Cabang Subang", city: "Subang" },
];

export const departments: Department[] = [
  { id: "DP-HR", name: "Human Resources", branchId: "BR-JKT" },
  { id: "DP-IT", name: "Teknologi Informasi", branchId: "BR-JKT" },
  { id: "DP-FIN", name: "Keuangan", branchId: "BR-JKT" },
  { id: "DP-OPS", name: "Operasional", branchId: "BR-BDG" },
  { id: "DP-MED", name: "Layanan Medis", branchId: "BR-SBY" },
  { id: "DP-SBG", name: "Manajemen - Cabang Subang", branchId: "BR-SBG" },
];

export const positions: Position[] = [
  { id: "PS-DIR", title: "Direktur Operasional", level: "Director" },
  { id: "PS-HRM", title: "Manajer HR", level: "Manager" },
  { id: "PS-SUP", title: "Supervisor Lapangan", level: "Supervisor" },
  { id: "PS-IT", title: "Staf IT", level: "Staff" },
  { id: "PS-FIN", title: "Staf Keuangan", level: "Staff" },
  { id: "PS-NRS", title: "Perawat", level: "Staff" },
  { id: "PS-APT", title: "Apoteker", level: "Staff" },
  { id: "PS-ADM", title: "Admin Kantor", level: "Staff" },
  { id: "PS-SEC", title: "Petugas Keamanan", level: "Staff" },
  { id: "PS-MGR-B", title: "Manajer Cabang", level: "Manager" },
  { id: "PS-HRS", title: "Staf HR", level: "Staff" },
];

export const banks: Bank[] = [
  { id: "BANK-001", name: "BCA" },
  { id: "BANK-002", name: "Mandiri" },
  { id: "BANK-003", name: "BNI" },
  { id: "BANK-004", name: "BRI" },
  { id: "BANK-005", name: "CIMB Niaga" },
  { id: "BANK-006", name: "BTN" },
  { id: "BANK-007", name: "Danamon" },
  { id: "BANK-008", name: "Permata Bank" },
  { id: "BANK-009", name: "Bank BSI" },
  { id: "BANK-010", name: "OCBC NISP" },
];

// Koordinat nyata area perkantoran (dibulatkan untuk demo)
export const workLocations: WorkLocation[] = [
  {
    id: "WL-JKT",
    name: "Kantor Pusat — Menara Sudirman",
    branchId: "BR-JKT",
    latitude: -6.2,
    longitude: 106.816666,
    radiusM: 100,
    allowedTypes: ["onsite"],
  },
  {
    id: "WL-BDG",
    name: "Cabang Bandung — Asia Afrika",
    branchId: "BR-BDG",
    latitude: -6.921,
    longitude: 107.607,
    radiusM: 150,
    allowedTypes: ["onsite"],
  },
  {
    id: "WL-SBY",
    name: "Klinik Surabaya — Darmo",
    branchId: "BR-SBY",
    latitude: -7.2635,
    longitude: 112.7502,
    radiusM: 75,
    allowedTypes: ["onsite"],
  },
  {
    id: "WL-SBG",
    name: "Kantor Cabang Subang",
    branchId: "BR-SBG",
    latitude: -6.5274346,
    longitude: 107.7913394,
    radiusM: 100,
    allowedTypes: ["onsite"],
  },
];

export const shifts: Shift[] = [
  { id: "S-OFFICE", name: "Office Hours", start: "09:00", end: "17:00", graceMinutes: 15, crossesMidnight: false },
  { id: "S-PAGI", name: "Shift Pagi", start: "07:00", end: "15:00", graceMinutes: 10, crossesMidnight: false },
  { id: "S-SIANG", name: "Shift Siang", start: "15:00", end: "23:00", graceMinutes: 10, crossesMidnight: false },
  { id: "S-MALAM", name: "Shift Malam", start: "23:00", end: "07:00", graceMinutes: 15, crossesMidnight: true },
];

// ── Karyawan ─────────────────────────────────────────────────────────
interface SeedDef {
  name: string;
  gender: "L" | "P";
  dep: string;
  pos: string;
  loc: string;
  shift: string;
  spv?: number; // index SPV (team leader)
  manager?: number; // index Manager (kepala dept)
}

const SEED_DEFS: SeedDef[] = [
  { name: "Samuel Hartono", gender: "L", dep: "DP-HR", pos: "PS-HRM", loc: "WL-JKT", shift: "S-OFFICE" },
  { name: "Ratna Wijaya", gender: "P", dep: "DP-OPS", pos: "PS-SUP", loc: "WL-BDG", shift: "S-OFFICE", manager: 0 },
  { name: "Budi Santoso", gender: "L", dep: "DP-HR", pos: "PS-ADM", loc: "WL-JKT", shift: "S-OFFICE", manager: 0 },
  { name: "Dewi Lestari", gender: "P", dep: "DP-FIN", pos: "PS-FIN", loc: "WL-JKT", shift: "S-OFFICE", manager: 0 },
  { name: "Agus Prasetyo", gender: "L", dep: "DP-IT", pos: "PS-IT", loc: "WL-JKT", shift: "S-OFFICE", manager: 0 },
  { name: "Siti Rahmawati", gender: "P", dep: "DP-HR", pos: "PS-ADM", loc: "WL-JKT", shift: "S-OFFICE", spv: 2, manager: 0 },
  { name: "Joko Susilo", gender: "L", dep: "DP-OPS", pos: "PS-SUP", loc: "WL-BDG", shift: "S-PAGI", manager: 1 },
  { name: "Rina Marlina", gender: "P", dep: "DP-OPS", pos: "PS-ADM", loc: "WL-BDG", shift: "S-PAGI", spv: 6, manager: 1 },
  { name: "Hendra Gunawan", gender: "L", dep: "DP-OPS", pos: "PS-SEC", loc: "WL-BDG", shift: "S-SIANG", spv: 6, manager: 1 },
  { name: "Maya Anggraini", gender: "P", dep: "DP-OPS", pos: "PS-ADM", loc: "WL-BDG", shift: "S-MALAM", spv: 6, manager: 1 },
  { name: "dr. Lina Kusuma", gender: "P", dep: "DP-MED", pos: "PS-DIR", loc: "WL-SBY", shift: "S-OFFICE" },
  { name: "Nur Aisyah", gender: "P", dep: "DP-MED", pos: "PS-NRS", loc: "WL-SBY", shift: "S-PAGI", manager: 10 },
  { name: "Eko Saputra", gender: "L", dep: "DP-MED", pos: "PS-NRS", loc: "WL-SBY", shift: "S-SIANG", spv: 11, manager: 10 },
  { name: "Fitri Handayani", gender: "P", dep: "DP-MED", pos: "PS-NRS", loc: "WL-SBY", shift: "S-MALAM", spv: 11, manager: 10 },
  { name: "Gilang Ramadhan", gender: "L", dep: "DP-MED", pos: "PS-APT", loc: "WL-SBY", shift: "S-PAGI", spv: 11, manager: 10 },
  { name: "Indah Permata", gender: "P", dep: "DP-MED", pos: "PS-ADM", loc: "WL-SBY", shift: "S-OFFICE", spv: 11, manager: 10 },
  { name: "Bayu Nugroho", gender: "L", dep: "DP-IT", pos: "PS-IT", loc: "WL-JKT", shift: "S-OFFICE", spv: 4, manager: 0 },
  { name: "Citra Kirana", gender: "P", dep: "DP-FIN", pos: "PS-FIN", loc: "WL-JKT", shift: "S-OFFICE", spv: 3, manager: 0 },
  { name: "Dimas Aryo", gender: "L", dep: "DP-OPS", pos: "PS-SEC", loc: "WL-BDG", shift: "S-MALAM", spv: 6, manager: 1 },
  { name: "Endah Sulistyowati", gender: "P", dep: "DP-MED", pos: "PS-NRS", loc: "WL-SBY", shift: "S-PAGI", spv: 11, manager: 10 },
  { name: "Fajar Hidayat", gender: "L", dep: "DP-MED", pos: "PS-NRS", loc: "WL-SBY", shift: "S-SIANG", spv: 11, manager: 10 },
  { name: "Gita Savitri", gender: "P", dep: "DP-HR", pos: "PS-ADM", loc: "WL-JKT", shift: "S-OFFICE", spv: 2, manager: 0 },
  // Tim Cabang Subang: manager, supervisor, karyawan biasa, dan HR cabang
  { name: "Bambang Prakoso", gender: "L", dep: "DP-SBG", pos: "PS-MGR-B", loc: "WL-SBG", shift: "S-OFFICE" },
  { name: "Sari Wulandari", gender: "P", dep: "DP-SBG", pos: "PS-SUP", loc: "WL-SBG", shift: "S-OFFICE", manager: 22 },
  { name: "Rudi Hartawan", gender: "L", dep: "DP-SBG", pos: "PS-ADM", loc: "WL-SBG", shift: "S-PAGI", spv: 23, manager: 22 },
  { name: "Melati Puspita", gender: "P", dep: "DP-SBG", pos: "PS-HRS", loc: "WL-SBG", shift: "S-OFFICE", manager: 22 },
];

const KOTA_LAHIR = ["Jakarta", "Bandung", "Surabaya", "Semarang", "Yogyakarta", "Malang", "Solo", "Medan"];

export function buildEmployees(): Employee[] {
  return SEED_DEFS.map((def, i) => {
    const num = String(i + 1).padStart(3, "0");
    const joinYear = 2019 + (i % 6);
    return {
      id: `EMP-${num}`,
      nik: `31${String(7201000000000 + i * 7919).slice(0, 14)}`,
      name: def.name,
      gender: def.gender,
      birthPlace: KOTA_LAHIR[i % KOTA_LAHIR.length]!,
      birthDate: `199${i % 10}-0${(i % 9) + 1}-1${i % 9}`,
      address: `Jl. Melati No.${i + 3}, ${pick(KOTA_LAHIR)}`,
      phone: `08${String(1200000000 + i * 3571).slice(0, 10)}`,
      email: `${def.name.toLowerCase().replace(/^(dr\.|dr)\s*/, "").split(" ")[0]}.${def.name.split(" ").pop()!.toLowerCase()}@hrissmart.id`,
      joinDate: `${joinYear}-0${(i % 9) + 1}-01`,
      departmentId: def.dep,
      positionId: def.pos,
      managerId: def.manager !== undefined ? `EMP-${String(def.manager + 1).padStart(3, "0")}` : undefined,
      spvId: def.spv !== undefined ? `EMP-${String(def.spv + 1).padStart(3, "0")}` : undefined,
      branchId: workLocations.find((w) => w.id === def.loc)!.branchId,
      workLocationId: def.loc,
      employmentType: i === 21 ? "probation" : i === 11 ? "contract" : "permanent",
      status: "active",
      bankName: banks[i % banks.length]!.name,
      bankAccount: String(7000000000 + i * 12345),
      emergencyContact: {
        name: pick(["Sulaiman", "Wati", "Bambang", "Kartika"]) + " " + def.name.split(" ").pop()!,
        relation: pick(["Pasangan", "Orang tua", "Saudara"]),
        phone: `08${String(1300000000 + i * 4231).slice(0, 10)}`,
      },
      faceRegistered: i !== 20 && i !== 21, // dua karyawan belum daftar wajah
    };
  });
}
export const employees = buildEmployees();

export const users: User[] = [
  { id: "USR-001", employeeId: "EMP-001", email: "samuel.hartono@hrissmart.id", role: "hr" },
  { id: "USR-002", employeeId: "EMP-002", email: "ratna.wijaya@hrissmart.id", role: "manager" },
  { id: "USR-003", employeeId: "EMP-003", email: "budi.santoso@hrissmart.id", role: "employee" },
  { id: "USR-004", employeeId: "EMP-023", email: "bambang.prakoso@hrissmart.id", role: "manager" },
  { id: "USR-005", employeeId: "EMP-024", email: "sari.wulandari@hrissmart.id", role: "supervisor" },
  { id: "USR-006", employeeId: "EMP-025", email: "rudi.hartawan@hrissmart.id", role: "employee" },
  { id: "USR-007", employeeId: "EMP-026", email: "melati.puspita@hrissmart.id", role: "hr" },
];

// ── Roster: 14 hari ke belakang + sampai akhir bulan Oktober ─────────
export function buildRoster(): RosterEntry[] {
  const entries: RosterEntry[] = [];
  const today = new Date();
  const endOfOctober = new Date(today.getFullYear(), 9, 31); // bulan index 9 = Oktober
  const endOff = Math.max(7, Math.ceil((endOfOctober.getTime() - today.getTime()) / 86_400_000));
  for (let off = -14; off <= endOff; off++) {
    const d = new Date(today);
    d.setDate(d.getDate() + off);
    const iso = toLocalISO(d);
    const weekend = d.getDay() === 0 || d.getDay() === 6;
    for (const emp of employees) {
      if (weekend) {
        entries.push({ id: `RST-${String(entries.length + 1).padStart(3, "0")}`, employeeId: emp.id, date: iso, shiftId: null });
        continue;
      }
      let shiftId = SEED_DEFS.find((s) => s.name === emp.name)!.shift;
      // Rotasi shift medis sederhana agar papan roster terlihat hidup
      if (emp.branchId === "BR-SBY" && ["PS-NRS"].includes(emp.positionId)) {
        const rot = ["S-PAGI", "S-SIANG", "S-MALAM"];
        shiftId = rot[(d.getDate() + Number(emp.id.slice(-2))) % 3]!;
      }
      entries.push({ id: `RST-${String(entries.length + 1).padStart(3, "0")}`, employeeId: emp.id, date: iso, shiftId });
    }
  }
  return entries;
}
export const roster = buildRoster();

// ── Snapshot verifikasi sintetis konsisten dengan pipeline ───────────
function makeSnapshot(
  office: WorkLocation,
  opts: {
    hourOffsetMin: number; // menit dari mulai shift
    distanceM?: number;
    mockLocation?: boolean;
    faceScore?: number;
    livenessPassed?: boolean;
    accuracyM?: number;
    deviceChanged?: boolean;
    at?: Date;
  },
): VerificationSnapshot {
  const at = opts.at ?? new Date();
  const lat = office.latitude + ((opts.distanceM ?? 30 + rnd() * 40) / 111_320) * (rnd() > 0.5 ? 1 : -1);
  const lng =
    office.longitude +
    ((opts.distanceM ?? 30 + rnd() * 40) / (111_320 * Math.cos((office.latitude * Math.PI) / 180))) *
      (rnd() > 0.5 ? 1 : -1);
  return {
    at: at.toISOString(),
    latitude: lat,
    longitude: lng,
    accuracyM: opts.accuracyM ?? 5 + Math.floor(rnd() * 12),
    distanceM: 0, // dihitung pipeline
    mockLocation: opts.mockLocation ?? false,
    developerMode: false,
    faceScore: opts.faceScore ?? 0.9 + rnd() * 0.09,
    livenessScore: opts.livenessPassed === false ? 0.42 : 0.88 + rnd() * 0.11,
    livenessPassed: opts.livenessPassed ?? true,
    deviceId: opts.deviceChanged ? "DEV-UNKNOWN-77" : "DEV-" + String(1000 + Math.floor(rnd() * 900)),
    deviceName: opts.deviceChanged ? "Xiaomi Redmi Note 9 (baru)" : pick(["iPhone 13", "Samsung Galaxy S22", "OPPO Reno 8", "Xiaomi Redmi Note 12"]),
    ip: `114.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}.${Math.floor(rnd() * 255)}`,
    stages: [],
  };
}

function finalizeSnapshot(
  snap: VerificationSnapshot,
  office: WorkLocation,
  hasSchedule: boolean,
  withinWindow: boolean,
): VerificationSnapshot {
  const geo = checkGeofence(snap, office);
  const pipeline = runValidationPipeline({
    authenticated: true,
    deviceTrusted: snap.deviceId !== "DEV-UNKNOWN-77",
    gpsActive: true,
    geofence: geo.pass ? geo : null,
    mockLocation: snap.mockLocation,
    faceDetected: snap.faceScore > 0.5,
    livenessPassed: snap.livenessPassed,
    faceScore: snap.faceScore,
    hasScheduleToday: hasSchedule,
    withinCheckInWindow: withinWindow,
  });
  return { ...snap, distanceM: geo.distanceM, stages: pipeline.stages };
}

export function buildAttendance(): AttendanceRecord[] {
  const records: AttendanceRecord[] = [];
  const todayISO = toLocalISO(new Date());
  for (let off = -14; off <= 0; off++) {
    const d = new Date();
    d.setDate(d.getDate() + off);
    const iso = toLocalISO(d);
    for (let i = 0; i < employees.length; i++) {
      const emp = employees[i]!;
      const r = roster.find((e) => e.employeeId === emp.id && e.date === iso)!;
      const isToday = iso === todayISO;

      if (!r.shiftId || emp.status !== "active") continue;

      // Hari ini: Budi belum absen (demo check-in), sisanya sebagian sudah
      if (isToday && emp.id === "EMP-003") continue;
      if (isToday && rnd() < 0.25) continue;

      const roll = rnd();
      const office = workLocations.find((w) => w.id === emp.workLocationId)!;
      const shift = shifts.find((s) => s.id === r.shiftId)!;

      // Kasus terkraf pada hari kerja tertentu
      const craftKey = `${iso}:${emp.id}`;

      let status: AttendanceRecord["status"] = "present";
      let verificationStatus: AttendanceRecord["verificationStatus"] = "valid";
      let rejectionReason: string | undefined;
      let riskScore = 6 + Math.floor(rnd() * 10);
      let snapIn: VerificationSnapshot | undefined;

      if (!isToday) {
        if (craftKey.endsWith("EMP-009") && off === -3) {
          // Mock GPS → ditolak (PRD §80 skenario 5)
          status = "absent";
          verificationStatus = "rejected";
          rejectionReason = "Mock location terdeteksi — absensi ditolak";
          riskScore = 82;
          snapIn = finalizeSnapshot(
            makeSnapshot(office, { hourOffsetMin: 5, distanceM: 60, mockLocation: true }),
            office,
            true,
            true,
          );
        } else if (craftKey.endsWith("EMP-007") && off === -5) {
          // Di luar radius → ditolak (PRD §80 skenario 2)
          status = "absent";
          verificationStatus = "rejected";
          rejectionReason = "Anda berada 350 m dari lokasi kerja — melebihi radius 100 m";
          riskScore = 64;
          snapIn = finalizeSnapshot(
            makeSnapshot(office, { hourOffsetMin: 12, distanceM: 350 }),
            office,
            true,
            true,
          );
        } else if (craftKey.endsWith("EMP-013") && off === -2) {
          // Photo attack → liveness gagal (PRD §80 skenario 3)
          status = "absent";
          verificationStatus = "rejected";
          rejectionReason = "Presentation attack terdeteksi — foto/video tidak dapat diproses";
          riskScore = 91;
          snapIn = finalizeSnapshot(
            makeSnapshot(office, { hourOffsetMin: 3, livenessPassed: false }),
            office,
            true,
            true,
          );
        } else if (roll < 0.06) {
          status = "late";
        } else if (roll < 0.085) {
          status = "leave";
        } else if (roll < 0.1) {
          status = "sick";
        } else if (roll < 0.115) {
          status = "permission";
        } else if (roll < 0.125) {
          status = "wfh";
        } else if (roll < 0.135) {
          status = "absent";
          verificationStatus = "review";
          riskScore = 45;
        }
      }

      // Snapshot check-in untuk hadir/late/wfh — termasuk hari ini
      if (["present", "late", "wfh"].includes(status)) {
        const lateMin = status === "late" ? 12 + Math.floor(rnd() * 55) : Math.floor(rnd() * 8) - 15;
        const baseHour = parseInt(shift.start.slice(0, 2), 10);
        const at = new Date(d);
        at.setHours(baseHour, parseInt(shift.start.slice(3, 5), 10) + lateMin, 20 + Math.floor(rnd() * 30), 0);
        if (isToday && at.getTime() > Date.now()) continue; // shift belum mulai — belum absen
        snapIn = finalizeSnapshot(
          makeSnapshot(office, {
            hourOffsetMin: lateMin,
            at,
            deviceChanged: rnd() < 0.04,
            faceScore: rnd() < 0.05 ? 0.78 : undefined,
            distanceM: status === "wfh" ? undefined : undefined,
          }),
          office,
          true,
          true,
        );
        if (status === "wfh") snapIn = { ...snapIn, distanceM: -1 };
        if (snapIn.deviceId === "DEV-UNKNOWN-77") riskScore = Math.max(riskScore, 58);
        if (snapIn.faceScore < 0.85) {
          riskScore = Math.max(riskScore, 62);
          verificationStatus = "review";
        }
      }

      records.push({
        id: `ATT-${iso.replaceAll("-", "")}-${emp.id}`,
        employeeId: emp.id,
        date: iso,
        checkInAt: snapIn?.at,
        checkOutAt:
          snapIn && !isToday
            ? new Date(new Date(snapIn.at).getTime() + (8 * 60 - 20) * 60000).toISOString()
            : undefined,
        checkInSnap: snapIn,
        status,
        riskScore,
        verificationStatus: snapIn ? verificationStatus : status === "leave" || status === "sick" ? "valid" : verificationStatus,
        rejectionReason,
        corrections: [],
      });
    }
  }

  // Satu permintaan koreksi pending dari Rina (telat karena transportasi publik)
  const rinnaToday = records.find((r) => r.employeeId === "EMP-008");
  if (rinnaToday?.checkInAt) {
    rinnaToday.corrections.push({
      id: "COR-001",
      requestedAt: new Date(Date.now() - 3600_000 * 5).toISOString(),
      reason: "KRL terlambat 25 menit karena gangguan sinyal, saya tetap berangkat dari stasiun tepat waktu.",
      beforeCheckIn: rinnaToday.checkInAt,
      afterCheckIn: new Date(new Date(rinnaToday.checkInAt).getTime() - 25 * 60000).toISOString(),
      status: "pending",
      byEmployeeId: "EMP-008",
    });
  }
  return records;
}
export const attendance = buildAttendance();

// ── Cuti ─────────────────────────────────────────────────────────────
export const leaveTypes: LeaveType[] = [
  { id: "LV-CT", name: "Annual Leave", allocationDays: 12, paid: true, requiresAttachment: false },
  { id: "LV-SK", name: "Sick Leave", allocationDays: 12, paid: true, requiresAttachment: true },
  { id: "LV-MT", name: "Maternity Leave", allocationDays: 90, paid: true, requiresAttachment: true },
  { id: "LV-PT", name: "Paternity Leave", allocationDays: 5, paid: true, requiresAttachment: false },
  { id: "LV-KH", name: "Special Leave", allocationDays: 3, paid: true, requiresAttachment: true },
  { id: "LV-UP", name: "Unpaid Leave", allocationDays: 0, paid: false, requiresAttachment: false },
  { id: "LV-BV", name: "Bereavement Leave", allocationDays: 3, paid: true, requiresAttachment: false },
];

function iso(offsetDays: number): string {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return toLocalISO(d);
}

export const leaveRequests: LeaveRequest[] = [
  { id: "LRV-001", employeeId: "EMP-003", typeId: "LV-CT", startDate: iso(6), endDate: iso(8), days: 3, reason: "Acara pernikahan saudara di Solo.", status: "pending", submittedAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: "LRV-002", employeeId: "EMP-006", typeId: "LV-SK", startDate: iso(-1), endDate: iso(-1), days: 1, reason: "Demam, ada surat dokter.", status: "approved", submittedAt: new Date(Date.now() - 172_800_000).toISOString(), decidedBy: "Samuel Hartono", decidedAt: new Date(Date.now() - 160_000_000).toISOString() },
  { id: "LRV-003", employeeId: "EMP-012", typeId: "LV-CT", startDate: iso(10), endDate: iso(14), days: 5, reason: "Liburan tahunan keluarga.", status: "pending", submittedAt: new Date(Date.now() - 43_200_000).toISOString() },
  { id: "LRV-004", employeeId: "EMP-018", typeId: "LV-KH", startDate: iso(-7), endDate: iso(-7), days: 1, reason: "Mengurus administrasi kependudukan.", status: "approved", submittedAt: new Date(Date.now() - 8 * 86_400_000).toISOString(), decidedBy: "Samuel Hartono", decidedAt: new Date(Date.now() - 7.5 * 86_400_000).toISOString() },
  { id: "LRV-005", employeeId: "EMP-008", typeId: "LV-UP", startDate: iso(-4), endDate: iso(-4), days: 1, reason: "Urusan pribadi tanpa cuti tahunan tersisa bulan ini.", status: "rejected", submittedAt: new Date(Date.now() - 6 * 86_400_000).toISOString(), decidedBy: "Samuel Hartono", decidedAt: new Date(Date.now() - 5 * 86_400_000).toISOString() },
  // Subang — isi berbeda dari pusat
  { id: "LRV-006", employeeId: "EMP-025", typeId: "LV-CT", startDate: iso(5), endDate: iso(7), days: 3, reason: "Menghadiri acara keluarga di Purwakarta.", status: "pending", submittedAt: new Date(Date.now() - 6 * 3_600_000).toISOString() },
  { id: "LRV-007", employeeId: "EMP-026", typeId: "LV-SK", startDate: iso(-2), endDate: iso(-2), days: 1, reason: "Flu berat, lampiran surat dokter Puskesmas Subang.", status: "approved", submittedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), decidedBy: "Melati Puspita", decidedAt: new Date(Date.now() - 2.5 * 86_400_000).toISOString() },
  { id: "LRV-008", employeeId: "EMP-024", typeId: "LV-PT", startDate: iso(12), endDate: iso(16), days: 5, reason: "Cuti pendampingan istri melahirkan.", status: "pending", submittedAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
];

// ── Lembur ───────────────────────────────────────────────────────────
export const overtimeRequests: OvertimeRequest[] = [
  { id: "OTR-001", employeeId: "EMP-005", date: iso(-1), start: "18:00", end: "21:00", hours: 3, reason: "Deployment rilis sistem absensi v2.", status: "approved", submittedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), decidedBy: "Ratna Wijaya" },
  { id: "OTR-002", employeeId: "EMP-013", date: iso(0), start: "23:00", end: "02:00", hours: 3, reason: "Cover shift rekan yang sakit.", status: "pending", submittedAt: new Date(Date.now() - 7_200_000).toISOString() },
  { id: "OTR-003", employeeId: "EMP-008", date: iso(-3), start: "17:00", end: "19:30", hours: 2.5, reason: "Stock opname gudang cabang.", status: "approved", submittedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), decidedBy: "Ratna Wijaya" },
  { id: "OTR-004", employeeId: "EMP-014", date: iso(1), start: "22:00", end: "23:00", hours: 1, reason: "Handover pasien rawat inap.", status: "pending", submittedAt: new Date(Date.now() - 3_600_000).toISOString() },
  // Subang
  { id: "OTR-005", employeeId: "EMP-025", date: iso(-1), start: "17:30", end: "20:00", hours: 2.5, reason: "Input data pelanggan walk-in setelah jam layanan.", status: "pending", submittedAt: new Date(Date.now() - 5 * 3_600_000).toISOString() },
  { id: "OTR-006", employeeId: "EMP-023", date: iso(-4), start: "18:00", end: "19:00", hours: 1, reason: "Briefing tamu korporat dari kantor pusat.", status: "approved", submittedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), decidedBy: "Bambang Prakoso" },
];

// ── Audit log awal ───────────────────────────────────────────────────
export function buildAuditLogs(): AuditLogEntry[] {
  const now = Date.now();
  return [
    { id: "LOG-001", actorId: "USR-001", actorName: "Samuel Hartono", action: "Approved leave", targetType: "leave_request", targetId: "LRV-004", detail: "Special leave 1 hari disetujui", at: new Date(now - 7.5 * 86_400_000).toISOString() },
    { id: "LOG-002", actorId: "USR-001", actorName: "Samuel Hartono", action: "Face registered", targetType: "face_profile", targetId: "EMP-017", detail: "Template wajah terdaftar, quality score 96%", at: new Date(now - 3 * 86_400_000).toISOString() },
    { id: "LOG-003", actorId: "USR-001", actorName: "Samuel Hartono", action: "Device registered", targetType: "device_registration", targetId: "EMP-019", detail: "Perangkat baru diverifikasi via OTP", at: new Date(now - 2 * 86_400_000).toISOString() },
    { id: "LOG-004", actorId: "system", actorName: "Risk Engine", action: "Attendance rejected", targetType: "attendance", targetId: "ATT-" + iso(-3).replaceAll("-", "") + "-EMP-009", detail: "Mock location terdeteksi — absensi EMP-009 ditolak otomatis", at: new Date(now - 3 * 86_400_000 + 36_000_000).toISOString() },
    { id: "LOG-005", actorId: "USR-002", actorName: "Ratna Wijaya", action: "Approved overtime", targetType: "overtime_request", targetId: "OTR-003", detail: "Lembur 2,5 jam disetujui", at: new Date(now - 4 * 86_400_000 + 72_000_000).toISOString() },
  ];
}
export const auditLogs = buildAuditLogs();

export const announcements: Announcement[] = [
  // Kantor pusat (BR-JKT)
  { id: "ANC-001", title: "Town Hall Q3 — Jumat 14:00", body: "Seluruh staf Kantor Pusat diundang di Aula Lantai 5 Menara Sudirman. Doorprize untuk divisi dengan kehadiran tertinggi.", category: "acara", date: iso(-1), branchId: "BR-JKT" },
  { id: "ANC-002", title: "Renovasi Lantai 3 — Mulai Senin", body: "Area Finance & IT dipindah sementara ke Lantai 4. Estimasi renovasi 10 hari kerja; meeting room M3 ditutup.", category: "pengumuman", date: iso(-2), branchId: "BR-JKT" },
  { id: "ANC-003", title: "Kebijakan baru: Check-in window", body: "Mulai bulan ini window check-in adalah ±2 jam dari jam mulai shift. Di luar window memerlukan approval supervisor.", category: "kebijakan", date: iso(-3) },
  // Cabang Subang (BR-SBG) — isi berbeda dari pusat
  { id: "ANC-004", title: "Rapat Koordinasi Cabang Subang", body: "Seluruh staf Subang wajib hadir di Ruang Rapat Kantor Cabang, Senin pukul 08:30. Agenda: target kuartal dan SLA layanan pelanggan.", category: "acara", date: iso(-1), branchId: "BR-SBG" },
  { id: "ANC-005", title: "Operasional: Libur Pasar Subang", body: "Kantor Cabang Subang tutup penuh pada hari pasar besar sesuai kalender daerah. Shift piket diumumkan supervisor Sari Wulandari.", category: "libur", date: iso(-4), branchId: "BR-SBG" },
  { id: "ANC-006", title: "SOP baru layanan walk-in Subang", body: "Mulai pekan ini antrean walk-in memakai nomor antrian digital. Staf wajib update status di dashboard cabang setiap 30 menit.", category: "kebijakan", date: iso(-6), branchId: "BR-SBG" },
  // Lintas cabang
  { id: "ANC-007", title: "Libur Nasional 17 Agustus", body: "Kantor pusat dan seluruh cabang tutup. Shift darurat klinik diumumkan terpisah oleh koordinator medis.", category: "libur", date: iso(-5) },
];

// ── Phase 3-4: Reimbursement ──────────────────────────────────────
export const reimbursements: Reimbursement[] = [
  { id: "RBM-001", employeeId: "EMP-003", category: "transport", amount: 285000, description: "Grab ke客户 meeting di Sudirman", status: "approved", submittedAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), approvals: [{ level: "spv", byName: "Budi Santoso", at: new Date(Date.now() - 2.5 * 86_400_000).toISOString(), approved: true }, { level: "manager", byName: "Samuel Hartono", at: new Date(Date.now() - 2 * 86_400_000).toISOString(), approved: true }] },
  { id: "RBM-002", employeeId: "EMP-005", category: "equipment", amount: 1500000, description: "Keyboard mechanical untuk work from home", status: "pending", submittedAt: new Date(Date.now() - 86_400_000).toISOString(), approvals: [] },
  { id: "RBM-003", employeeId: "EMP-008", category: "meal", amount: 85000, description: "Makan siang saat lembur deployment", status: "spv_approved", submittedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), approvals: [{ level: "spv", byName: "Joko Susilo", at: new Date(Date.now() - 86_400_000).toISOString(), approved: true }] },
  // Subang — beda dari pusat
  { id: "RBM-004", employeeId: "EMP-025", category: "transport", amount: 120000, description: "Ongkos angkot rute Subang–Purwakarta untuk kunjungan pelanggan.", status: "pending", submittedAt: new Date(Date.now() - 4 * 3_600_000).toISOString(), approvals: [] },
  { id: "RBM-005", employeeId: "EMP-024", category: "meal", amount: 65000, description: "Konsumsi rapat koordinasi cabang sampai malam.", status: "spv_approved", submittedAt: new Date(Date.now() - 26 * 3_600_000).toISOString(), approvals: [{ level: "spv", byName: "Sari Wulandari", at: new Date(Date.now() - 20 * 3_600_000).toISOString(), approved: true }] },
  { id: "RBM-006", employeeId: "EMP-026", category: "other", amount: 45000, description: "Pulsa paket data untuk update dashboard antrian cabang.", status: "approved", submittedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), approvals: [{ level: "spv", byName: "Bambang Prakoso", at: new Date(Date.now() - 4 * 86_400_000).toISOString(), approved: true }, { level: "hr", byName: "Melati Puspita", at: new Date(Date.now() - 3.5 * 86_400_000).toISOString(), approved: true }] },
];

// ── Phase 3-4: Recruitment ────────────────────────────────────────
export const jobPostings: JobPosting[] = [
  { id: "JOB-001", title: "Frontend Developer", departmentId: "DP-IT", description: "Mengembangkan UI aplikasi internal dengan React/Next.js.", requirements: "React, TypeScript, 2+ tahun pengalaman.", salaryRange: "8jt - 14jt", status: "open", createdAt: new Date(Date.now() - 14 * 86_400_000).toISOString() },
  { id: "JOB-002", title: "Perawat Senior", departmentId: "DP-MED", description: "Memberikan asuhan keperawatan pasien rawat inap.", requirements: "STR aktif, 3+ tahun pengalaman, minimal D3 Keperawatan.", salaryRange: "6jt - 10jt", status: "open", createdAt: new Date(Date.now() - 7 * 86_400_000).toISOString() },
  { id: "JOB-003", title: "Staff Administrasi HR", departmentId: "DP-HR", description: "Mengelola data karyawan, cuti, dan payroll.", requirements: "S1 HR/Manajemen, mahir Excel, teliti.", salaryRange: "5jt - 7jt", status: "closed", createdAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
  // Subang (dept DP-SBG)
  { id: "JOB-004", title: "Staf Layanan Cabang Subang", departmentId: "DP-SBG", description: "Melayani walk-in pelanggan dan input data antrian di Kantor Cabang Subang.", requirements: "SMA/SMK minimal, domisili Subang/Purwakarta, mahir Excel.", salaryRange: "4,5jt - 6jt", status: "open", createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() },
  { id: "JOB-005", title: "Admin Keuangan Cabang", departmentId: "DP-SBG", description: "Pembukuan kas cabang dan rekonsiliasi harian.", requirements: "D3/S1 Akuntansi, pengalaman 1 tahun diutamakan.", salaryRange: "5jt - 7jt", status: "open", createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
];

export const candidates: Candidate[] = [
  { id: "CAN-001", jobPostingId: "JOB-001", name: "Rizky Pratama", email: "rizky.pratama@email.com", phone: "081234567890", status: "interview", appliedAt: new Date(Date.now() - 10 * 86_400_000).toISOString(), notes: "Portfolio bagus, 3 tahun React." },
  { id: "CAN-002", jobPostingId: "JOB-001", name: "Anisa Putri", email: "anisa.putri@email.com", phone: "081234567891", status: "screening", appliedAt: new Date(Date.now() - 8 * 86_400_000).toISOString() },
  { id: "CAN-003", jobPostingId: "JOB-002", name: "Drg. Maya Sari", email: "maya.sari@email.com", phone: "081234567892", status: "offer", appliedAt: new Date(Date.now() - 5 * 86_400_000).toISOString(), notes: "STR aktif, 5 tahun pengalaman." },
  { id: "CAN-004", jobPostingId: "JOB-003", name: "Febri Wijaya", email: "febri.w@email.com", phone: "081234567893", status: "hired", appliedAt: new Date(Date.now() - 25 * 86_400_000).toISOString() },
  // Pelamar lowongan Subang
  { id: "CAN-005", jobPostingId: "JOB-004", name: "Dedi Supriyadi", email: "dedi.s@email.com", phone: "081298765401", status: "screening", appliedAt: new Date(Date.now() - 4 * 86_400_000).toISOString(), notes: "Domisili Ngamprah, pengalaman frontline 2 tahun." },
  { id: "CAN-006", jobPostingId: "JOB-004", name: "Wulan Safitri", email: "wulan.s@email.com", phone: "081298765402", status: "interview", appliedAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  { id: "CAN-007", jobPostingId: "JOB-005", name: "Hendra Kusnadi", email: "hendra.k@email.com", phone: "081298765403", status: "applied", appliedAt: new Date(Date.now() - 36 * 3_600_000).toISOString() },
];

// ── Phase 3-4: Training ───────────────────────────────────────────
export const trainings: Training[] = [
  { id: "TRN-001", title: "Cyber Security Awareness", provider: "PT SecureTech", description: "Pelatihan keamanan siber dasar lintas cabang via hybrid di Menara Sudirman.", startDate: iso(5), endDate: iso(5), maxParticipants: 50, status: "upcoming" },
  { id: "TRN-002", title: "Pelayanan Pelanggan yang Baik", provider: "HR Internal", description: "Workshop soft skill pelayanan pelanggan untuk tim operasional pusat.", startDate: iso(-7), endDate: iso(-7), maxParticipants: 20, status: "completed", branchId: "BR-JKT" },
  { id: "TRN-003", title: "Basic Life Support", provider: "RS Mitra Keluarga", description: "Pelatihan BLS dan CPR untuk staf medis.", startDate: iso(12), endDate: iso(13), maxParticipants: 15, status: "upcoming" },
  // Subang — beda dari pusat
  { id: "TRN-004", title: "SOP Walk-in & Antrian Digital Cabang", provider: "HR Cabang Subang", description: "Pelatihan internal staf Subang: nomor antrian, SLA respon, dan eskalasi ke kantor pusat.", startDate: iso(3), endDate: iso(3), maxParticipants: 12, status: "upcoming", branchId: "BR-SBG" },
  { id: "TRN-005", title: "Keselamatan Kerja Area Gudang Subang", provider: "Disnaker Subang", description: "SIO ringkas untuk staf gudang & logistik Cabang Subang.", startDate: iso(-10), endDate: iso(-10), maxParticipants: 10, status: "completed", branchId: "BR-SBG" },
];

export const trainingEnrollments: TrainingEnrollment[] = [
  { id: "TRE-001", trainingId: "TRN-001", employeeId: "EMP-003", status: "enrolled", enrolledAt: new Date(Date.now() - 3 * 86_400_000).toISOString() },
  { id: "TRE-002", trainingId: "TRN-001", employeeId: "EMP-005", status: "enrolled", enrolledAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  { id: "TRE-003", trainingId: "TRN-002", employeeId: "EMP-008", status: "completed", enrolledAt: new Date(Date.now() - 10 * 86_400_000).toISOString() },
  { id: "TRE-004", trainingId: "TRN-002", employeeId: "EMP-009", status: "completed", enrolledAt: new Date(Date.now() - 10 * 86_400_000).toISOString() },
  { id: "TRE-005", trainingId: "TRN-003", employeeId: "EMP-012", status: "enrolled", enrolledAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: "TRE-006", trainingId: "TRN-004", employeeId: "EMP-025", status: "enrolled", enrolledAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  { id: "TRE-007", trainingId: "TRN-004", employeeId: "EMP-026", status: "enrolled", enrolledAt: new Date(Date.now() - 86_400_000).toISOString() },
  { id: "TRE-008", trainingId: "TRN-005", employeeId: "EMP-024", status: "completed", enrolledAt: new Date(Date.now() - 12 * 86_400_000).toISOString() },
  { id: "TRE-009", trainingId: "TRN-005", employeeId: "EMP-025", status: "completed", enrolledAt: new Date(Date.now() - 12 * 86_400_000).toISOString() },
];

// ── Phase 3-4: Assets ─────────────────────────────────────────────
export const assets: Asset[] = [
  { id: "AST-001", name: "MacBook Pro 14 inch", category: "laptop", serialNumber: "MBP-2024-001", purchaseDate: "2024-01-15", status: "assigned", branchId: "BR-JKT" },
  { id: "AST-002", name: "iPhone 15 Pro", category: "phone", serialNumber: "IPH-2024-001", purchaseDate: "2024-03-10", status: "assigned", branchId: "BR-JKT" },
  { id: "AST-003", name: "Dell Monitor 27 inch", category: "monitor", serialNumber: "DEL-2024-001", purchaseDate: "2024-02-20", status: "assigned", branchId: "BR-JKT" },
  { id: "AST-004", name: "Laptop ASUS VivoBook", category: "laptop", serialNumber: "ASU-2024-001", purchaseDate: "2024-06-01", status: "available" },
  { id: "AST-005", name: "Meja Kerja Ergonomis", category: "furniture", serialNumber: "FRN-2024-001", purchaseDate: "2024-04-15", status: "assigned", branchId: "BR-JKT" },
  { id: "AST-006", name: "Toyota Avanza", category: "vehicle", serialNumber: "VHL-2023-001", purchaseDate: "2023-08-01", status: "maintenance" },
  // Subang — beda dari pusat
  { id: "AST-007", name: "Printer Epson L3210 Cabang", category: "other", serialNumber: "EPS-SBG-001", purchaseDate: "2024-09-01", status: "available", brand: "Epson", model: "L3210", notes: "Unit cetak laporan antrian harian.", branchId: "BR-SBG" },
  { id: "AST-008", name: "Laptop Lenovo ThinkPad E14", category: "laptop", serialNumber: "LNV-SBG-001", purchaseDate: "2025-01-20", status: "assigned", brand: "Lenovo", model: "ThinkPad E14", branchId: "BR-SBG" },
  { id: "AST-009", name: "Kursi Rapat Subang", category: "furniture", serialNumber: "FRN-SBG-001", purchaseDate: "2024-11-05", status: "available", notes: "Set 6 kursi ruang rapat cabang.", branchId: "BR-SBG" },
];

export const assetAssignments: AssetAssignment[] = [
  { id: "AA-001", assetId: "AST-001", employeeId: "EMP-005", assignedAt: new Date(Date.now() - 60 * 86_400_000).toISOString() },
  { id: "AA-002", assetId: "AST-002", employeeId: "EMP-001", assignedAt: new Date(Date.now() - 45 * 86_400_000).toISOString() },
  { id: "AA-003", assetId: "AST-003", employeeId: "EMP-005", assignedAt: new Date(Date.now() - 30 * 86_400_000).toISOString() },
  { id: "AA-004", assetId: "AST-005", employeeId: "EMP-004", assignedAt: new Date(Date.now() - 20 * 86_400_000).toISOString() },
  { id: "AA-005", assetId: "AST-008", employeeId: "EMP-026", assignedAt: new Date(Date.now() - 15 * 86_400_000).toISOString() },
  { id: "AA-006", assetId: "AST-007", employeeId: "EMP-025", assignedAt: new Date(Date.now() - 10 * 86_400_000).toISOString() },
];

// ── Phase 3-4: Performance ────────────────────────────────────────
export const performanceReviews: PerformanceReview[] = [
  { id: "PRF-001", employeeId: "EMP-005", reviewerId: "EMP-001", period: "2026-Q1", score: 4, strengths: "Problem solving kuat, proaktif dalam team.", improvements: "Perlu improve komunikasi non-teknis.", goals: "Lead project migration Q2.", status: "final", createdAt: new Date(Date.now() - 60 * 86_400_000).toISOString() },
  { id: "PRF-002", employeeId: "EMP-008", reviewerId: "EMP-002", period: "2026-Q1", score: 3, strengths: "Konsisten hadir, teliti dalam administrasi.", improvements: "Perlu lebih cepat dalam处理 dokumen.", goals: "Otomasi proses manual yang berulang.", status: "final", createdAt: new Date(Date.now() - 55 * 86_400_000).toISOString() },
  { id: "PRF-003", employeeId: "EMP-012", reviewerId: "EMP-011", period: "2026-Q2", score: 0, strengths: "", improvements: "", goals: "", status: "draft", createdAt: new Date(Date.now() - 5 * 86_400_000).toISOString() },
  // Subang — beda dari pusat
  { id: "PRF-004", employeeId: "EMP-025", reviewerId: "EMP-023", period: "2026-Q1", score: 4, strengths: "Cepat tanggap antrean walk-in, komunikasi warga lokal kuat.", improvements: "Perlu dokumentasi kas harian lebih rapi.", goals: "Turunkan waktu respon antrian di bawah 5 menit.", status: "final", createdAt: new Date(Date.now() - 40 * 86_400_000).toISOString() },
  { id: "PRF-005", employeeId: "EMP-026", reviewerId: "EMP-023", period: "2026-Q2", score: 0, strengths: "", improvements: "", goals: "", status: "draft", createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
];

// ── Phase 3-4: Notifications ──────────────────────────────────────
export const notifications: Notification[] = [
  { id: "NTF-001", userId: "USR-001", title: "Pengajuan reimbursement pending", body: "Budi Santoso mengajukan reimbursement transport Rp285.000.", type: "approval", read: false, createdAt: new Date(Date.now() - 86_400_000).toISOString(), link: "/admin" },
  { id: "NTF-002", userId: "USR-001", title: "Cuti menunggu persetujuan", body: "Budi Santoso mengajukan cuti 3 hari mulai " + iso(6) + ".", type: "approval", read: false, createdAt: new Date(Date.now() - 43_200_000).toISOString(), link: "/admin/cuti" },
  { id: "NTF-003", userId: "USR-003", title: "Reimbursement disetujui", body: "Reimbursement transport Rp285.000 telah disetujui.", type: "info", read: true, createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString() },
  // Cabang Subang
  { id: "NTF-004", userId: "USR-007", title: "Pengajuan cuti Rudi Hartawan", body: "Cuti tahunan 3 hari menunggu persetujuan HR Cabang Subang.", type: "approval", read: false, createdAt: new Date(Date.now() - 6 * 3_600_000).toISOString(), link: "/admin/cuti" },
  { id: "NTF-005", userId: "USR-007", title: "Reimburse angkot pelanggan", body: "Rudi Hartawan mengajukan transport Rp120.000 rute Subang–Purwakarta.", type: "approval", read: false, createdAt: new Date(Date.now() - 4 * 3_600_000).toISOString(), link: "/admin/reimbursements" },
  { id: "NTF-006", userId: "USR-004", title: "Lembur menunggu keputusan", body: "Rudi Hartawan mengajukan lembur 2,5 jam input data pelanggan.", type: "approval", read: false, createdAt: new Date(Date.now() - 5 * 3_600_000).toISOString(), link: "/admin/lembur" },
  { id: "NTF-007", userId: "USR-007", title: "Pelamar baru lowongan Subang", body: "Wulan Safitri masuk tahap interview Staf Layanan Cabang Subang.", type: "info", read: false, createdAt: new Date(Date.now() - 3 * 86_400_000).toISOString(), link: "/admin/rekrutmen" },
  { id: "NTF-008", userId: "USR-006", title: "Pelatihan antrian digital", body: "Anda terdaftar di pelatihan SOP Walk-in & Antrian Digital Cabang.", type: "info", read: false, createdAt: new Date(Date.now() - 2 * 86_400_000).toISOString(), link: "/app/pelatihan" },
];

export function seedData(): HrisData {
  return {
    users,
    branches,
    departments,
    positions,
    banks,
    workLocations,
    employees,
    shifts,
    roster,
    attendance,
    leaveTypes,
    leaveRequests,
    overtimeRequests,
    auditLogs,
    announcements,
    reimbursements,
    jobPostings,
    candidates,
    trainings,
    trainingEnrollments,
    assets,
    assetAssignments,
    performanceReviews,
    notifications,
    shiftSwaps: [],
    assetRequests: [],
    settings: { wfh_gps: "TIDAK WAJIB", wfh_face: "WAJIB", wfh_liveness: "WAJIB", checkin_window: "60", ot_mode: "formula", ot_flat_rate: "0", alpha_mode: "proportional", alpha_flat_rate: "0" },
  };
}
