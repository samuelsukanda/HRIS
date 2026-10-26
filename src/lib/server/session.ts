import { cookies } from "next/headers";
import { pool } from "@/db/client";
import { isActiveEmployeeStatus } from "@/lib/server/access";
import type { Role } from "@/lib/types";
import { COOKIE_NAME, createSessionToken, readSessionToken } from "./auth";

export async function setSessionCookie(userId: string) {
  const result = await pool.query(`SELECT session_version FROM users WHERE id=$1`, [userId]);
  const sessionVersion = Number(result.rows[0]?.session_version ?? 0);
  const jar = await cookies();
  jar.set(COOKIE_NAME, createSessionToken(userId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE_NAME);
}

export interface SessionUserRow {
  id: string;
  employee_id: string;
  email: string;
  role: Role;
  name: string;
  branch_id: string;
  status: string;
}

export async function getSessionUser(): Promise<SessionUserRow | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  // verifikasi ringan tanpa impor berat — gunakan verify dari auth
  const parsed = readSessionToken(token);
  if (!parsed) return null;
  const r = await pool.query(
    `SELECT u.id, u.employee_id, u.email, u.role, e.name, e.branch_id, e.status
     FROM users u JOIN employees e ON e.id = u.employee_id
     WHERE u.id = $1 AND u.active = true AND u.session_version = $2`,
    [parsed.userId, parsed.sessionVersion],
  );
  const row = r.rows[0];
  const validRoles = new Set(["super_admin", "hr", "manager", "supervisor", "employee"]);
  return row && validRoles.has(row.role) && isActiveEmployeeStatus(row.status) ? row : null;
}
