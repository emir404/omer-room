import { expect, test } from "@playwright/test";
import { sceneReady } from "./helpers";

test("JavaScript off: chapters are readable and nothing 3D is requested", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/shelf");
  await expect(page.getByTestId("chapter-shelf")).toBeVisible();
  await expect(page.locator(".docnav")).toBeVisible();
  expect(requests.filter((u) => u.includes("/3d/"))).toEqual([]);
  await context.close();
});

test("the text version lists every chapter", async ({ page }) => {
  await page.goto("/map");
  const map = page.getByTestId("text-map");
  for (const name of ["Bookshelf", "Computer", "Phone", "Globe", "Window", "framed letter", "Mailbox"]) {
    await expect(map.getByRole("heading", { level: 2, name: new RegExp(name) })).toBeVisible();
  }
});

test("losing the WebGL context falls back to the text layout", async ({ page }) => {
  await page.goto("/window?test=1");
  await sceneReady(page);
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    (canvas.getContext("webgl2") as WebGL2RenderingContext).getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.locator("html")).toHaveAttribute("data-mode", "doc");
  await expect(page.getByTestId("chapter-window")).toBeVisible();
  await expect(page.locator(".docnav")).toBeVisible();
});
