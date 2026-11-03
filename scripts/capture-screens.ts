/**
 * Screenshots of the live desktop and phone UIs → art/out/views/screen_{computer,phone}.png, so the
 * Blender stills (og_image.py) show what the screens really show. Needs a running server:
 *   pnpm build && pnpm start -p 3100, then `tsx scripts/capture-screens.ts`
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const out = path.join(process.cwd(), "art", "out", "views");
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
for (const [id, route] of [["computer", "/computer/arc-studio"], ["phone", "/phone"]] as const) {
  await page.goto(`${base}${route}?test=1&time=day`);
  await page.waitForSelector(`.screen[data-screen="${id}"][data-docked="1"]`, { timeout: 60_000 });
  await page.waitForTimeout(300);
  const file = path.join(out, `screen_${id}.png`);
  await page.locator(`.screen[data-screen="${id}"]`).screenshot({ path: file });
  console.log(`✓ ${path.relative(process.cwd(), file)}`);
}
await browser.close();
