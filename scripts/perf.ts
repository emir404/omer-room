/**
 * `pnpm perf` — how the room performs, measured in a real browser: load time and bytes, frame
 * pacing while the camera flies and while you hold something, draw calls and triangles, GPU
 * objects, and whether the canvas really idles (it renders on demand: a still room should draw
 * no frames). Needs a running server (pnpm build && pnpm start -p 3100).
 *   PW_GPU=1      Metal instead of SwiftShader (do this: SwiftShader is a CPU renderer)
 *   PERF_PHONE=1  a 390×844 phone, DPR 3, CPU throttled 4× (a mid-range phone, roughly)
 */
import { chromium, type Page } from "@playwright/test";

const base = process.env.BASE_URL ?? "http://localhost:3100";
const phone = Boolean(process.env.PERF_PHONE);
const args = process.env.PW_GPU ? ["--use-angle=metal", "--ignore-gpu-blocklist"] : ["--use-gl=angle", "--use-angle=swiftshader-webgl", "--enable-unsafe-swiftshader"];

interface Info {
  frame: number;
  calls: number;
  triangles: number;
  textures: number;
  geometries: number;
  programs: number;
  dpr: number;
}

const info = (page: Page) => page.evaluate(() => (window as unknown as { __roomTest: { info(): Info } }).__roomTest.info());

/** Frame pacing over `ms`: the page's rAF deltas (long frames = jank) and the room's own frames. */
async function sample(page: Page, ms: number, during?: () => Promise<void>) {
  const before = await info(page);
  // a plain string: tsx would wrap a named function here in a helper the page doesn't have
  await page.evaluate(`(() => {
    window.__perf = [];
    let last = performance.now();
    const end = last + ${ms};
    requestAnimationFrame(function tick(now) {
      window.__perf.push(now - last);
      last = now;
      if (now < end) requestAnimationFrame(tick);
    });
  })()`);
  if (during) await during();
  await page.waitForTimeout(ms + 100);
  const deltas = await page.evaluate(() => (window as unknown as { __perf: number[] }).__perf.slice(1));
  const after = await info(page);
  deltas.sort((a, b) => a - b);
  const pct = (p: number) => deltas[Math.min(deltas.length - 1, Math.floor(deltas.length * p))] ?? 0;
  return {
    renders: after.frame - before.frame,
    p50: pct(0.5),
    p95: pct(0.95),
    worst: deltas[deltas.length - 1] ?? 0,
    long: deltas.filter((d) => d > 34).length,
    calls: after.calls,
    triangles: after.triangles,
    textures: after.textures,
    geometries: after.geometries,
    programs: after.programs,
  };
}

const browser = await chromium.launch({ args });
const context = await browser.newContext(
  phone ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true } : { viewport: { width: 1440, height: 900 } },
);
const page = await context.newPage();
if (phone) {
  const cdp = await context.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

const bytes = new Map<string, number>();
page.on("requestfinished", async (request) => {
  const url = request.url();
  const kind = url.includes("/3d/") ? "3d" : url.includes("/content/books/") ? "covers" : request.resourceType();
  const { responseBodySize } = await request.sizes();
  bytes.set(kind, (bytes.get(kind) ?? 0) + responseBodySize);
});

const started = Date.now();
await page.goto(`${base}/?perf=1`, { waitUntil: "load" });
const loaded = Date.now() - started;
await page.waitForSelector('html[data-scene="ready"]', { timeout: 120_000 });
const ready = Date.now() - started;
await page.waitForTimeout(1500);

const rows: [string, Awaited<ReturnType<typeof sample>>][] = [];
rows.push(["overview, idle", await sample(page, 2000)]);
const go = (href: string) => page.evaluate((h) => (window as unknown as { __roomTest: { navigate(h: string): void } }).__roomTest.navigate(h), href);
rows.push(["fly to the shelf", await sample(page, 1800, () => go("/shelf"))]);
rows.push(["at the shelf, idle", await sample(page, 1500)]);
rows.push([
  "pick up a book",
  await sample(page, 1800, () => go("/shelf/zero-to-one")),
]);
rows.push([
  "turn it (drag)",
  await sample(page, 1500, async () => {
    const v = page.viewportSize()!;
    const x = phone ? v.width / 2 : v.width * 0.3;
    const y = phone ? v.height * 0.25 : v.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    for (let i = 0; i < 20; i++) await page.mouse.move(x + i * 12, y + i * 3, { steps: 2 });
    await page.mouse.up();
  }),
]);
rows.push(["holding it, idle", await sample(page, 1500)]);
rows.push(["fly to the computer", await sample(page, 2000, () => go("/computer"))]);
rows.push(["at the computer, idle", await sample(page, 1500)]);

const kb = (n = 0) => `${(n / 1024).toFixed(0)} KB`;
console.log(`\n${phone ? "phone (390×844, DPR 3, CPU ×4)" : "desktop (1440×900)"} · ${process.env.PW_GPU ? "Metal" : "SwiftShader"}`);
console.log(`load event ${loaded} ms · room ready ${ready} ms`);
console.log(`downloaded: ${[...bytes].map(([k, v]) => `${k} ${kb(v)}`).join(" · ")}`);
console.log("\nphase                     renders  p50 ms  p95 ms  worst  long  calls  tris     tex  geo  programs");
for (const [name, r] of rows) {
  console.log(
    `${name.padEnd(26)}${String(r.renders).padStart(7)}${r.p50.toFixed(1).padStart(8)}${r.p95.toFixed(1).padStart(8)}${r.worst.toFixed(0).padStart(7)}${String(r.long).padStart(6)}${String(r.calls).padStart(7)}${String(r.triangles).padStart(9)}${String(r.textures).padStart(6)}${String(r.geometries).padStart(5)}${String(r.programs).padStart(10)}`,
  );
}
await browser.close();
