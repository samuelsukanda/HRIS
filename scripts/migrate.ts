import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { Pool } from "pg";

try {
  if (!process.env.DATABASE_URL) loadEnvFile(".env");
} catch {}

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 2 });

async function main() {
  const sql = readFileSync(join(process.cwd(), "src/db/schema.sql"), "utf8");
  await pool.query(sql);
  console.log("schema applied");
  await pool.end();
}

main().catch((e) => { console.error("MIGRATE FAIL", e); process.exit(1); });
