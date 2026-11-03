import type { Page } from "@playwright/test";

/** Waits for <html data-scene="ready"> (GLB indexed, shaders compiled, two frames drawn). */
export async function sceneReady(page: Page) {
  await page.waitForSelector('html[data-scene="ready"]', { timeout: 60_000 });
}

/** Screen-space center of an object's click proxy (test-mode hook in Projector.tsx). */
export async function objectCenter(page: Page, id: string) {
  const point = await page.evaluate((objectId) => {
    const hook = (window as unknown as { __roomTest?: { center(id: string): { x: number; y: number } | null } }).__roomTest;
    return hook?.center(objectId) ?? null;
  }, id);
  if (!point) throw new Error(`object "${id}" is not on screen`);
  return point;
}
