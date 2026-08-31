import { describe, expect, it } from "vitest";
import {
  checkGeofence,
  classifyCheckIn,
  computeRisk,
  haversineM,
  hmToMin,
  leaveBalance,
  minToHm,
  overtimeAmount,
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
  it("konversi HH:MM dua arah", () => {
    expect(hmToMin("07:15")).toBe(435);
    expect(minToHm(435)).toBe("07:15");
    expect(minToHm(hmToMin("23:59"))).toBe("23:59");
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

  it("lembur dibulatkan ke rupiah", () => {
    expect(overtimeAmount(2.5, 25_000)).toBe(62_500);
    expect(overtimeAmount(3, 25_000)).toBe(75_000);
  });
});
