/**
 * `pnpm art [step]` — runs the Blender art pipeline headless (see art/README.md).
 *
 *   sources   download the photo/raster inputs into art/src (once; git-ignored)
 *   views     the window photo + the globe map → art/out/views (art/blender/views.py)
 *   textures  procedural albedo textures → art/out/tex
 *   room      assemble every prop → art/out/room.blend
 *   bake      day / night / light-mask lightmaps → art/out/lightmaps (Cycles on the GPU)
 *   export    art/out/room.glb
 *   assets    optimize + KTX2 → public/3d + src/lib/assets.manifest.json
 *   all       everything above, in order (sources only when missing)
 *   preview   Cycles renders from the site's cameras → art/previews (args: day|night cams samples)
 *
 * BLENDER=/path/to/Blender overrides the default macOS app location. Extra args after `--` go to the
 * Blender script (e.g. `pnpm art bake -- 128 2048 1024` for a quick bake).
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";

/** Inputs that aren't made in Blender: both free to use (CC0 / public domain). */
const SOURCES = [
  // Poly Haven "Dry Orchard Meadow" (Alexander Scholten), CC0 — the view out of the window
  { file: "art/src/dry_orchard_meadow.jpg", url: "https://dl.polyhaven.org/file/ph-assets/HDRIs/extra/Tonemapped%20JPG/dry_orchard_meadow.jpg" },
  // Natural Earth "Cross Blended Hypso with Shaded Relief and Water" 1:50m, public domain — the globe
  { file: "art/src/HYP_50M_SR_W.zip", url: "https://naciscdn.org/naturalearth/50m/raster/HYP_50M_SR_W.zip", unzip: "art/src/hyp" },
];

function sources() {
  fs.mkdirSync("art/src", { recursive: true });
  for (const s of SOURCES) {
    if (!fs.existsSync(s.file)) {
      console.log(`  downloading ${s.url}`);
      execFileSync("curl", ["-fL", "--retry", "3", "-o", s.file, s.url], { stdio: "inherit" });
    }
    if (s.unzip && !fs.existsSync(s.unzip)) execFileSync("unzip", ["-o", "-q", s.file, "-d", s.unzip], { stdio: "inherit" });
  }
}

const BLENDER = process.env.BLENDER ?? "/Applications/Blender.app/Contents/MacOS/Blender";
const [step = "all", ...rest] = process.argv.slice(2);
const extra = rest[0] === "--" ? rest.slice(1) : rest;

const blender = (script, args = []) =>
  execFileSync(BLENDER, ["-b", "--factory-startup", "--python-exit-code", "1", "-P", `art/blender/${script}`, "--", ...args], { stdio: "inherit" });

const steps = {
  sources,
  views: () => blender("views.py", extra),
  textures: () => blender("textures.py"),
  room: () => blender("build_room.py"),
  bake: () => blender("bake.py", extra),
  export: () => blender("export.py"),
  assets: () => execFileSync("pnpm", ["assets"], { stdio: "inherit" }),
  preview: () => blender("preview_room.py", extra),
};

const order = step === "all" ? ["sources", "views", "textures", "room", "bake", "export", "assets"] : [step];
for (const s of order) {
  if (!steps[s]) {
    console.error(`unknown step "${s}" (${Object.keys(steps).join(", ")}, all)`);
    process.exit(1);
  }
  console.log(`\n▸ art ${s}`);
  steps[s]();
}
