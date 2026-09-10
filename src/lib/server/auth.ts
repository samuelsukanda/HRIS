import { randomBytes, scryptSync, timingSafeEqual, createHmac } from "node:crypto";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret";
export const COOKIE_NAME = "hris_session";
const MAX_AGE_S = 60 * 60 * 24 * 7; // 7 hari

// Password sementara yang mudah dibaca & dikomunikasikan: KataKata99!
const PASSWORD_WORDS_A = [
  "Kopi", "Teh", "Bulan", "Laut", "Gunung", "Panda", "Nasi", "Bunga", "Sungai", "Mangga",
  "Kelapa", "Sawah", "Pelangi", "Kucing", "Rimba", "Tebu", "Padi", "Awan", "Burung", "Bambu",
] as const;
const PASSWORD_WORDS_B = [
  "Biru", "Hijau", "Merah", "Kuning", "Ungu", "Putih", "Ceria", "Santai", "Manis", "Segar",
  "Terang", "Senja", "Pagi", "Damai", "Embun", "Angin", "Hujan", "Bintang", "Lembah", "Mango",
] as const;

function pick<T>(list: readonly T[]): T {
  return list[randomBytes(1)[0] % list.length];
}

export function randomPassword(): string {
  const digits = String((randomBytes(1)[0] % 90) + 10);
  const special = pick(["!", "@", "#", "$", "%"] as const);
  return `${pick(PASSWORD_WORDS_A)}${pick(PASSWORD_WORDS_B)}${digits}${special}`;
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hex] = stored.split(":");
  if (!salt || !hex) return false;
  const a = Buffer.from(hex, "hex");
  const b = scryptSync(password, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload = Buffer.from(JSON.stringify({ userId, exp: Date.now() + MAX_AGE_S * 1000 })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function readSessionToken(token: string | undefined): { userId: string } | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as { userId: string; exp: number };
    if (Date.now() > parsed.exp) return null;
    return { userId: parsed.userId };
  } catch {
    return null;
  }
}

export const cookieOptions = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE_S}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`;
