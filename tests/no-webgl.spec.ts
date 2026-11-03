import { expect, test } from "@playwright/test";

// A browser with WebGL switched off entirely.
test.use({ launchOptions: { args: ["--disable-3d-apis"] } });

test("no WebGL: text layout, full content, zero /3d/ requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/window");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "doc");
  await expect(page.getByTestId("chapter-window")).toBeVisible();
  await expect(page.locator(".docnav")).toBeVisible();
  await page.waitForTimeout(800);
  expect(requests.filter((u) => u.includes("/3d/"))).toEqual([]);
});
