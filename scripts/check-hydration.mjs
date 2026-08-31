import { chromium } from "playwright-core";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const errors = [];
// Page 1: login page
const p1 = await ctx.newPage();
p1.on("pageerror", e => errors.push("PAGEERR:" + String(e).slice(0,100)));
p1.on("console", m => { if (m.type() === "error") errors.push("CONSOLE:" + m.text().slice(0,120)); });
await p1.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p1.waitForTimeout(2000);
// Page 2: admin dashboard
const p2 = await ctx.newPage();
p2.on("pageerror", e => errors.push("PAGEERR:" + String(e).slice(0,100)));
p2.on("console", m => { if (m.type() === "error") errors.push("CONSOLE:" + m.text().slice(0,120)); });
await p2.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p2.evaluate(async () => {
  await fetch("http://localhost:3000/api/auth/dev-login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({userId:"USR-001"}) });
});
await p2.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
await p2.waitForTimeout(2000);
// Page 3: employee home
const p3 = await ctx.newPage();
p3.on("pageerror", e => errors.push("PAGEERR:" + String(e).slice(0,100)));
p3.on("console", m => { if (m.type() === "error") errors.push("CONSOLE:" + m.text().slice(0,120)); });
await p3.goto("http://localhost:3000/", { waitUntil: "networkidle" });
await p3.evaluate(async () => {
  await fetch("http://localhost:3000/api/auth/dev-login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({userId:"USR-003"}) });
});
await p3.goto("http://localhost:3000/app", { waitUntil: "networkidle" });
await p3.waitForTimeout(2000);
const hydrationErrors = errors.filter(e => e.toLowerCase().includes("hydrat"));
console.log("Total errors:", errors.length);
console.log("Hydration errors:", hydrationErrors.length);
if (hydrationErrors.length) hydrationErrors.forEach(e => console.log("  -", e));
else console.log("  No hydration errors");
if (errors.length && !hydrationErrors.length) {
  console.log("Other errors:");
  errors.forEach(e => console.log("  -", e));
}
await browser.close();
