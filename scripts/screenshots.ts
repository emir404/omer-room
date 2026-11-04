/**
 * `pnpm shots` — screenshots of every chapter (desktop + mobile, day + night) into
 * test-results/shots/, for visual review. Needs a running server (pnpm build && pnpm start -p 3100).
 *   BASE_URL=http://localhost:3100  ONLY=/shelf,/computer  PW_GPU=1 (Metal instead of SwiftShader)
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const out = path.join(process.cwd(), "test-results", "shots");
fs.mkdirSync(out, { recursive: true });

const ROUTES = (process.env.ONLY?.split(",") ?? [
  "/",
  "/shelf",
  "/shelf/school",
  "/shelf/olympiad",
  "/shelf/books",
  "/shelf/economics-olympiad",
  "/shelf/koc-business-society",
  "/shelf/mundp",
  "/shelf/why-nations-fail",
  "/computer",
  "/computer/arc-studio",
  "/phone",
  "/phone/talk-to-me-about-money",
  "/globe",
  "/globe/kozan",
  "/window",
  "/letter",
  "/contact",
  "/text",
]).map((r) => r.trim());

const VIEWPORTS = {
  desktop: { viewport: { width: 1440, height: 900 } },
  mobile: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
} as const;

const args = process.env.PW_GPU
  ? ["--use-angle=metal", "--ignore-gpu-blocklist"]
  : ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"];

async function settle(page: Page, route: string) {
  if (route === "/text") return;
  await page.waitForSelector('html[data-scene="ready"]', { timeout: 60_000 });
  if (route.startsWith("/computer") || route.startsWith("/phone")) {
    // the live screen docks once the camera is on it (the computer opens as a sheet on phones)
    await page.waitForSelector('.screen[data-docked="1"], [data-testid^="chapter-computer"]', { timeout: 30_000 }).catch(() => {});
  }
  await page.waitForTimeout(400);
}

const browser = await chromium.launch({ args });
for (const [name, options] of Object.entries(VIEWPORTS)) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") console.log(`  [${name}] console.${msg.type()}: ${msg.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => console.log(`  [${name}] pageerror: ${error.message}`));
  for (const route of ROUTES) {
    for (const time of route === "/" || route === "/computer" ? ["day", "night"] : ["day"]) {
      const url = `${base}${route}?test=1&time=${time}`;
      const started = Date.now();
      await page.goto(url, { waitUntil: "load" });
      await settle(page, route);
      const file = path.join(out, `${name}${route === "/" ? "_home" : route.replaceAll("/", "_")}_${time}.png`);
      await page.screenshot({ path: file });
      console.log(`✓ ${name} ${route} (${time}) ${Date.now() - started}ms → ${path.relative(process.cwd(), file)}`);
    }
  }
  await context.close();
}
await browser.close();
