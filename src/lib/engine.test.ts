import { describe, expect, it } from "vitest";
import {
  checkGeofence,
  classifyCheckIn,
  computeRisk,
  descriptorVariance,
  haversineM,
  hmToMin,
  leaveBalance,
  passiveLiveness,
  runValidationPipeline,
} from "@/lib/engine";

// PRD §80 — Acceptance Criteria

describe("geofence", () => {
  const kantorPusat = { latitude: -6.2, longitude: 106.816666, radiusM: 100 };

  it("menghitung jarak Monas→Bundaran HI realistis", () => {
    const d = haversineM(-6.2, 106.816666, -6.1946761, 106.823);
    expect(d).toBeGreaterThan(800);
    expect(d).toBeLessThan(1500);
  });

  it("skenario 2: 350 m di luar radius → REJECT", () => {
    // titik ~350 m ke utara
    const p = { latitude: -6.2 + 350 / 111_320, longitude: 106.816666 };
    const v = checkGeofence(p, kantorPusat);
    expect(v.pass).toBe(false);
    expect(v.distanceM).toBeGreaterThanOrEqual(300);
    expect(v.distanceM).toBeLessThanOrEqual(400);
  });

  it("dalam radius → PASS", () => {
    const p = { latitude: -6.2 + 40 / 111_320, longitude: 106.816666 };
    expect(checkGeofence(p, kantorPusat).pass).toBe(true);
  });
});

describe("jam", () => {
  it("konversi HH:MM", () => {
    expect(hmToMin("07:15")).toBe(435);
  });

  it("skenario 6: shift 07:00 grace 10 mnt, check-in 07:23 → LATE 23 menit", () => {
    const at = new Date(2026, 7, 26, 7, 23);
    expect(classifyCheckIn({ start: "07:00", graceMinutes: 10 }, at)).toEqual({
      kind: "late",
      lateMinutes: 23,
    });
  });

  it("tepat waktu dan dalam grace period tidak dihitung terlambat", () => {
    expect(classifyCheckIn({ start: "07:00", graceMinutes: 10 }, new Date(2026, 7, 26, 7, 0)).kind).toBe("on_time");
    expect(classifyCheckIn({ start: "07:00", graceMinutes: 10 }, new Date(2026, 7, 26, 7, 9)).kind).toBe("grace");
  });
});

describe("risk engine (PRD §45)", () => {
  it("kondisi bersih = low risk", () => {
    const r = computeRisk({
      mockLocation: false,
      developerMode: false,
      accuracyM: 8,
      faceScore: 0.96,
      livenessPassed: true,
      distanceOverByM: 0,
      deviceChanged: false,
    });
    expect(r.level).toBe("low");
    expect(r.score).toBeLessThan(30);
  });

  it("mock location = high risk", () => {
    const r = computeRisk({
      mockLocation: true,
      developerMode: false,
      accuracyM: 5,
      faceScore: 0.95,
      livenessPassed: true,
      distanceOverByM: 0,
      deviceChanged: false,
    });
    expect(r.level).toBe("high");
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  it("liveness gagal + wajah rendah menjumlahkan faktor", () => {
    const r = computeRisk({
      mockLocation: false,
      developerMode: false,
      accuracyM: 10,
      faceScore: 0.6,
      livenessPassed: false,
      distanceOverByM: 50,
      deviceChanged: false,
    });
    expect(r.factors.length).toBeGreaterThanOrEqual(3);
    expect(r.level).toBe("high");
  });
});

describe("pipeline validasi (PRD §80 skenario)", () => {
  const base = {
    authenticated: true,
    deviceTrusted: true,
    gpsActive: true,
    geofence: { pass: true, distanceM: 42, maxRadiusM: 100 },
    mockLocation: false,
    faceDetected: true,
    livenessPassed: true,
    faceScore: 0.96,
    hasScheduleToday: true,
    withinCheckInWindow: true,
  };

  it("skenario 1: semua pass → VALID dengan 7 tahap", () => {
    const r = runValidationPipeline(base);
    expect(r.valid).toBe(true);
    expect(r.stages.length).toBe(7);
    expect(r.stages.every((s) => s.pass)).toBe(true);
  });

  it("skenario 3: photo attack (liveness gagal) → REJECT", () => {
    const r = runValidationPipeline({ ...base, livenessPassed: false });
    expect(r.valid).toBe(false);
    expect(r.failureReason).toContain("attack");
  });

  it("skenario 4: orang salah (wajah mismatch) → REJECT di tahap verifikasi", () => {
    const r = runValidationPipeline({ ...base, faceScore: 0.62 });
    expect(r.valid).toBe(false);
    expect(r.stages[5]!.pass).toBe(false);
  });

  it("skenario 5: mock GPS → REJECT di tahap geofence", () => {
    const r = runValidationPipeline({ ...base, mockLocation: true });
    expect(r.valid).toBe(false);
    expect(r.stages[2]!.pass).toBe(false);
  });
});

describe("cuti & lembur", () => {
  it("saldo = alokasi − used − pending", () => {
    const b = leaveBalance(12, [
      { status: "approved", days: 4 },
      { status: "pending", days: 1 },
      { status: "rejected", days: 3 },
    ]);
    expect(b).toEqual({ allocation: 12, used: 4, pending: 1, remaining: 7 }); // contoh PRD §22
  });

  it("lembur ikut rumus payroll 1/173", async () => {
    const { overtimePay } = await import("@/lib/payroll");
    const rate = (6_500_000 + 1_200_000) / 173;
    expect(overtimePay(2, 6_500_000, 1_200_000)).toBe(Math.round(rate * 1.5 + rate * 2));
  });
});

describe("liveness pasif (micro-variance)", () => {
  const base = Array.from({ length: 128 }, (_, i) => Math.sin(i) * 0.3);
  const jitter = (amt: number, seed: number) =>
    base.map((v, i) => v + Math.sin(i * 12.9898 + seed * 78.233) * amt);

  it("frame identik → variansi 0, tidak lolos", () => {
    const frames = [base, [...base], [...base]];
    expect(descriptorVariance(frames)).toBe(0);
    expect(passiveLiveness(frames).passed).toBe(false);
  });

  it("satu frame → tidak lolos (data kurang)", () => {
    expect(passiveLiveness([base]).passed).toBe(false);
  });

  it("wajah hidup (jitter kecil) → lolos dengan skor > 0", () => {
    const frames = [0, 1, 2, 3, 4].map((s) => jitter(0.02, s));
    const r = passiveLiveness(frames);
    expect(r.passed).toBe(true);
    expect(r.score).toBeGreaterThan(0);
    expect(r.score).toBeLessThanOrEqual(1);
  });

  it("gerakan besar → skor penuh", () => {
    const frames = [0, 1, 2].map((s) => jitter(0.2, s));
    expect(passiveLiveness(frames).score).toBe(1);
  });
});
