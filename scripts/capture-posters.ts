/**
 * `pnpm posters` — stills of the room's overview, taken from the live 3D (Metal), for the loader:
 * the visitor sees the room at once, and the real one fades in over it on the same framing.
 * Writes public/poster/room-{desktop,mobile}-{day,night}.webp. Needs a running server
 * (pnpm build && pnpm start -p 3100). Re-run after changing the art or the overview camera.
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const out = path.join(process.cwd(), "public", "poster");
fs.mkdirSync(out, { recursive: true });

const TIERS = {
  desktop: { viewport: { width: 1440, height: 900 }, quality: 74 },
  mobile: { viewport: { width: 390, height: 844 }, quality: 72, isMobile: true, hasTouch: true },
} as const;

const browser = await chromium.launch({ args: ["--use-angle=metal", "--ignore-gpu-blocklist"] });
for (const [tier, { quality, ...options }] of Object.entries(TIERS)) {
  const context = await browser.newContext({ ...options, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const time of ["day", "night"] as const) {
    await page.goto(`${base}/?test=1&time=${time}`, { waitUntil: "load" });
    await page.waitForSelector('html[data-scene="ready"]', { timeout: 120_000 });
    // only the room: no switch, pins, loader or toast
    await page.addStyleTag({ content: ".mode, .hotspots, .loader, .toast, .captions { display: none !important; }" });
    // the window view and the covers load after "ready": give them a moment
    await page.waitForTimeout(2500);
    const png = await page.screenshot();
    const file = path.join(out, `room-${tier}-${time}.webp`);
    await sharp(png).webp({ quality, effort: 6 }).toFile(file);
    console.log(`✓ ${path.relative(process.cwd(), file)} ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
  }
  await context.close();
}
await browser.close();
