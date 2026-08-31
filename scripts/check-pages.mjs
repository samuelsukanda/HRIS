import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await page.evaluate(async () => {
  await fetch("/api/auth/dev-login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({userId:"USR-001"}) });
});
await page.goto("http://localhost:3000/admin/payroll", { waitUntil: "networkidle" });
await page.waitForTimeout(1000);
console.log("runs listed:", await page.locator("section[aria-label='Riwayat payroll'] li").count());
await page.locator("section[aria-label='Riwayat payroll'] li button").first().click();
await page.waitForTimeout(1200);
console.log("table rows:", await page.locator("tbody tr").count());
console.log("stamp:", await page.locator("section[aria-label^='Detail'] header span").first().textContent());
await browser.close();
