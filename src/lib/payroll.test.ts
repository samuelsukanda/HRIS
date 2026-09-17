import { describe, expect, it } from "vitest";
import { computePayslip, overtimePay, type PayrollConfig } from "./payroll";

describe("overtimePay", () => {
  it("jam pertama 1.5x", () => {
    // rate = (6_500_000 + 1_200_000)/173 ≈ 44_508
    expect(overtimePay(1, 6_500_000, 1_200_000)).toBe(Math.round(((6_500_000 + 1_200_000) / 173) * 1.5));
  });
  it("jam kedua dst 2x", () => {
    const rate = (6_500_000 + 1_200_000) / 173;
    expect(overtimePay(3, 6_500_000, 1_200_000)).toBe(Math.round(rate * 1.5 + rate * 4));
  });
  it("0 jam = 0", () => {
    expect(overtimePay(0, 6_500_000, 1_200_000)).toBe(0);
  });
});

describe("computePayslip", () => {
  const base = { baseSalary: 10_000_000, allowance: 1_000_000 };

  it("hadir penuh tanpa lembur: net = gross - potongan", () => {
    const p = computePayslip({ ...base, scheduledDays: 20, presentDays: 20, paidLeaveDays: 0, overtimeHours: 0 });
    expect(p.alphaDays).toBe(0);
    expect(p.gross).toBe(11_000_000);
    expect(p.net).toBe(p.gross - p.bpjsHealth - p.bpjsJht - p.tax);
  });

  it("alpha memotong gaji proporsional harian", () => {
    const p = computePayslip({ ...base, scheduledDays: 20, presentDays: 18, paidLeaveDays: 0, overtimeHours: 0 });
    expect(p.alphaDays).toBe(2);
    expect(p.dailyRate).toBe(500_000);
    expect(p.basePaid).toBe(9_000_000);
  });

  it("cuti dibayar tidak dipotong", () => {
    const a = computePayslip({ ...base, scheduledDays: 20, presentDays: 18, paidLeaveDays: 2, overtimeHours: 0 });
    expect(a.alphaDays).toBe(0);
    expect(a.basePaid).toBe(10_000_000);
  });

  it("lembur menambah bruto sesuai rumus 1/173", () => {
    const p = computePayslip({ ...base, scheduledDays: 20, presentDays: 20, paidLeaveDays: 0, overtimeHours: 2 });
    expect(p.overtimePay).toBe(overtimePay(2, 10_000_000, 1_000_000));
    expect(p.gross).toBe(11_000_000 + p.overtimePay);
  });

  it("gaji kecil di bawah PTKP → pajak nol", () => {
    const p = computePayslip({ baseSalary: 3_000_000, allowance: 200_000, scheduledDays: 20, presentDays: 20, paidLeaveDays: 0, overtimeHours: 0 });
    expect(p.tax).toBe(0);
  });

  it("BPJS mengikuti rumus", () => {
    const p = computePayslip({ ...base, scheduledDays: 20, presentDays: 19, paidLeaveDays: 1, overtimeHours: 0 });
    expect(p.bpjsHealth).toBe(Math.round(p.gross * 0.01));
    expect(p.bpjsJht).toBe(Math.round(p.basePaid * 0.02)); // 2% dari upah terbayar
  });

  it("alpha penuh: upah tak pernah negatif dan potongan nol", () => {
    // replika September 2026: 3 hari kerja, alpha 3, pembulatan harian 6.500.001
    const p = computePayslip({ baseSalary: 6_500_000, allowance: 1_200_000, scheduledDays: 3, presentDays: 0, paidLeaveDays: 0, overtimeHours: 0 });
    expect(p.basePaid).toBe(0);
    expect(p.allowancePaid).toBe(0);
    expect(p.gross).toBe(0);
    expect(p.bpjsJht).toBe(0);
    expect(p.bpjsHealth).toBe(0);
    expect(p.tax).toBe(0);
    expect(p.net).toBe(0);
  });

  it("scheduledDays 0 tapi ada presensi → tidak NaN", () => {
    const p = computePayslip({ ...base, scheduledDays: 0, presentDays: 5, paidLeaveDays: 0, overtimeHours: 0 });
    expect(Number.isFinite(p.net)).toBe(true);
  });
});

describe("mode tarif flat (master data)", () => {
  const flat = (otFlatRate: number, alphaFlatRate: number): PayrollConfig => ({
    otMode: "flat", otFlatRate, alphaMode: "flat", alphaFlatRate,
  });

  it("lembur flat: tarif × jam, tanpa ×1,5/×2", () => {
    expect(overtimePay(2, 10_000_000, 1_000_000, flat(50_000, 0))).toBe(100_000);
    expect(overtimePay(3, 10_000_000, 1_000_000, flat(50_000, 0))).toBe(150_000);
  });

  it("alpha flat: potongan tarif × hari alpha", () => {
    const p = computePayslip({ baseSalary: 10_000_000, allowance: 1_000_000, scheduledDays: 20, presentDays: 18, paidLeaveDays: 0, overtimeHours: 0 }, flat(0, 100_000));
    expect(p.alphaDays).toBe(2);
    expect(p.alphaDeduction).toBe(200_000);
    expect(p.basePaid).toBe(9_800_000);
    expect(p.allowancePaid).toBe(1_000_000); // pokok cukup menutup potongan
  });

  it("alpha flat melebihi pokok: sisa dipotong dari tunjangan, upah tak negatif", () => {
    const p = computePayslip({ baseSalary: 10_000_000, allowance: 1_000_000, scheduledDays: 20, presentDays: 18, paidLeaveDays: 0, overtimeHours: 0 }, flat(0, 6_000_000));
    // 2 hari × 6 jt = 12 jt, di-clamp ≤ 11 jt (upah total)
    expect(p.alphaDeduction).toBe(11_000_000);
    expect(p.basePaid).toBe(0);
    expect(p.allowancePaid).toBe(0);
    expect(p.gross).toBe(0);
  });

  it("alpha flat di-clamp ≤ upah total saat alpha penuh", () => {
    const p = computePayslip({ baseSalary: 3_000_000, allowance: 500_000, scheduledDays: 20, presentDays: 0, paidLeaveDays: 0, overtimeHours: 0 }, flat(0, 10_000_000));
    expect(p.alphaDeduction).toBe(3_500_000);
    expect(p.gross).toBe(0);
  });

  it("overtimeRate breakdown = tarif flat", () => {
    const p = computePayslip({ baseSalary: 10_000_000, allowance: 1_000_000, scheduledDays: 20, presentDays: 20, paidLeaveDays: 0, overtimeHours: 1 }, flat(75_000, 0));
    expect(p.overtimeRate).toBe(75_000);
    expect(p.overtimePay).toBe(75_000);
  });

  it("mode campuran: lembur flat + alpha proporsional", () => {
    const cfg: PayrollConfig = { otMode: "flat", otFlatRate: 50_000, alphaMode: "proportional", alphaFlatRate: 0 };
    const p = computePayslip({ baseSalary: 10_000_000, allowance: 1_000_000, scheduledDays: 20, presentDays: 18, paidLeaveDays: 0, overtimeHours: 2 }, cfg);
    expect(p.overtimePay).toBe(100_000);
    expect(p.basePaid).toBe(9_000_000); // proporsional harian tetap
  });
});
