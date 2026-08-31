import crypto from "crypto";

const ALGORITHM = "aes-256-cbc";
const KEY = crypto.scryptSync(process.env.SESSION_SECRET || "default_secret_key_12345", "salt", 32);

export function encryptDescriptor(descriptor: number[]): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  let encrypted = cipher.update(JSON.stringify(descriptor), "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decryptDescriptor(encrypted: string | null): number[] | null {
  if (!encrypted) return null;
  try {
    const parts = encrypted.split(":");
    if (parts.length !== 2) {
      // fallback jika ada data lama plaintext
      return JSON.parse(encrypted) as number[];
    }
    const iv = Buffer.from(parts[0], "hex");
    const encryptedText = Buffer.from(parts[1], "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    const decrypted = decipher.update(encryptedText);
    const finalBuffer = decipher.final();
    return JSON.parse(decrypted.toString("utf8") + finalBuffer.toString("utf8")) as number[];
  } catch {
    try {
      return JSON.parse(encrypted) as number[];
    } catch {
      return null;
    }
  }
}
