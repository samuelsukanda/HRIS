import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { computePayslip } from "../src/lib/payroll";
import type { PayrollBreakdown } from "../src/lib/payroll";

// Perbaikan satu kali: hitung ulang breakdown payslip tersimpan memakai engine
// yang sudah diperbaiki (clamp upah ≥ 0, BPJS JHT atas upah terbayar).
// Input komputasi direkonstruksi dari breakdown lama + gaji tunjangan kini.

// muat .env manual sebelum buka koneksi (tsx tidak auto-load seperti Next)
try {
  const env = readFileSync(join(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* abaikan */ }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function main() {
  const rows = await pool.query(
    `SELECT s.id, s.breakdown, e.base_salary, e.allowance
     FROM payslips s JOIN employees e ON e.id = s.employee_id`,
  );
  let fixed = 0;
  for (const r of rows.rows) {
    const old = r.breakdown as PayrollBreakdown;
    const input = {
      baseSalary: r.base_salary,
      allowance: r.allowance,
      scheduledDays: old.scheduledDays,
      presentDays: old.attendedDays, // attendedDays sudah termasuk cuti dibayar
      paidLeaveDays: 0,
      overtimeHours: old.overtimeHours,
    };
    const next = computePayslip(input);
    if (old.basePaid === next.basePaid && old.bpjsJht === next.bpjsJht && old.net === next.net) continue;
    await pool.query(`UPDATE payslips SET breakdown = $1 WHERE id = $2`, [JSON.stringify(next), r.id]);
    fixed++;
    console.log(
      `${r.id}: net ${old.net.toLocaleString("id-ID")} → ${next.net.toLocaleString("id-ID")} (basePaid ${old.basePaid.toLocaleString("id-ID")} → ${next.basePaid.toLocaleString("id-ID")}, bpjsJht ${old.bpjsJht.toLocaleString("id-ID")} → ${next.bpjsJht.toLocaleString("id-ID")})`,
    );
  }
  console.log(`diperiksa ${rows.rowCount}, diperbaiki ${fixed}`);
  await pool.end();
}

main().catch((e) => { console.error("REPAIR FAIL", e); process.exit(1); });
