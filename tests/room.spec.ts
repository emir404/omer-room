import { expect, test } from "@playwright/test";
import { holding, objectCenter, sceneReady } from "./helpers";

test("overview: the 3D room loads, the loader steps aside, the switch is the only UI", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/?test=1");
  await sceneReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-mode", "room");
  await expect(page.locator(".loader")).toHaveAttribute("data-done", "1");
  await expect(page.getByTestId("intro")).toBeAttached();
  await expect(page.getByRole("navigation", { name: "View" })).toBeVisible();
  await expect(page.locator(".topbar")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("the computer and phone screens are live in the room", async ({ page }) => {
  await page.goto("/?test=1");
  await sceneReady(page);
  const computer = page.locator('.screen[data-screen="computer"]');
  const phone = page.locator('.screen[data-screen="phone"]');
  await expect(computer).toHaveCSS("visibility", "visible");
  await expect(phone).toHaveCSS("visibility", "visible");
  await expect(computer.getByTestId("omer-os")).toContainText("Arc Studio");
  // not interactive until you go to them
  await expect(computer).toHaveAttribute("data-docked", "0");
});

// no side panels: a chapter is its object, lit in the dimmed room, with its caption beside it
const CHAPTERS: [string, string][] = [
  ["/shelf", "caption-shelf"],
  ["/shelf/school", "caption-section"],
  ["/shelf/economics-olympiad", "caption-item"],
  ["/shelf/zero-to-one", "caption-book"],
  ["/phone", "phone-ui"],
  ["/globe", "caption-globe"],
  ["/globe/kozan", "caption-place"],
  ["/window", "caption-window"],
  ["/letter", "caption-letter"],
  ["/contact", "caption-contact"],
];

for (const [route, testId] of CHAPTERS) {
  test(`deep link ${route} opens its chapter`, async ({ page }) => {
    await page.goto(`${route}?test=1`);
    await sceneReady(page);
    await expect(page.getByTestId(testId)).toBeVisible();
  });
}

test("no side panels anywhere", async ({ page }) => {
  await page.goto("/window?test=1");
  await sceneReady(page);
  await expect(page.locator(".chapter-host, .sheet")).toHaveCount(0);
  await expect(page.locator(".cap-live")).toHaveAttribute("data-shown", "1");
});

test("a book comes off the shelf into your hand; clicking outside puts it back", async ({ page, isMobile }) => {
  await page.goto("/shelf/zero-to-one?test=1");
  await sceneReady(page);
  await expect.poll(() => holding(page)).toMatch(/^book_\d\d$/);
  await expect(page.getByTestId("caption-book").getByRole("heading", { level: 1, name: "Zero to One" })).toBeVisible();
  // next along the shelf: another book in your hand
  await page.getByTestId("caption-book").getByRole("link", { name: /Why Nations Fail/ }).click();
  await expect(page).toHaveURL(/\/shelf\/why-nations-fail$/);
  await expect(page.getByTestId("caption-book").getByRole("heading", { level: 1, name: "Why Nations Fail" })).toBeVisible();
  // a click (tap) in the room, away from the book, puts it back on its shelf
  const viewport = page.viewportSize()!;
  if (isMobile) await page.touchscreen.tap(24, viewport.height * 0.1 + 60);
  else await page.mouse.click(40, viewport.height - 40);
  await expect(page).toHaveURL(/\/shelf\/books$/);
  await expect.poll(() => holding(page)).toBeNull();
});

test("Esc puts what you're holding back, then steps out shelf by shelf", async ({ page, isMobile }) => {
  test.skip(isMobile, "keyboard flow is checked on desktop");
  await page.goto("/shelf/economics-olympiad?test=1");
  await sceneReady(page);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/shelf\/olympiad$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/shelf$/);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
});

test("deep link to a computer app: the desktop docks on the monitor (desktop) or fills the screen (phone)", async ({ page, isMobile }) => {
  await page.goto("/computer/arc-studio?test=1");
  await sceneReady(page);
  const screen = page.locator('.screen[data-screen="computer"]');
  if (isMobile) {
    await expect(screen).toHaveAttribute("data-docked", "1");
    await expect(screen).toHaveAttribute("data-full", "1");
    await expect(screen.getByTestId("omer-os")).toContainText("Arc Studio");
    return;
  }
  await expect(screen).toHaveAttribute("data-docked", "1");
  await expect(screen.locator(".ss-window__heading")).toHaveText("Arc Studio");
  // the sidebar switches apps in place, and the red light steps back into the room
  await screen.getByRole("link", { name: "e2vc" }).click();
  await expect(page).toHaveURL(/\/computer\/e2vc$/);
  await expect(screen.locator(".ss-window__heading")).toHaveText("e2vc");
  await screen.getByRole("link", { name: /Close, step back/ }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(screen).toHaveAttribute("data-docked", "0");
});

test("the phone opens from the room and its apps open on it", async ({ page, isMobile }) => {
  await page.goto("/?test=1");
  await sceneReady(page);
  if (isMobile) {
    await page.getByTestId("pin-phone").tap();
  } else {
    // the computer's click proxy used to swallow the phone next to it
    const phone = await objectCenter(page, "phone");
    await page.mouse.click(phone.x, phone.y);
  }
  await expect(page).toHaveURL(/\/phone$/);
  const screen = page.locator('.screen[data-screen="phone"]');
  await expect(screen).toHaveAttribute("data-docked", "1");
  await screen.getByRole("link", { name: /Bana Paradan Bahset/ }).click();
  await expect(page).toHaveURL(/\/phone\/talk-to-me-about-money$/);
  await expect(screen.getByRole("heading", { level: 2, name: "Bana Paradan Bahset" })).toBeVisible();
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
  await expect(page.getByTestId("caption-shelf")).toBeVisible();
  await expect(page.getByTestId("caption-shelf").getByRole("heading", { level: 1 })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/$/);
  await expect(shelf).toBeFocused();
});

test("back and forward move between chapters", async ({ page }) => {
  await page.goto("/shelf?test=1");
  await sceneReady(page);
  await page.getByTestId("caption-shelf").getByRole("link", { name: /Economics Olympiad/ }).click();
  await expect(page.getByTestId("caption-section")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/shelf(\?|$)/);
  await expect(page.getByTestId("caption-shelf")).toBeVisible();
  await page.goForward();
  await expect(page.getByTestId("caption-section")).toBeVisible();
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
  await expect(page.getByTestId("caption-letter")).toBeVisible();
});

test("touch: pins are visible and tapping one opens the chapter", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch only");
  await page.goto("/?test=1");
  await sceneReady(page);
  const pin = page.getByTestId("pin-window");
  await expect(pin).toBeVisible();
  await pin.tap();
  await expect(page).toHaveURL(/\/window$/);
  await expect(page.getByTestId("caption-window")).toBeVisible();
});

test("the basketball takes a shot", async ({ page, isMobile }) => {
  test.skip(isMobile, "pointer click on the ball");
  await page.goto("/?test=1");
  await sceneReady(page);
  const ball = await objectCenter(page, "hoop");
  await page.mouse.click(ball.x, ball.y);
  await expect(page.locator(".toast")).toHaveAttribute("data-visible", "1", { timeout: 5_000 });
});

test("day/night follows ?time", async ({ page, isMobile }) => {
  test.skip(isMobile, "same logic on both");
  await page.goto("/?test=1&time=night");
  await sceneReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-time", "night");
  await page.goto("/?test=1&time=day");
  await sceneReady(page);
  await expect(page.locator("html")).toHaveAttribute("data-time", "day");
});

test("the switch goes to the text version and back to the room", async ({ page }) => {
  await page.goto("/letter?test=1");
  await sceneReady(page);
  await page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "Text" }).click();
  await expect(page).toHaveURL(/\/text#letter$/);
  await expect(page.getByTestId("text-view")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("data-mode", "doc");
  await page.getByRole("navigation", { name: "View" }).getByRole("link", { name: "3D" }).click();
  await expect(page).toHaveURL(/\/$/);
  await sceneReady(page);
});
