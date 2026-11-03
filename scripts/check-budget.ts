/**
 * `pnpm budget:check` — keeps "fast load" honest. Fails if the 3D download for a tier exceeds
 * its budget, or if a baked texture isn't power-of-two (KTX2 mipmaps need it).
 * Critical-path JS is measured separately in the Playwright suite (tests/budget.spec.ts).
 */
import fs from "node:fs";
import path from "node:path";
import { ASSETS } from "../src/lib/assets";
import type { Tier } from "../src/lib/quality";

const BUDGET: Record<Tier, number> = { desktop: 6 * 1024 * 1024, mobile: 3 * 1024 * 1024 };
const publicDir = path.join(process.cwd(), "public");
const size = (url: string) => fs.statSync(path.join(publicDir, url.split("?")[0]!)).size;
const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(2)} MB`;

let failed = false;
const glb = size(ASSETS.room);

for (const tier of ["desktop", "mobile"] as Tier[]) {
  let total = glb;
  const sets = ASSETS.lightmaps?.[tier] ?? {};
  for (const set of Object.values(sets)) {
    for (const url of [set.day, set.mask]) total += size(url);
  }
  // the window photo and the globe map load with the room
  for (const view of Object.values(ASSETS.views ?? {})) total += size(view[tier]);
  const ok = total <= BUDGET[tier];
  failed ||= !ok;
  console.log(`${ok ? "✓" : "✗"} ${tier.padEnd(7)} 3D download ${mb(total)} / budget ${mb(BUDGET[tier])}`);
}

// KTX2 headers store pixel width/height at byte offsets 20 and 24.
for (const tierSets of Object.values(ASSETS.lightmaps ?? {})) {
  for (const set of Object.values(tierSets)) {
    for (const url of [set.day, set.mask]) {
      if (!url.endsWith(".ktx2")) continue;
      const header = fs.readFileSync(path.join(publicDir, url)).subarray(0, 32);
      const width = header.readUInt32LE(20);
      const height = header.readUInt32LE(24);
      const pot = (n: number) => n > 0 && (n & (n - 1)) === 0;
      if (!pot(width) || !pot(height)) {
        console.error(`✗ ${url} is ${width}×${height}; baked textures must be power-of-two`);
        failed = true;
      }
    }
  }
}

if (failed) process.exit(1);
