import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

// Migrasi role: hr_admin + hr_manager -> hr, finance -> employee
try {
  const env = readFileSync(join(process.cwd(), ".env"), "utf8");
  for (const line of env.split("\n")) {
    const m = line.match(/^\s*([A-Za-z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
} catch { /* abaikan */ }

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function main() {
  const toHr = await pool.query(`UPDATE users SET role='hr' WHERE role IN ('hr_admin','hr_manager')`);
  const toEmployee = await pool.query(`UPDATE users SET role='employee' WHERE role='finance'`);
  // Sinkron seed: USR-001 (Samuel Hartono) terdeklarasi sebagai HR di data.ts
  const toHrSeed = await pool.query(`UPDATE users SET role='hr' WHERE id='USR-001' AND role<>'hr'`);
  console.log(`hr_admin/hr_manager -> hr : ${toHr.rowCount} akun`);
  console.log(`finance -> employee      : ${toEmployee.rowCount} akun`);
  console.log(`USR-001 -> hr            : ${toHrSeed.rowCount} akun`);
  const roles = await pool.query(`SELECT role, count(*)::int AS total FROM users GROUP BY role ORDER BY role`);
  console.log("Distribusi role sekarang:", roles.rows.map((r) => `${r.role}=${r.total}`).join(", "));
  await pool.end();
}

main().catch((e) => { console.error("MIGRATE ROLES FAIL", e); process.exit(1); });
