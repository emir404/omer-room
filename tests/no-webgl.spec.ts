import { expect, test } from "@playwright/test";

// A browser with WebGL switched off entirely.
test.use({ launchOptions: { args: ["--disable-3d-apis"] } });

test("no WebGL: the text layout, full content, the 3D switch disabled, zero /3d/ requests", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (r) => requests.push(r.url()));
  await page.goto("/window");
  await expect(page.locator("html")).toHaveAttribute("data-mode", "doc");
  const text = page.getByTestId("text-view");
  await expect(text).toBeVisible();
  await expect(text.getByRole("heading", { level: 2, name: "Where I'm from" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "View" }).getByText("3D")).toHaveAttribute("aria-disabled", "true");
  await page.waitForTimeout(800);
  expect(requests.filter((u) => u.includes("/3d/"))).toEqual([]);
});
