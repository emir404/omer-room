import { expect, type Page, test } from "@playwright/test";

/** Sum of compressed JS bytes the page downloads. */
async function jsBytes(page: Page, url: string, settle: () => Promise<unknown>) {
  const scripts: Promise<number>[] = [];
  page.on("requestfinished", (request) => {
    if (request.resourceType() === "script") scripts.push(request.sizes().then((s) => s.responseBodySize));
  });
  await page.goto(url);
  await settle();
  return (await Promise.all(scripts)).reduce((a, b) => a + b, 0);
}

// Next 16 + React 19 alone are ≈140 KB gzipped; our own client code is ≈10 KB on top. Anything
// that pulls three/drei (or a big UI lib) into the DOM layer blows this budget — keep 3D imports
// inside src/components/room/RoomCanvas.tsx's lazy chunk.
const CRITICAL_JS_BUDGET = 160 * 1024;

test("critical-path JS (everything but the 3D chunk) stays within budget", async ({ page, isMobile }) => {
  test.skip(isMobile, "measured once");
  // ?text=1 renders the same pages without ever requesting the 3D chunk
  const bytes = await jsBytes(page, "/?text=1", () => page.waitForLoadState("networkidle"));
  console.log(`critical JS: ${(bytes / 1024).toFixed(1)} KB`);
  expect(bytes).toBeLessThan(CRITICAL_JS_BUDGET);
});

test("3D chunk is lazy and the whole room stays within budget", async ({ page, isMobile }) => {
  test.skip(isMobile, "measured once");
  const bytes = await jsBytes(page, "/?test=1", () => page.waitForSelector('html[data-scene="ready"]', { timeout: 60_000 }));
  console.log(`total JS with the room: ${(bytes / 1024).toFixed(1)} KB`);
  expect(bytes).toBeLessThan(600 * 1024);
});
