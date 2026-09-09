// Engine payroll — metode Indonesia sederhana.
// ponytail: PPH21 memakai metode tahunan dengan PTKP tunggal 54 jt tanpa
// status kawin/tanggungan & tabel TER penuh — validasi ke konsultan pajak
// sebelum dipakai produksi.

export interface PayrollInput {
  baseSalary: number;
  allowance: number;
  /** Hari terjadwal kerja dalam periode (roster shift ≠ null). */
  scheduledDays: number;
  /** Hari dengan absensi valid (present/late/business_trip/wfh). */
  presentDays: number;
  /** Hari cuti dibayar yang disetujui. */
  paidLeaveDays: number;
  /** Jam lembur disetujui. */
  overtimeHours: number;
}

export interface PayrollBreakdown {
  scheduledDays: number;
  attendedDays: number; // present + paid leave
  alphaDays: number;
  dailyRate: number;
  basePaid: number;
  allowancePaid: number;
  alphaDeduction: number;
  overtimeHours: number;
  overtimeRate: number; // upah lembur per jam (dasar 1/173)
  overtimePay: number;
  gross: number;
  bpjsHealth: number; // 1% employee
  bpjsJht: number; // 2% employee
  tax: number; // PPH21 bulanan (metode tahunan disederhanakan)
  net: number;
}

/** Upah lembur: jam pertama 1,5×, jam berikutnya 2× dari upah per jam (1/173). */
export function overtimePay(hours: number, baseSalary: number, allowance: number): number {
  if (hours <= 0) return 0;
  const rate = (baseSalary + allowance) / 173;
  const first = Math.min(hours, 1) * rate * 1.5;
  const rest = Math.max(0, hours - 1) * rate * 2;
  return Math.round(first + rest);
}

function annualTax(annualNetto: number): number {
  // PTKP tunggal (TK/0): 54.000.000 — tarif progresif UU PPh 17: 5/15/25/30/35%
  const pkp = Math.max(0, annualNetto - 54_000_000);
  const brackets: [number, number][] = [
    [60_000_000, 0.05],      // s.d. 60 jt
    [250_000_000, 0.15],     // 60–250 jt
    [500_000_000, 0.25],     // 250–500 jt
    [5_000_000_000, 0.3],    // 500 jt–5 M
    [Infinity, 0.35],        // > 5 M
  ];
  let remaining = pkp;
  let prevCap = 0;
  let tax = 0;
  for (const [cap, rate] of brackets) {
    const slice = Math.min(remaining, cap - prevCap);
    if (slice <= 0) break;
    tax += slice * rate;
    remaining -= slice;
    prevCap = cap;
  }
  return tax;
}

export function computePayslip(input: PayrollInput): PayrollBreakdown {
  const { baseSalary, allowance, scheduledDays, presentDays, paidLeaveDays, overtimeHours } = input;
  const workdays = Math.max(scheduledDays, presentDays); // guard pembagi nol
  const attendedDays = Math.min(presentDays + paidLeaveDays, workdays);
  const alphaDays = Math.max(0, workdays - attendedDays);
  const dailyRate = Math.round(baseSalary / Math.max(workdays, 1));
  const basePaid = baseSalary - Math.round(dailyRate * alphaDays);
  const allowancePaid = allowance - Math.round((allowance / Math.max(workdays, 1)) * alphaDays);

  const otPay = overtimePay(overtimeHours, baseSalary, allowance);
  const gross = basePaid + allowancePaid + otPay;

  // Biaya jabatan 5%, maks 500 rb/bulan
  const biayaJabatan = Math.min(Math.round(gross * 0.05), 500_000);
  const bpjsJht = Math.round(baseSalary * 0.02);
  const bpjsHealth = Math.round(gross * 0.01);
  const monthlyNetto = gross - biayaJabatan - bpjsJht;
  const tax = Math.round(Math.max(0, annualTax(monthlyNetto * 12)) / 12);

  return {
    scheduledDays,
    attendedDays,
    alphaDays,
    dailyRate,
    basePaid,
    allowancePaid,
    alphaDeduction: baseSalary - basePaid + (allowance - allowancePaid),
    overtimeHours,
    overtimeRate: Math.round(((baseSalary + allowance) / 173) * 100) / 100,
    overtimePay: otPay,
    gross,
    bpjsHealth,
    bpjsJht,
    tax,
    net: Math.max(0, gross - bpjsHealth - bpjsJht - tax),
  };
}
