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
  await pool.query(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS brand TEXT`);
  await pool.query(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS model TEXT`);
  await pool.query(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS purchase_price INTEGER`);
  await pool.query(`ALTER TABLE assets ADD COLUMN IF NOT EXISTS notes TEXT`);
  const r = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name='assets' ORDER BY ordinal_position`);
  console.log("assets columns:", r.rows.map((x: { column_name: string }) => x.column_name).join(","));
  await pool.end();
}

main().catch((e) => { console.error("MIGRATE FAIL", e); process.exit(1); });
