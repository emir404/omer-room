import type { SceneScreenApp } from "../content/scene-data";
import { iconOf } from "../icons";
import { drawPixelText, mixHex, textBitmap } from "./canvas";

/**
 * Idle pictures for the two screens (what you see from across the room). When the camera arrives,
 * the real DOM UI takes over (components/screens). Both are drawn at low resolution and shown with
 * nearest filtering: the "slightly pixelated" screen from the brief.
 */



export const OS_W = 192;
export const OS_H = 144;

let wallpaper: HTMLCanvasElement | null = null;

/** Warm dusk gradient with an ordered dither, drawn once and reused every frame. */
function osWallpaper(): HTMLCanvasElement {
  if (wallpaper) return wallpaper;
  wallpaper = document.createElement("canvas");
  wallpaper.width = OS_W;
  wallpaper.height = OS_H;
  const w = wallpaper.getContext("2d")!;
  for (let y = 0; y < OS_H; y++) {
    for (let x = 0; x < OS_W; x++) {
      const k = y / OS_H + ((x + y) % 2) * 0.012;
      w.fillStyle = mixHex("#1D3557", "#E07A4F", Math.min(1, k * 0.9));
      w.fillRect(x, y, 1, 1);
    }
  }
  return wallpaper;
}

export function drawOSIdle(ctx: CanvasRenderingContext2D, apps: SceneScreenApp[], name: string, t: number, night: number) {
  ctx.drawImage(osWallpaper(), 0, 0);
  // sun stripes (retro)
  ctx.fillStyle = "rgba(255,214,120,0.85)";
  for (let i = 0; i < 5; i++) ctx.fillRect(132, 70 + i * 6, 40, 3 - (i > 2 ? 1 : 0));
  // menu bar
  ctx.fillStyle = "#F4EEE3";
  ctx.fillRect(0, 0, OS_W, 11);
  ctx.fillStyle = "#1E1B16";
  ctx.fillRect(0, 11, OS_W, 1);
  drawPixelText(ctx, "ÖmerOS", 4, 1, 9, "#1E1B16");
  const now = new Date();
  const clock = `${String(now.getHours()).padStart(2, "0")}${Math.floor(t) % 2 ? ":" : " "}${String(now.getMinutes()).padStart(2, "0")}`;
  drawPixelText(ctx, clock, OS_W - 26, 1, 9, "#1E1B16");

  // desktop icons
  apps.slice(0, 6).forEach((app, i) => {
    const x = 10 + (i % 3) * 40;
    const y = 20 + Math.floor(i / 3) * 40;
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fillRect(x + 6, y + 2, 20, 16);
    ctx.fillStyle = iconOf(app.icon).color;
    ctx.fillRect(x + 5, y, 20, 16);
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.fillRect(x + 5, y, 20, 2);
    const label = app.title.length > 9 ? `${app.title.slice(0, 8)}…` : app.title;
    const w = textBitmap(label, 8).width;
    ctx.fillStyle = "rgba(20,18,15,0.55)";
    ctx.fillRect(x + 15 - w / 2 - 1, y + 19, w + 2, 10);
    drawPixelText(ctx, label, x + 15, y + 19, 8, "#F4EEE3", { align: "center" });
  });

  // name + blinking prompt
  drawPixelText(ctx, name, 10, OS_H - 30, 9, "#F4EEE3");
  if (Math.floor(t * 2) % 2 === 0) drawPixelText(ctx, "> click to open", 10, OS_H - 18, 8, "#FFD36B");

  // night: a touch dimmer
  if (night > 0) {
    ctx.fillStyle = `rgba(5,8,20,${night * 0.25})`;
    ctx.fillRect(0, 0, OS_W, OS_H);
  }
}

export const PHONE_W = 72;
export const PHONE_H = 148;

