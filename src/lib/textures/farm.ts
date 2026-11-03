import { mixHex, seeded } from "./canvas";

/**
 * The view out of the window: a pixel-art Kozan farm (Taurus foothills, the castle on its hill,
 * orange orchards, solar arrays, a barn, animals). Drawn at 160×120 and shown with nearest
 * filtering. `t` is in seconds; the room redraws it at a stepped ~12 fps.
 * Phase 2 swaps this for a tiny 3D diorama rendered into a low-res target (same look, real depth).
 */
export const FARM_W = 160;
export const FARM_H = 120;

const stars = (() => {
  const rnd = seeded(7);
  return Array.from({ length: 46 }, () => ({ x: Math.floor(rnd() * FARM_W), y: Math.floor(rnd() * 46), p: rnd() * 6 }));
})();

const flies = (() => {
  const rnd = seeded(11);
  return Array.from({ length: 10 }, () => ({ x: rnd() * FARM_W, y: 78 + rnd() * 34, p: rnd() * 6 }));
})();

function ridge(ctx: CanvasRenderingContext2D, color: string, base: number, amp: number, freq: number, phase: number) {
  ctx.fillStyle = color;
  for (let x = 0; x < FARM_W; x++) {
    const h = Math.round(base - amp * (0.55 * Math.sin(x * freq + phase) + 0.3 * Math.sin(x * freq * 2.3 + phase * 1.7) + 0.15 * Math.sin(x * freq * 5.1)));
    ctx.fillRect(x, h, 1, FARM_H - h);
  }
}

