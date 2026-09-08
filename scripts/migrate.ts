import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

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
  const sql = readFileSync(join(process.cwd(), "src/db/schema.sql"), "utf8");
  await pool.query(sql);
  const tables = ["shift_swaps", "settings", "asset_requests"];
  for (const t of tables) {
    const r = await pool.query(`SELECT COUNT(*)::int AS c FROM ${t}`);
    console.log(t, "rows:", r.rows[0].c);
  }
  const cols = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name IN ('users','leave_requests','reimbursements','assets') AND column_name IN ('active','attachment_url','brand','model','purchase_price','notes') ORDER BY table_name, column_name`);
  console.log("new cols:", cols.rows.map((x: { column_name: string }) => x.column_name).join(","));
  await pool.end();
}

main().catch((e) => { console.error("MIGRATE FAIL", e); process.exit(1); });
