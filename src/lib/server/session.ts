import { cookies } from "next/headers";
import { pool } from "@/db/client";
import { COOKIE_NAME, createSessionToken, readSessionToken } from "./auth";

export async function setSessionCookie(userId: string) {
  const jar = await cookies();
  jar.set(COOKIE_NAME, createSessionToken(userId), {
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
  role: string;
  name: string;
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
    `SELECT u.id, u.employee_id, u.email, u.role, e.name
     FROM users u JOIN employees e ON e.id = u.employee_id WHERE u.id = $1 AND u.active = true`,
    [parsed.userId],
  );
  return r.rows[0] ?? null;
}
