import type { CanvasTexture } from "three";
import type { SceneBook } from "../content/scene-data";
import { canvasTexture, fontFamily, makeCanvas, mixHex } from "./canvas";

/**
 * One atlas for every book spine on the shelf. Each slot gets a 128×512 cell; the slot mesh's
 * spine face spans the whole cell and its other faces collapse onto the cell's top-left corner
 * (painted with the cover color). Empty slots get a generic, title-less spine.
 */
export const CELL_W = 128;
export const CELL_H = 512;
const COLS = 8;

export interface SpineAtlas {
  texture: CanvasTexture;
  /** UV rect (glTF convention, v down) of a slot's cell. */
  cell(index: number): { u0: number; v0: number; u1: number; v1: number };
}

const GENERIC = ["#6E5A47", "#4F5B53", "#7B6A55", "#5C4B5E", "#56606B"];

export function drawSpineAtlas(slots: (SceneBook | null)[]): SpineAtlas {
  const rows = Math.ceil(slots.length / COLS);
  const { canvas, ctx } = makeCanvas(CELL_W * COLS, CELL_H * rows);
  ctx.imageSmoothingEnabled = true;
  const serif = `"Iowan Old Style", "Palatino Linotype", Georgia, serif`;
  const sans = fontFamily("--font-sans");

  slots.forEach((book, i) => {
    const x = (i % COLS) * CELL_W;
    const y = Math.floor(i / COLS) * CELL_H;
    const base = book?.color ?? GENERIC[i % GENERIC.length]!;
    const ink = book?.text ?? "#E9E1D2";

    // cloth texture: base + subtle vertical grain
    ctx.fillStyle = base;
    ctx.fillRect(x, y, CELL_W, CELL_H);
    for (let gx = 0; gx < CELL_W; gx += 3) {
      ctx.fillStyle = `rgba(0,0,0,${0.03 + ((gx * 7) % 5) * 0.008})`;
      ctx.fillRect(x + gx, y, 1, CELL_H);
    }
    // rounded-spine shading
    const shade = ctx.createLinearGradient(x, 0, x + CELL_W, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.28)");
    shade.addColorStop(0.18, "rgba(255,255,255,0.08)");
    shade.addColorStop(0.55, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.32)");
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, CELL_W, CELL_H);
    // head/tail bands
    ctx.fillStyle = mixHex(base, "#000000", 0.35);
    ctx.fillRect(x, y + 26, CELL_W, 10);
    ctx.fillRect(x, y + CELL_H - 44, CELL_W, 10);
    ctx.fillStyle = "rgba(230,200,120,0.55)";
    ctx.fillRect(x, y + 38, CELL_W, 3);
    ctx.fillRect(x, y + CELL_H - 32, CELL_W, 3);

    if (book) {
      ctx.save();
      ctx.translate(x + CELL_W / 2, y + 64);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = ink;
      ctx.textBaseline = "middle";
      const title = book.title.replace(/^TODO:?\s*/i, "") || "untitled";
      let size = 46;
      ctx.font = `600 ${size}px ${serif}`;
      while (ctx.measureText(title).width > CELL_H - 190 && size > 22) {
        size -= 2;
        ctx.font = `600 ${size}px ${serif}`;
      }
      ctx.fillText(title, 0, 0);
      ctx.font = `500 24px ${sans}`;
      ctx.globalAlpha = 0.75;
      ctx.fillText(book.author.replace(/^TODO(\(Ömer\))?:?\s*/i, ""), CELL_H - 170, 0);
      ctx.restore();
    }

    // cover color for the collapsed faces (top-left corner of the cell)
    ctx.fillStyle = mixHex(base, "#000000", 0.15);
    ctx.fillRect(x, y, 6, 6);
  });

  const cols = COLS * CELL_W;
  const height = rows * CELL_H;
  return {
    texture: canvasTexture(canvas, false),
    cell: (index) => {
      const cx = (index % COLS) * CELL_W;
      const cy = Math.floor(index / COLS) * CELL_H;
      return { u0: cx / cols, v0: cy / height, u1: (cx + CELL_W) / cols, v1: (cy + CELL_H) / height };
    },
  };
}

/** Binder spines: a colored plastic spine, a paper label window with the chapter's name, a ring. */
export const BINDER_W = 192;
export const BINDER_H = 800;

export function drawBinderAtlas(binders: { label: string; color: string }[]): SpineAtlas {
  const n = Math.max(1, binders.length);
  const { canvas, ctx } = makeCanvas(BINDER_W * n, BINDER_H);
  ctx.imageSmoothingEnabled = true;
  const sans = fontFamily("--font-sans");
  binders.forEach(({ label, color }, i) => {
    const x = i * BINDER_W;
    ctx.fillStyle = color;
    ctx.fillRect(x, 0, BINDER_W, BINDER_H);
    // the spine's round: darker edges, a soft highlight
    const shade = ctx.createLinearGradient(x, 0, x + BINDER_W, 0);
    shade.addColorStop(0, "rgba(0,0,0,0.22)");
    shade.addColorStop(0.2, "rgba(255,255,255,0.07)");
    shade.addColorStop(0.6, "rgba(0,0,0,0)");
    shade.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = shade;
    ctx.fillRect(x, 0, BINDER_W, BINDER_H);
    // label window: paper under a clear sleeve
    const lx = x + 26;
    const lw = BINDER_W - 52;
    const ly = 92;
    const lh = 470;
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(lx - 4, ly - 4, lw + 8, lh + 8);
    ctx.fillStyle = "#F7F4EC";
    ctx.fillRect(lx, ly, lw, lh);
    ctx.save();
    ctx.translate(lx + lw / 2, ly + lh / 2);
    ctx.rotate(Math.PI / 2);
    ctx.fillStyle = "#1D1D1F";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    let size = 92;
    ctx.font = `650 ${size}px ${sans}`;
    while (ctx.measureText(label).width > lh - 56 && size > 40) {
      size -= 2;
      ctx.font = `650 ${size}px ${sans}`;
    }
    ctx.fillText(label, 0, 4);
    ctx.restore();
    // sleeve glare
    const glare = ctx.createLinearGradient(lx, ly, lx + lw, ly + lh);
    glare.addColorStop(0, "rgba(255,255,255,0.16)");
    glare.addColorStop(0.45, "rgba(255,255,255,0)");
    ctx.fillStyle = glare;
    ctx.fillRect(lx, ly, lw, lh);
    // finger hole
    ctx.beginPath();
    ctx.arc(x + BINDER_W / 2, 680, 30, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = mixHex(color, "#000000", 0.35);
    ctx.stroke();
  });
  return {
    texture: canvasTexture(canvas, false),
    cell: (index) => ({ u0: (index * BINDER_W) / (BINDER_W * n), v0: 0, u1: ((index + 1) * BINDER_W) / (BINDER_W * n), v1: 1 }),
  };
}

/** A spine color from a cover: its average, a touch deeper (spines read darker than covers). */
export function coverColor(image: HTMLImageElement): string {
  const { canvas, ctx } = makeCanvas(24, 36);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, 24, 36);
  const data = ctx.getImageData(0, 0, 24, 36).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < data.length; i += 4) {
    r += data[i]!;
    g += data[i + 1]!;
    b += data[i + 2]!;
  }
  const n = data.length / 4;
  const hex = (v: number) => Math.round(v / n * 0.86).toString(16).padStart(2, "0");
  void canvas;
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}