export function drawFarm(ctx: CanvasRenderingContext2D, t: number, night: number) {
  const n = Math.min(1, Math.max(0, night));
  const dusk = 1 - Math.abs(n - 0.5) * 2; // peaks mid-transition

  // sky
  const top = mixHex(mixHex("#6FB7E0", "#0B1430", n), "#F08A4B", dusk * 0.25);
  const bottom = mixHex(mixHex("#CDEBF5", "#24345F", n), "#F7C27A", dusk * 0.55);
  for (let y = 0; y < 70; y++) {
    ctx.fillStyle = mixHex(top, bottom, y / 70);
    ctx.fillRect(0, y, FARM_W, 1);
  }

  // stars + moon / sun
  if (n > 0.35) {
    for (const s of stars) {
      const twinkle = Math.sin(t * 2 + s.p) > -0.3 ? 1 : 0;
      ctx.fillStyle = `rgba(255,248,220,${(n - 0.35) * 1.5 * twinkle})`;
      ctx.fillRect(s.x, s.y, 1, 1);
    }
  }
  const orbX = 118;
  const orbY = Math.round(18 + n * 4);
  ctx.fillStyle = n > 0.5 ? "#F4F1E1" : mixHex("#FFF3B0", "#FFB45E", dusk);
  ctx.fillRect(orbX - 4, orbY - 3, 9, 7);
  ctx.fillRect(orbX - 3, orbY - 4, 7, 9);
  if (n > 0.5) {
    ctx.fillStyle = mixHex("#0B1430", "#24345F", 0.3);
    ctx.fillRect(orbX - 1, orbY - 4, 5, 6); // crescent
  }

  // clouds (day)
  if (n < 0.7) {
    ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - n)})`;
    for (const [cx, cy, w] of [
      [20, 14, 18],
      [70, 24, 14],
      [140, 10, 16],
    ] as const) {
      const x = Math.round(((cx + t * 1.6) % (FARM_W + 30)) - 15);
      ctx.fillRect(x, cy, w, 3);
      ctx.fillRect(x + 3, cy - 2, w - 7, 2);
    }
  }

  // Taurus range, then the castle hill
  ridge(ctx, mixHex("#8FA3B8", "#1B2440", n), 50, 10, 0.045, 1.3);
  ridge(ctx, mixHex("#7C9873", "#18261F", n), 62, 6, 0.06, 4.1);
  // Kozan castle (Sis) on its hill
  const castle = mixHex("#B7A58A", "#2A2A33", n);
  ctx.fillStyle = castle;
  ctx.fillRect(34, 50, 22, 6);
  for (let i = 0; i < 6; i++) ctx.fillRect(34 + i * 4, 48, 2, 2);
  ctx.fillRect(42, 44, 5, 7);
  ctx.fillRect(42, 43, 1, 1);
  ctx.fillRect(46, 43, 1, 1);

  // fields
  ctx.fillStyle = mixHex("#88B35A", "#1C3320", n);
  ctx.fillRect(0, 70, FARM_W, FARM_H - 70);
  ctx.fillStyle = mixHex("#7AA24E", "#192D1C", n);
  for (let y = 74; y < FARM_H; y += 6) ctx.fillRect(0, y, FARM_W, 2);

  // solar arrays (his solar project) — left field
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const x = 6 + i * 9 + row * 2;
      const y = 76 + row * 7;
      ctx.fillStyle = mixHex("#2E4A7A", "#121B2E", n);
      ctx.fillRect(x, y, 8, 4);
      ctx.fillStyle = mixHex("#7FA7D9", "#2A3A5C", n);
      ctx.fillRect(x, y, 8, 1);
      if (n < 0.5 && Math.floor(t * 2 + i + row) % 9 === 0) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(x + 2, y + 1, 2, 1);
      }
    }
  }

  // orange orchard — right field
  for (let row = 0; row < 3; row++) {
    for (let i = 0; i < 6; i++) {
      const x = 86 + i * 11 + (row % 2) * 5;
      const y = 74 + row * 10;
      ctx.fillStyle = mixHex("#4E7A38", "#16281A", n);
      ctx.fillRect(x, y, 7, 5);
      ctx.fillRect(x + 1, y - 1, 5, 7);
      ctx.fillStyle = mixHex("#3B6229", "#10200F", n);
      ctx.fillRect(x + 3, y + 6, 1, 2);
      ctx.fillStyle = mixHex("#F28C28", "#5B3A1E", n);
      ctx.fillRect(x + 1 + ((i + row) % 3), y + 1, 1, 1);
      ctx.fillRect(x + 4, y + 3 - (i % 2), 1, 1);
    }
  }

  // barn
  const barnX = 64;
  ctx.fillStyle = mixHex("#B5432F", "#3A1813", n);
  ctx.fillRect(barnX, 66, 16, 10);
  ctx.fillStyle = mixHex("#8E3324", "#2A110D", n);
  ctx.fillRect(barnX - 1, 64, 18, 2);
  ctx.fillRect(barnX + 2, 62, 12, 2);
  ctx.fillStyle = mixHex("#F3E9D8", "#5A5248", n);
  ctx.fillRect(barnX + 6, 70, 4, 6);
  ctx.fillStyle = n > 0.4 ? "#FFD36B" : "#2B2B2B";
  ctx.fillRect(barnX + 12, 68, 2, 2); // lit window at night

  // fence
  ctx.fillStyle = mixHex("#E8DCC4", "#4A453D", n);
  ctx.fillRect(0, 98, FARM_W, 1);
  for (let x = 2; x < FARM_W; x += 8) ctx.fillRect(x, 96, 1, 5);

  // animals: two cows wandering, a sheep, chickens pecking
  const cow = (x: number, y: number, dir: number) => {
    ctx.fillStyle = mixHex("#F5F1E8", "#6A665F", n);
    ctx.fillRect(x, y, 8, 4);
    ctx.fillStyle = mixHex("#2A2420", "#151210", n);
    ctx.fillRect(x + 2, y + 1, 2, 2);
    ctx.fillRect(x + 6, y, 1, 2);
    ctx.fillRect(dir > 0 ? x + 8 : x - 2, y - 1, 2, 3); // head
    ctx.fillRect(x + 1, y + 4, 1, 2);
    ctx.fillRect(x + 6, y + 4, 1, 2);
  };
  const walk = (period: number, span: number, offset: number) => {
    const p = ((t / period + offset) % 2 + 2) % 2;
    return p < 1 ? { x: p * span, dir: 1 } : { x: (2 - p) * span, dir: -1 };
  };
  const c1 = walk(26, 40, 0);
  cow(Math.round(20 + c1.x), 103, c1.dir);
  const c2 = walk(34, 30, 0.7);
  cow(Math.round(100 + c2.x), 108, c2.dir);
  ctx.fillStyle = mixHex("#FFFFFF", "#77736C", n);
  ctx.fillRect(78, 106, 6, 4);
  ctx.fillRect(77, 107, 1, 2);
  for (const [cx, phase] of [
    [60, 0],
    [66, 1.3],
    [71, 2.1],
  ] as const) {
    const peck = Math.sin(t * 5 + phase) > 0.6 ? 1 : 0;
    ctx.fillStyle = mixHex("#FFFDF5", "#77736C", n);
    ctx.fillRect(cx, 112 + peck, 2, 2);
    ctx.fillStyle = "#D9452B";
    ctx.fillRect(cx + 2, 112 + peck * 2, 1, 1);
  }

  // fireflies at night
  if (n > 0.6) {
    for (const f of flies) {
      if (Math.sin(t * 3 + f.p * 4) < 0.2) continue;
      ctx.fillStyle = `rgba(255,236,120,${(n - 0.6) * 2.5})`;
      ctx.fillRect(Math.round((f.x + Math.sin(t + f.p) * 3) % FARM_W), Math.round(f.y + Math.cos(t * 0.7 + f.p) * 2), 1, 1);
    }
  }
}
