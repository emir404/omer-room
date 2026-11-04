import { canvasTexture, fontFamily, makeCanvas, mixHex } from "./canvas";
import type { SpineAtlas } from "./spines";

/**
 * Printed things on the shelf, drawn from content at runtime: the section name plates under each
 * shelf, the research paper's title page and the certificate in its frame (until there's a photo).
 */

/** Engraved brass plates, one cell per section (slot__label__NN, about 9 × 2 cm). */
export const PLATE_W = 512;
export const PLATE_H = 112;

export function drawPlateAtlas(labels: string[]): SpineAtlas {
  const n = Math.max(1, labels.length);
  const { canvas, ctx } = makeCanvas(PLATE_W, PLATE_H * n);
  ctx.imageSmoothingEnabled = true;
  const sans = fontFamily("--font-sans");
  labels.forEach((label, i) => {
    const y = i * PLATE_H;
    // brushed brass: a warm vertical gradient with fine horizontal grain
    const g = ctx.createLinearGradient(0, y, 0, y + PLATE_H);
    g.addColorStop(0, "#E2C27A");
    g.addColorStop(0.45, "#C9A158");
    g.addColorStop(1, "#9E7A3C");
    ctx.fillStyle = g;
    ctx.fillRect(0, y, PLATE_W, PLATE_H);
    for (let k = 0; k < PLATE_H; k += 2) {
      ctx.fillStyle = `rgba(255,255,255,${0.025 + ((k * 13) % 7) * 0.006})`;
      ctx.fillRect(0, y + k, PLATE_W, 1);
    }
    // bevel
    ctx.strokeStyle = "rgba(255,240,200,0.55)";
    ctx.lineWidth = 3;
    ctx.strokeRect(4, y + 4, PLATE_W - 8, PLATE_H - 8);
    ctx.strokeStyle = "rgba(80,55,20,0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(9, y + 9, PLATE_W - 18, PLATE_H - 18);
    // engraved letters: dark fill, a light lip under each stroke
    const text = label.toUpperCase();
    let size = 54;
    ctx.font = `650 ${size}px ${sans}`;
    const spacing = 0.16;
    const width = (s: number) => {
      ctx.font = `650 ${s}px ${sans}`;
      return ctx.measureText(text).width + s * spacing * (text.length - 1);
    };
    while (width(size) > PLATE_W - 80 && size > 22) size -= 2;
    ctx.font = `650 ${size}px ${sans}`;
    ctx.textBaseline = "middle";
    let x = (PLATE_W - width(size)) / 2;
    for (const ch of text) {
      ctx.fillStyle = "rgba(255,236,190,0.6)";
      ctx.fillText(ch, x, y + PLATE_H / 2 + 2);
      ctx.fillStyle = "#3B2A12";
      ctx.fillText(ch, x, y + PLATE_H / 2);
      x += ctx.measureText(ch).width + size * spacing;
    }
    // two screws
    for (const sx of [26, PLATE_W - 26]) {
      ctx.beginPath();
      ctx.arc(sx, y + PLATE_H / 2, 7, 0, Math.PI * 2);
      ctx.fillStyle = "#8C6A33";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,240,200,0.6)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(sx - 5, y + PLATE_H / 2 + 3);
      ctx.lineTo(sx + 5, y + PLATE_H / 2 - 3);
      ctx.strokeStyle = "#4A3517";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  });
  return {
    texture: canvasTexture(canvas, false),
    cell: (index) => ({ u0: 0, v0: (index * PLATE_H) / (PLATE_H * n), u1: 1, v1: ((index + 1) * PLATE_H) / (PLATE_H * n) }),
  };
}

/** A research paper's title page (A4 portrait). */
export const PAGE_W = 620;
export const PAGE_H = 877;

