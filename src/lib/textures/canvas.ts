import { CanvasTexture, LinearFilter, NearestFilter, SRGBColorSpace } from "three";

/** Canvas helpers for the room's live textures. All textures use flipY = false (glTF UVs). */

export function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingEnabled = false;
  return { canvas, ctx };
}

export function canvasTexture(canvas: HTMLCanvasElement, pixelated: boolean): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.magFilter = pixelated ? NearestFilter : LinearFilter;
  texture.minFilter = pixelated ? NearestFilter : LinearFilter;
  texture.generateMipmaps = false;
  texture.anisotropy = pixelated ? 1 : 4;
  return texture;
}

/** CSS custom properties set by next/font on <html> (see app/layout.tsx). */
export function fontFamily(variable: "--font-pixel" | "--font-sans" | "--font-mono"): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(variable).trim();
  return value || (variable === "--font-mono" ? "ui-monospace, monospace" : "system-ui, sans-serif");
}

/**
 * Web fonts only download when something uses them; canvas text doesn't count. Load the pixel and
 * sans faces explicitly before drawing any texture text.
 */
export async function ensureFonts(): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`10px ${fontFamily("--font-pixel")}`, "ÖmerOS 0123"),
      document.fonts.load(`600 24px ${fontFamily("--font-sans")}`, "Book"),
    ]);
  } catch {
    // fall back to whatever is available; textures still draw
  }
  await document.fonts.ready;
}

const bitmapCache = new Map<string, { width: number; height: number; on: Uint8Array }>();

/**
 * Renders text at a small size and thresholds it to hard on/off pixels, so canvas text reads as
 * real pixel art (no anti-aliased mush) on screens and LED displays.
 */
export function textBitmap(text: string, sizePx: number, family = fontFamily("--font-pixel"), weight = 400) {
  const key = `${text}|${sizePx}|${family}|${weight}`;
  const hit = bitmapCache.get(key);
  if (hit) return hit;
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = `${weight} ${sizePx}px ${family}`;
  const width = Math.max(1, Math.ceil(probe.measureText(text).width) + 2);
  const height = Math.ceil(sizePx * 1.3);
  const { ctx } = makeCanvas(width, height);
  ctx.font = probe.font;
  ctx.textBaseline = "top";
  ctx.fillStyle = "#fff";
  ctx.fillText(text, 1, Math.round(sizePx * 0.1));
  const data = ctx.getImageData(0, 0, width, height).data;
  const on = new Uint8Array(width * height);
  for (let i = 0; i < on.length; i++) on[i] = data[i * 4 + 3]! > 110 ? 1 : 0;
  const bitmap = { width, height, on };
  bitmapCache.set(key, bitmap);
  return bitmap;
}

export function drawPixelText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, sizePx: number, color: string, opts: { align?: "left" | "center"; weight?: number } = {}) {
  const bmp = textBitmap(text, sizePx, fontFamily("--font-pixel"), opts.weight ?? 400);
  const left = Math.round(opts.align === "center" ? x - bmp.width / 2 : x);
  ctx.fillStyle = color;
  for (let py = 0; py < bmp.height; py++) {
    for (let px = 0; px < bmp.width; px++) {
      if (bmp.on[py * bmp.width + px]) ctx.fillRect(left + px, Math.round(y) + py, 1, 1);
    }
  }
  return bmp.width;
}

/** Deterministic pseudo-random (stable star fields, foliage). */
export function seeded(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Mixes two #rrggbb colors; returns #rrggbb so calls can be nested. */
export function mixHex(a: string, b: string, t: number): string {
  const pa = Number.parseInt(a.slice(1), 16);
  const pb = Number.parseInt(b.slice(1), 16);
  const k = Math.min(1, Math.max(0, t));
  const ch = (shift: number) => Math.round(((pa >> shift) & 255) * (1 - k) + ((pb >> shift) & 255) * k);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, "0")}`;
}
