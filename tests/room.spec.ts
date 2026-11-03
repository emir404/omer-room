import { expect, test } from "@playwright/test";
import { objectCenter, sceneReady } from "./helpers";

test("overview: the 3D room loads and the loader steps aside", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?test=1");
  await sceneReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "room");
  await expect(page.locator(".loader")).toHaveAttribute("data-done", "1");
  await expect(page.getByTestId("intro")).toBeVisible();
  expect(errors).toEqual([]);
});

const CHAPTERS: [string, string][] = [
  ["/shelf", "chapter-shelf"],
  ["/shelf/economics-olympiad", "chapter-shelf-item"],
  ["/computer", "omer-os"],
  ["/phone", "phone-ui"],
  ["/globe", "chapter-globe"],
  ["/window", "chapter-window"],
  ["/letter", "chapter-letter"],
  ["/contact", "chapter-contact"],
];

for (const [route, testId] of CHAPTERS) {
  test(`deep link ${route} opens its chapter`, async ({ page }) => {
    await page.goto(`${route}?test=1`);
    await sceneReady(page);
    await expect(page.getByTestId(testId)).toBeVisible();
  });
}

test("deep link to a computer app: camera rests on the screen, then the OS appears on it", async ({ page }) => {
  await page.goto("/computer/arc-studio?test=1");
  await sceneReady(page);
  const host = page.locator('[data-kind="screen"]');
  await expect(host).toHaveAttribute("data-rest", "1");
  await expect(page.getByTestId("omer-os").getByRole("heading", { name: "Arc Studio" })).toBeVisible();
});

test("keyboard: focus an object, Enter opens it, Esc comes back to it", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is checked on desktop");
  await page.goto("/?test=1");
  await sceneReady(page);
  // Tab reaches the object buttons
  let reached = false;
  for (let i = 0; i < 12 && !reached; i++) {
    await page.keyboard.press("Tab");
    reached = await page.evaluate(() => document.activeElement?.closest(".pin") !== null);
  }
  expect(reached).toBe(true);

  const shelf = page.getByTestId("pin-shelf");
  await shelf.focus();
  await expect(page.locator(".selection")).toHaveAttribute("data-visible", "1");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/\/shelf(\?|$)/);
  await expect(page.getByTestId("chapter-shelf")).toBeVisible();
  await expect(page.getByTestId("chapter-shelf").getByRole("heading", { level: 1 })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(shelf).toBeFocused();
});

test("back and forward move between chapters", async ({ page }) => {
  await page.goto("/shelf?test=1");
  await sceneReady(page);
  await page.getByTestId("chapter-shelf").getByRole("link", { name: /Economics Olympiad/ }).click();
  await expect(page.getByTestId("chapter-shelf-item")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/shelf(\?|$)/);
  await expect(page.getByTestId("chapter-shelf")).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId("chapter-shelf-item")).toBeVisible();
});

test("pointer: hovering an object shows its label, clicking opens it", async ({ page, isMobile }) => {
  test.skip(isMobile, "no hover on touch");
  await page.goto("/?test=1");
  await sceneReady(page);
  const letter = await objectCenter(page, "letter");
  await page.mouse.move(letter.x, letter.y);
  await expect(page.locator(".selection-label")).toHaveText("you might know me from this");
  await page.mouse.click(letter.x, letter.y);
  await expect(page).toHaveURL(/\/letter$/);
  await expect(page.getByTestId("chapter-letter")).toBeVisible();
});

test("touch: pins are visible and tapping one opens the chapter", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch only");
  await page.goto("/?test=1");
  await sceneReady(page);
  const pin = page.getByTestId("pin-window");
  await expect(pin).toBeVisible();
  await pin.tap();
  await expect(page).toHaveURL(/\/window$/);
  await expect(page.getByTestId("chapter-window")).toBeVisible();
});

test("the basketball takes a shot", async ({ page, isMobile }) => {
  test.skip(isMobile, "pointer click on the ball");
  await page.goto("/?test=1");
  await sceneReady(page);
  const ball = await objectCenter(page, "hoop");
  await page.mouse.click(ball.x, ball.y);
  await expect(page.locator(".toast")).toHaveAttribute("data-visible", "1", { timeout: 5_000 });
});

test("day/night follows ?time and the toggle", async ({ page, isMobile }) => {
  test.skip(isMobile, "same logic on both");
  await page.goto("/?test=1&time=night");
  await sceneReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-time", "night");
  await page.getByTestId("time-toggle").click(); // night → auto
  await page.getByTestId("time-toggle").click(); // auto → day
  await expect(page.locator("html")).toHaveAttribute("data-time", "day");
});