export function drawTitlePage(ctx: CanvasRenderingContext2D, page: { title: string; byline: string; note: string; date: string }) {
  const serif = `"Iowan Old Style", "Palatino Linotype", Georgia, serif`;
  const sans = fontFamily("--font-sans");
  ctx.fillStyle = "#FBF9F4";
  ctx.fillRect(0, 0, PAGE_W, PAGE_H);
  // the paper's faint tooth
  for (let k = 0; k < 900; k++) {
    const x = (k * 97) % PAGE_W;
    const y = (k * 61) % PAGE_H;
    ctx.fillStyle = `rgba(120,100,70,${0.025 + (k % 5) * 0.004})`;
    ctx.fillRect(x, y, 1.4, 1.4);
  }
  ctx.textAlign = "center";
  ctx.fillStyle = "#6B665C";
  ctx.font = `500 17px ${sans}`;
  ctx.fillText("WORKING PAPER", PAGE_W / 2, 150);
  ctx.fillStyle = "#1E1C18";
  // wrap the title onto up to four lines
  let size = 40;
  const words = page.title.split(/\s+/);
  const lines = (s: number) => {
    ctx.font = `600 ${s}px ${serif}`;
    const out: string[] = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > PAGE_W - 120 && line) {
        out.push(line);
        line = w;
      } else line = next;
    }
    if (line) out.push(line);
    return out;
  };
  let wrapped = lines(size);
  while (wrapped.length > 4 && size > 26) wrapped = lines((size -= 2));
  wrapped.forEach((line, i) => ctx.fillText(line, PAGE_W / 2, 240 + i * size * 1.22));
  const after = 240 + wrapped.length * size * 1.22 + 36;
  ctx.fillStyle = mixHex("#1E1C18", "#FBF9F4", 0.25);
  ctx.fillRect(PAGE_W / 2 - 40, after, 80, 2);
  ctx.fillStyle = "#2E2B26";
  ctx.font = `500 22px ${serif}`;
  ctx.fillText(page.byline, PAGE_W / 2, after + 52);
  ctx.fillStyle = "#6B665C";
  ctx.font = `400 17px ${serif}`;
  ctx.fillText(page.note, PAGE_W / 2, after + 84);
  // an abstract, set as placeholder lines
  ctx.fillStyle = "rgba(60,55,45,0.18)";
  const abstract = [0.86, 0.9, 0.82, 0.88, 0.6];
  abstract.forEach((w, i) => ctx.fillRect((PAGE_W - (PAGE_W - 160) * w) / 2, after + 150 + i * 22, (PAGE_W - 160) * w, 7));
  ctx.fillStyle = "#6B665C";
  ctx.font = `400 16px ${sans}`;
  ctx.fillText(page.date, PAGE_W / 2, PAGE_H - 90);
}

/** A framed certificate, until its photo is added: cream paper, a border, a seal, placeholder lines. */
export const CERT_W = 480;
export const CERT_H = 340;

export function drawCertificate(ctx: CanvasRenderingContext2D, name: string) {
  ctx.fillStyle = "#F8F3E6";
  ctx.fillRect(0, 0, CERT_W, CERT_H);
  ctx.strokeStyle = "#B89A5E";
  ctx.lineWidth = 6;
  ctx.strokeRect(14, 14, CERT_W - 28, CERT_H - 28);
  ctx.lineWidth = 1.5;
  ctx.strokeRect(24, 24, CERT_W - 48, CERT_H - 48);
  const serif = `"Iowan Old Style", "Palatino Linotype", Georgia, serif`;
  ctx.textAlign = "center";
  ctx.fillStyle = "#3A3326";
  ctx.font = `600 30px ${serif}`;
  ctx.fillText("Certificate", CERT_W / 2, 88);
  ctx.font = `400 18px ${serif}`;
  ctx.fillStyle = "#5C5446";
  ctx.fillText(name, CERT_W / 2, 124);
  ctx.fillStyle = "rgba(60,52,38,0.2)";
  [0.74, 0.86, 0.66].forEach((w, i) => ctx.fillRect((CERT_W - 300 * w) / 2, 158 + i * 20, 300 * w, 6));
  // a seal
  ctx.beginPath();
  ctx.arc(CERT_W / 2, 268, 28, 0, Math.PI * 2);
  ctx.fillStyle = "#B6452F";
  ctx.fill();
  ctx.strokeStyle = "rgba(255,230,200,0.6)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(CERT_W / 2, 268, 20, 0, Math.PI * 2);
  ctx.stroke();
}
