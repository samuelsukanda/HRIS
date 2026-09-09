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
const JUNK_EMAILS = ["mypilako@mailinator.com", "aa"];

async function main() {
  const doDelete = process.argv.includes("--delete");
  const junk = await pool.query(
    `SELECT u.id AS uid, u.email, u.employee_id, u.role, e.name FROM users u JOIN employees e ON e.id=u.employee_id WHERE u.email = ANY($1)`,
    [JUNK_EMAILS],
  );
  if (junk.rows.length === 0) {
    console.log("tidak ada junk user — selesai");
    await pool.end();
    return;
  }
  console.log("junk users:", JSON.stringify(junk.rows, null, 2));
  const uids = junk.rows.map((r) => r.uid);
  const emps = junk.rows.map((r) => r.employee_id);

  const childTables = [
    "payslips",
    "attendance",
    "leave_requests",
    "overtime_requests",
    "reimbursements",
    "training_enrollments",
    "asset_assignments",
    "asset_requests",
    "shift_swaps",
    "roster",
  ] as const;

  const counts: Record<string, number> = {};
  for (const t of childTables) {
    const r = await pool.query(`SELECT COUNT(*)::int AS n FROM ${t} WHERE employee_id = ANY($1)`, [emps]);
    counts[t] = r.rows[0].n;
  }
  const rPerf = await pool.query(
    `SELECT COUNT(*)::int AS n FROM performance_reviews WHERE employee_id = ANY($1) OR reviewer_id = ANY($1)`, [emps],
  );
  counts["performance_reviews (sebagai employee/reviewer)"] = rPerf.rows[0].n;
  const rNotif = await pool.query(`SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = ANY($1)`, [uids]);
  counts["notifications"] = rNotif.rows[0].n;
  console.log("baris dependen:", JSON.stringify(counts, null, 2));

  // referensi silang dari karyawan sah
  const asManager = await pool.query(
    `SELECT id, name FROM employees WHERE manager_id = ANY($1) AND id <> ALL($1)`, [emps],
  );
  if (asManager.rows.length) console.log("DIREFERENSI sebagai manager oleh:", JSON.stringify(asManager.rows));
  const asReviewer = await pool.query(
    `SELECT pr.id, pr.employee_id, e.name AS reviewed_name FROM performance_reviews pr JOIN employees e ON e.id=pr.employee_id
     WHERE pr.reviewer_id = ANY($1) AND pr.employee_id <> ALL($1)`, [emps],
  );
  if (asReviewer.rows.length) console.log("DIREFERENSI sebagai reviewer oleh:", JSON.stringify(asReviewer.rows));

  if (!doDelete) {
    console.log("dry-run — jalankan ulang dengan --delete untuk menghapus");
    await pool.end();
    return;
  }
  if (asManager.rows.length || asReviewer.rows.length) {
    console.log("ADA referensi silang — batalkan, putuskan dulu penanganannya");
    await pool.end();
    process.exit(1);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const del = async (sql: string, params: unknown[], label: string) => {
      const r = await client.query(sql, params);
      console.log(`- ${label}: ${r.rowCount}`);
    };
    await del(`DELETE FROM notifications WHERE user_id = ANY($1)`, [uids], "notifications");
    await del(`DELETE FROM users WHERE id = ANY($1)`, [uids], "users");
    for (const t of childTables) {
      await del(`DELETE FROM ${t} WHERE employee_id = ANY($1)`, [emps], t);
    }
    await del(
      `DELETE FROM performance_reviews WHERE employee_id = ANY($1) OR reviewer_id = ANY($1)`,
      [emps], "performance_reviews",
    );
    await del(`DELETE FROM employees WHERE id = ANY($1)`, [emps], "employees");
    await client.query("COMMIT");
    console.log("COMMIT — junk accounts terhapus");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }

  const check = await pool.query(
    `SELECT
      (SELECT COUNT(*)::int FROM users WHERE email = ANY($1)) AS users,
      (SELECT COUNT(*)::int FROM employees WHERE id = ANY($2)) AS employees,
      (SELECT COUNT(*)::int FROM payslips WHERE employee_id = ANY($2)) AS payslips`,
    [JUNK_EMAILS, emps],
  );
  console.log("verifikasi:", JSON.stringify(check.rows[0]));
  await pool.end();
}

main().catch((e) => { console.error("FAIL", e); process.exit(1); });
