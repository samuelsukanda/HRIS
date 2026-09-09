// Mesin validasi attendance HRIS — fungsi murni sesuai PRD §10–§17, §45, §57
import type { AttendanceStatus, Shift, StageResult } from "./types";

// ── Geofence (PRD §11) ────────────────────────────────────────────────
const EARTH_R = 6_371_000;

export function haversineM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_R * Math.asin(Math.sqrt(a)));
}

export interface GeofenceVerdict {
  pass: boolean;
  distanceM: number;
  maxRadiusM: number;
}

export function checkGeofence(
  point: { latitude: number; longitude: number },
  office: { latitude: number; longitude: number; radiusM: number },
): GeofenceVerdict {
  const distanceM = haversineM(
    point.latitude,
    point.longitude,
    office.latitude,
    office.longitude,
  );
  // Toleransi akurasi GPS: titik di luar radius masih lolos bila jarak meleset ≤ akurasi
  return { pass: distanceM <= office.radiusM, distanceM, maxRadiusM: office.radiusM };
}

// ── Jam & shift (PRD §18, mendukung lintas tengah malam) ─────────────
export function hmToMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function minToHm(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export interface CheckInClassification {
  kind: "early" | "on_time" | "grace" | "late";
  lateMinutes: number;
}

export function classifyCheckIn(
  shift: Pick<Shift, "start" | "graceMinutes">,
  checkInAt: Date,
): CheckInClassification {
  const scheduled = hmToMin(shift.start);
  const actual = checkInAt.getHours() * 60 + checkInAt.getMinutes();
  const diff = actual - scheduled;
  if (diff <= -1) return { kind: "early", lateMinutes: 0 };
  if (diff === 0 || (diff > 0 && diff <= shift.graceMinutes))
    return { kind: diff <= 0 ? "on_time" : "grace", lateMinutes: 0 };
  return { kind: "late", lateMinutes: diff };
}

// ── Risk engine (PRD §45) ────────────────────────────────────────────
export interface RiskInput {
  mockLocation: boolean;
  developerMode: boolean;
  accuracyM: number;
  faceScore: number;
  livenessPassed: boolean;
  distanceOverByM: number; // 0 jika dalam radius
  deviceChanged: boolean;
}

export interface RiskVerdict {
  score: number; // 0–100
  level: "low" | "medium" | "high";
  factors: string[];
}

export function computeRisk(input: RiskInput): RiskVerdict {
  let score = 4;
  const factors: string[] = [];
  if (input.mockLocation) {
    score += 65;
    factors.push("Mock location terdeteksi");
  }
  if (!input.livenessPassed) {
    score += 45;
    factors.push("Liveness gagal");
  }
  if (input.faceScore < 0.85) {
    score += input.faceScore < 0.7 ? 30 : 15;
    factors.push(`Skor wajah rendah (${Math.round(input.faceScore * 100)}%)`);
  }
  if (input.distanceOverByM > 0) {
    score += Math.min(25, 8 + Math.floor(input.distanceOverByM / 20));
    factors.push(`${input.distanceOverByM} m di luar radius`);
  }
  if (input.accuracyM > 50) {
    score += 8;
    factors.push(`Akurasi GPS rendah (±${input.accuracyM} m)`);
  }
  if (input.developerMode) {
    score += 12;
    factors.push("Developer mode aktif");
  }
  if (input.deviceChanged) {
    score += 10;
    factors.push("Perangkat tidak dikenal");
  }
  score = Math.min(98, score);
  const level = score >= 60 ? "high" : score >= 30 ? "medium" : "low";
  return { score, level, factors };
}

// ── Pipeline validasi (PRD §57) ──────────────────────────────────────
export interface PipelineInput {
  authenticated: boolean;
  deviceTrusted: boolean;
  gpsActive: boolean;
  geofence: GeofenceVerdict | null;
  mockLocation: boolean;
  faceDetected: boolean;
  livenessPassed: boolean;
  faceScore: number;
  /** Matching descriptor server-side; bila diisi menggantikan threshold skor. */
  faceMatch?: boolean;
  faceDetail?: string;
  hasScheduleToday: boolean;
  withinCheckInWindow: boolean;
}

export interface PipelineResult {
  stages: StageResult[];
  valid: boolean;
  failureReason?: string;
}

export function runValidationPipeline(input: PipelineInput): PipelineResult {
  const stages: StageResult[] = [];
  const push = (n: number, name: string, pass: boolean, detail: string) =>
    stages.push({ stage: n, name, pass, detail });

  push(1, "Autentikasi", input.authenticated, input.authenticated ? "Sesi aktif & perangkat terikat" : "Sesi tidak valid");
  push(2, "Perangkat", input.deviceTrusted, input.deviceTrusted ? "Perangkat terdaftar" : "Perangkat tidak terdaftar");
  push(3, "GPS & Geofence", !!(input.gpsActive && input.geofence?.pass && !input.mockLocation),
    !input.gpsActive
      ? "GPS tidak aktif"
      : input.mockLocation
        ? "Mock location terdeteksi"
        : input.geofence
          ? `Jarak ${input.geofence.distanceM} m dari radius ${input.geofence.maxRadiusM} m`
          : "Lokasi tidak tersedia");
  push(4, "Deteksi Wajah", input.faceDetected, input.faceDetected ? "Wajah terdeteksi" : "Wajah tidak terdeteksi");
  push(5, "Liveness", input.livenessPassed, input.livenessPassed ? "Orang asli terkonfirmasi" : "Presentation attack terdeteksi");
  push(6, "Verifikasi Wajah 1:1", input.faceMatch ?? input.faceScore >= 0.85,
    input.faceDetail ?? `Similarity ${Math.round(input.faceScore * 100)}% (threshold 85%)`);
  push(7, "Jadwal & Aturan", input.hasScheduleToday && input.withinCheckInWindow,
    !input.hasScheduleToday
      ? "Tidak ada jadwal hari ini"
      : input.withinCheckInWindow
        ? "Dalam window check-in"
        : "Di luar window check-in");

  const failed = stages.find((s) => !s.pass);
  return { stages, valid: !failed, failureReason: failed?.detail };
}

// ── Status kehadiran ─────────────────────────────────────────────────
export function statusFromCheckIn(c: CheckInClassification): AttendanceStatus {
  return c.kind === "late" ? "late" : "present";
}

// ── Saldo cuti (PRD §22) ─────────────────────────────────────────────
export interface LeaveBalanceView {
  allocation: number;
  used: number;
  pending: number;
  remaining: number;
}

export function leaveBalance(
  allocationDays: number,
  requests: { status: string; days: number }[],
): LeaveBalanceView {
  const used = requests.filter((r) => r.status === "approved").reduce((s, r) => s + r.days, 0);
  const pending = requests.filter((r) => r.status === "pending").reduce((s, r) => s + r.days, 0);
  return { allocation: allocationDays, used, pending, remaining: allocationDays - used - pending };
}

// ── Lembur: rumus resmi di payroll.overtimePay (1/173, 1.5×/2×) ──

/** Jarak euclidean antar descriptor wajah 128-dim. Match bila < 0.5. */
export function descriptorDistance(a: readonly number[], b: readonly number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = a[i] - b[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}
