import { Pool } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

declare global {
  // eslint-disable-next-line no-var
  var __hrisPool: Pool | undefined;
}

export const pool =
  globalThis.__hrisPool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  });

if (process.env.NODE_ENV !== "production") globalThis.__hrisPool = pool;

export async function applySchema() {
  const sql = readFileSync(join(process.cwd(), "src/db/schema.sql"), "utf8");
  await pool.query(sql);
}
