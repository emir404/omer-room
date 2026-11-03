// Copies three's Basis/KTX2 transcoder into public/basis/r<rev>/ so KTX2Loader uses a
// transcoder that always matches the installed three version (drei's default points at a
// jsDelivr @master copy that can drift). Runs on postinstall; safe to run repeatedly.
import { cpSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const threePkg = join(root, "node_modules", "three", "package.json");
if (!existsSync(threePkg)) {
  console.log("[copy-basis] three not installed yet, skipping");
  process.exit(0);
}
const { version } = JSON.parse(readFileSync(threePkg, "utf8"));
const rev = version.split(".")[1]; // 0.187.0 -> 187
const src = join(root, "node_modules", "three", "examples", "jsm", "libs", "basis");
const dest = join(root, "public", "basis", `r${rev}`);
mkdirSync(dest, { recursive: true });
for (const file of ["basis_transcoder.js", "basis_transcoder.wasm"]) {
  cpSync(join(src, file), join(dest, file));
}
console.log(`[copy-basis] copied transcoder for three r${rev} -> public/basis/r${rev}/`);
