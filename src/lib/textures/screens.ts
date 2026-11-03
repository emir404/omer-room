import { mixHex, textBitmap } from "./canvas";

/**
 * Canvas pictures on room surfaces that aren't the live screen UIs (those are DOM, mapped onto the
 * monitor and phone: components/screens): the LED ticker, and placeholders until content arrives.
 */

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

/** Until the real letter image is added (content/letter.md): a page of placeholder lines. */
export function drawLetterPlaceholder(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = "#FBF8F1";
  ctx.fillRect(0, 0, LETTER_W, LETTER_H);
  ctx.fillStyle = "#C9C3B8";
  ctx.fillRect(24, 28, 64, 8);
  ctx.fillStyle = "#DDD8CF";
  const lines = [0.9, 0.84, 0.92, 0.58, 0, 0.88, 0.92, 0.82, 0.9, 0.46, 0, 0.92, 0.86, 0.66, 0, 0.32];
  lines.forEach((w, i) => {
    if (w > 0) ctx.fillRect(24, 64 + i * 14, (LETTER_W - 48) * w, 5);
  });
}

export const PHOTO_W = 160;
export const PHOTO_H = 120;

/** An empty photo frame (until MUN photos are added): a soft, quiet gradient. */
export function drawPhotoPlaceholder(ctx: CanvasRenderingContext2D, seed: number) {
  const tones = [
    ["#C9D3D8", "#9FB0B8"],
    ["#D8CFC6", "#B5A595"],
    ["#CFD6C7", "#A7B39A"],
  ][seed % 3]!;
  const g = ctx.createLinearGradient(0, 0, 0, PHOTO_H);
  g.addColorStop(0, tones[0]!);
  g.addColorStop(1, tones[1]!);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, PHOTO_W, PHOTO_H);
}
