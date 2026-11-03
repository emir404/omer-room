import { expect, test } from "@playwright/test";
import { sceneReady } from "./helpers";

const SECTIONS = ["Work", "School & projects", "Economics Olympiad", "Model UN", "Side quests", "Books I've read", "Places I've been", "Where I'm from", "The OpenAI letter", "Say hi"];

test("JavaScript off: the whole site is readable as text and nothing 3D is requested", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/shelf");
  const text = page.getByTestId("text-view");
  await expect(text).toBeVisible();
  await expect(text.getByRole("heading", { level: 2, name: "School & projects" })).toBeVisible();
  expect(requests.filter((u) => u.includes("/3d/"))).toEqual([]);
  await context.close();
});

test("the text version has every section, and rows open to the story", async ({ page }) => {
  await page.goto("/text");
  const text = page.getByTestId("text-view");
  for (const name of SECTIONS) {
    await expect(text.getByRole("heading", { level: 2, name })).toBeVisible();
  }
  const arc = text.locator("details#arc-studio");
  await arc.locator("summary").click();
  await expect(arc).toHaveAttribute("open", "");
  await expect(arc.getByText("$40K+/mo").first()).toBeVisible();
});

test("/map still finds the text version", async ({ page }) => {
  await page.goto("/map");
  await expect(page).toHaveURL(/\/text$/);
});

test("losing the WebGL context falls back to the text layout", async ({ page }) => {
  await page.goto("/window?test=1");
  await sceneReady(page);
  await page.evaluate(() => {
    const canvas = document.querySelector("canvas")!;
    (canvas.getContext("webgl2") as WebGL2RenderingContext).getExtension("WEBGL_lose_context")!.loseContext();
  });
  await expect(page.locator("html")).toHaveAttribute("data-mode", "doc");
  await expect(page.getByTestId("text-view")).toBeVisible();
});
