// Ambil screenshot viewport presisi via Chrome terinstall (tanpa unduh browser)
// Pemakaian: node scripts/shots.mjs <outDir>
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const outDir = resolve(process.argv[2] ?? ".impeccable/review");
mkdirSync(outDir, { recursive: true });

const SHOTS = [
  ["mobile-app-home", 390, 844, "http://localhost:3000/app?as=USR-003"],
  ["mobile-app-absensi", 390, 844, "http://localhost:3000/app/absensi?as=USR-003"],
  ["mobile-app-cuti", 390, 844, "http://localhost:3000/app/cuti?as=USR-003"],
  ["mobile-app-jadwal", 390, 844, "http://localhost:3000/app/jadwal?as=USR-003"],
  ["mobile-app-profil", 390, 844, "http://localhost:3000/app/profil?as=USR-003"],
];

const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  for (const [name, width, height, url] of SHOTS) {
    const page = await browser.newPage({ viewport: { width, height } });
    await page.goto(url, { waitUntil: "networkidle" });
    await page.waitForTimeout(600);
    await page.screenshot({ path: resolve(outDir, `${name}.png`), fullPage: true });
    console.log(`ok ${name}`);
    await page.close();
  }
} finally {
  await browser.close();
}