export function drawPhoneIdle(ctx: CanvasRenderingContext2D, apps: SceneScreenApp[], t: number) {
  const g = ctx.createLinearGradient(0, 0, 0, PHONE_H);
  g.addColorStop(0, "#2B3A67");
  g.addColorStop(1, "#C06C84");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PHONE_W, PHONE_H);
  // status bar
  const now = new Date();
  drawPixelText(ctx, `${now.getHours()}:${String(now.getMinutes()).padStart(2, "0")}`, 5, 3, 7, "#FFFFFF");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(PHONE_W - 14, 5, 9, 4);
  ctx.fillRect(PHONE_W - 5, 6, 1, 2);
  // app grid
  apps.slice(0, 8).forEach((app, i) => {
    const x = 7 + (i % 3) * 21;
    const y = 18 + Math.floor(i / 3) * 24;
    ctx.fillStyle = iconOf(app.icon).color;
    ctx.fillRect(x, y, 16, 16);
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.fillRect(x, y, 16, 2);
  });
  // dock
  ctx.fillStyle = "rgba(255,255,255,0.22)";
  ctx.fillRect(4, PHONE_H - 24, PHONE_W - 8, 20);
  const pulse = Math.floor(t * 1.5) % 2 === 0;
  ctx.fillStyle = pulse ? "#FFFFFF" : "rgba(255,255,255,0.6)";
  ctx.fillRect(PHONE_W / 2 - 10, PHONE_H - 4, 20, 2);
}

export const TICKER_W = 192;
export const TICKER_H = 32;

/** LED dot-matrix ticker: amber dots on black, scrolling the "now" line. */
export function drawTicker(ctx: CanvasRenderingContext2D, text: string, t: number, night: number) {
  ctx.fillStyle = "#0E0C0A";
  ctx.fillRect(0, 0, TICKER_W, TICKER_H);
  const message = `NOW: ${text.replace(/TODO\(Ömer\):?/g, "…")}   ✦   `;
  const bmp = textBitmap(message, 9);
  const dot = 2; // each LED is 2×2 px with a 1px gap → 3px pitch
  const pitch = 3;
  const cols = Math.floor(TICKER_W / pitch);
  const rows = Math.floor(TICKER_H / pitch);
  const offset = Math.floor(t * 14) % bmp.width;
  const yOffset = Math.floor((rows - bmp.height) / 2);
  const lit = mixHex("#FFB347", "#FFC46B", night);
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const sx = (c + offset) % bmp.width;
      const sy = r - yOffset;
      const on = sy >= 0 && sy < bmp.height && bmp.on[sy * bmp.width + sx];
      ctx.fillStyle = on ? lit : "#2A1E12";
      ctx.fillRect(c * pitch, r * pitch, dot, dot);
    }
  }
}

export const LETTER_W = 248;
export const LETTER_H = 336;

/** Until the real letter image is added: an abstract letter (no invented text). */
export function drawLetterPlaceholder(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#FBF8F1";
  ctx.fillRect(0, 0, LETTER_W, LETTER_H);
  ctx.fillStyle = "#1E1B16";
  ctx.fillRect(24, 28, 70, 10);
  ctx.fillStyle = "#B9B2A6";
  const lines = [0.92, 0.88, 0.95, 0.6, 0, 0.9, 0.93, 0.85, 0.9, 0.5, 0, 0.94, 0.87, 0.7];
  lines.forEach((w, i) => {
    if (w > 0) ctx.fillRect(24, 70 + i * 14, (LETTER_W - 48) * w, 5);
  });
  ctx.strokeStyle = "#2B3A67";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(26, 300);
  ctx.bezierCurveTo(40, 280, 52, 318, 66, 296);
  ctx.bezierCurveTo(76, 284, 84, 310, 98, 298);
  ctx.stroke();
}

export const PHOTO_W = 160;
export const PHOTO_H = 120;

export function drawPhotoPlaceholder(ctx: CanvasRenderingContext2D, seed: number) {
  const hues = ["#5E7B8C", "#8C6A5E", "#6B8C5E"];
  ctx.fillStyle = hues[seed % hues.length]!;
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H * 0.55);
  ctx.fillStyle = "rgba(20,18,15,0.35)";
  for (let i = 0; i < 5; i++) {
    const x = 18 + i * 28;
    ctx.fillRect(x, 58, 16, 18); // heads
    ctx.fillRect(x - 4, 76, 24, 44); // shoulders
  }
  ctx.fillStyle = "#FBF8F1";
  ctx.fillRect(0, PHOTO_H - 14, PHOTO_W, 14);
  drawPixelText(ctx, "add MUN photos", PHOTO_W / 2, PHOTO_H - 13, 9, "#1E1B16", { align: "center" });
}
