import { describe, expect, it } from "vitest";
import { computePayslip, overtimePay } from "./payroll";

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
    expect(p.bpjsJht).toBe(200_000); // 2% dari base
  });

  it("scheduledDays 0 tapi ada presensi → tidak NaN", () => {
    const p = computePayslip({ ...base, scheduledDays: 0, presentDays: 5, paidLeaveDays: 0, overtimeHours: 0 });
    expect(Number.isFinite(p.net)).toBe(true);
  });
});
