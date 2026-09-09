import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

try {
  const env = readFileSync(join(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* abaikan */ }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function main() {
  const junk = await pool.query(
    `SELECT u.id AS uid, u.email, u.employee_id FROM users u WHERE u.email IN ('mypilako@mailinator.com','aa')`,
  );
  console.log("junk users:", JSON.stringify(junk.rows));
  for (const j of junk.rows as { uid: string; email: string; employee_id: string }[]) {
    const slips = await pool.query(
      `SELECT s.id, s.run_id, r.period, r.status FROM payslips s JOIN payroll_runs r ON r.id=s.run_id WHERE s.employee_id=$1`,
      [j.employee_id],
    );
    console.log(j.email, "payslips:", JSON.stringify(slips.rows));
  }
  await pool.end();
}

main().catch((e) => { console.error("FAIL", e); process.exit(1); });
