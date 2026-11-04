/**
 * `pnpm assets` — turns the Blender output (art/out) into what the site loads (public/3d):
 *
 *   art/out/room.glb             → public/3d/room.<hash>.glb   (dedup → prune(keepLeaves) → WebP ≤1K →
 *                                                                 meshopt + filters, 14-bit positions + UVs)
 *   art/out/lightmaps/*_<px>.png → public/3d/lm/<name>.<hash>.ktx2 (UASTC + Zstandard, mipmaps)
 *   art/out/views/*.png          → public/3d/views/<name>.<tier>.<hash>.webp (window photo, globe map)
 *   + src/lib/assets.manifest.json (URLs, tiers, lightmap scales) — read by src/lib/assets.ts
 *
 * Never uses gltf-transform's `optimize` defaults: they join/flatten nodes, drop empties and quantize
 * UVs to 12 bits, which would break the scene contract and blur the lightmaps.
 * Needs `basisu` (brew install basis_universal). Run `pnpm scene:check && pnpm budget:check` after.
 */
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { type Document, type Node, NodeIO, type Primitive, type vec3, type vec4 } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, meshopt, prune, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder } from "meshoptimizer";
import sharp from "sharp";

const ROOT = process.cwd();
const ART = path.join(ROOT, "art", "out");
const PUB = path.join(ROOT, "public", "3d");
const LM_PUB = path.join(PUB, "lm");
const VIEWS_PUB = path.join(PUB, "views");

/** Runtime pictures that aren't baked: per-tier width and WebP quality. */
const VIEWS = {
  window: { file: "window_view.png", desktop: [2048, 78], mobile: [1024, 72] },
  globe: { file: "globe_map.png", desktop: [2048, 84], mobile: [1024, 80] },
} as const;
const MANIFEST = path.join(ROOT, "src", "lib", "assets.manifest.json");

const hash = (buf: Buffer) => crypto.createHash("sha256").update(buf).digest("hex").slice(0, 10);
const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`;

interface BakeManifest {
  version: number;
  rgbmRange: number;
  sets: Record<string, { day: number; mask: [number, number, number]; coverage: number }>;
  files: Record<string, Record<string, { day: string; mask: string }>>;
}

/**
 * Baked meshes are drawn with an unlit shader (albedo × lightmap), so they don't need normals; and
 * untextured ones don't need UV0 (it's a copy of UV1). Metals keep normals for their reflections,
 * dynamic (realtime-lit) meshes keep everything, and so does everything under an item__ empty (a
 * shelf item is realtime-lit while it's in your hand). Dropping these lets weld() merge the
 * vertices that only existed because of normal splits.
 */
function stripUnusedAttributes(doc: Document) {
  let normals = 0;
  let uvs = 0;
  const parentOf = new Map<Node, Node>();
  for (const node of doc.getRoot().listNodes()) for (const child of node.listChildren()) parentOf.set(child, node);
  const inItem = (node: Node) => {
    for (let p = parentOf.get(node); p; p = parentOf.get(p)) if (p.getName().startsWith("item__")) return true;
    return false;
  };
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh();
    if (!mesh) continue;
    const extras = node.getExtras() as { bake?: string; dynamic?: boolean };
    const name = node.getName();
    const keepUV0 = /^(slot|screen|display)__/.test(name);
    const held = inItem(node);
    for (const prim of mesh.listPrimitives() as Primitive[]) {
      const material = prim.getMaterial();
      const metal = (material?.getMetallicFactor() ?? 0) > 0.5;
      const textured = Boolean(material?.getBaseColorTexture());
      if (extras.bake && !extras.dynamic && !metal && !held && prim.getAttribute("NORMAL")) {
        prim.setAttribute("NORMAL", null);
        normals++;
      }
      if (extras.bake && !textured && !keepUV0 && prim.getAttribute("TEXCOORD_0")) {
        prim.setAttribute("TEXCOORD_0", null);
        uvs++;
      }
    }
  }
  console.log(`  dropped NORMAL on ${normals} and TEXCOORD_0 on ${uvs} primitives`);
}

/**
 * The GLB's JSON isn't compressed and it's ~20% of the file (one node, mesh, accessors and buffer
 * views per mesh). Node transforms and material factors don't need 17 digits: 8 significant digits
 * is < 0.1 µm on a 4.5 m room, and colors need 6.
 */
function roundJsonNumbers(doc: Document) {
  const r = (digits: number) => (v: number) => Number(v.toPrecision(digits));
  for (const node of doc.getRoot().listNodes()) {
    node.setTranslation(node.getTranslation().map(r(8)) as vec3);
    node.setRotation(node.getRotation().map(r(8)) as vec4);
    node.setScale(node.getScale().map(r(8)) as vec3);
  }
  for (const material of doc.getRoot().listMaterials()) {
    material.setBaseColorFactor(material.getBaseColorFactor().map(r(6)) as vec4);
    material.setEmissiveFactor(material.getEmissiveFactor().map(r(6)) as vec3);
    material.setRoughnessFactor(r(6)(material.getRoughnessFactor()));
    material.setMetallicFactor(r(6)(material.getMetallicFactor()));
  }
}

async function buildRoom(): Promise<string> {
  await MeshoptEncoder.ready;
  await MeshoptDecoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder, "meshopt.decoder": MeshoptDecoder });
  const doc = await io.read(path.join(ART, "room.glb"));
  stripUnusedAttributes(doc);
  await doc.transform(
    dedup(),
    prune({ keepLeaves: true, keepAttributes: true, keepExtras: true }),
    weld(),
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: 88, resize: [1024, 1024] }),
    // the cork board is small on screen and its noise compresses badly
    textureCompress({ encoder: sharp, targetFormat: "webp", quality: 82, resize: [256, 256], pattern: /cork/ }),
    // "high" adds meshopt's filters (octahedral normals…): ~9% smaller, decoded by three's MeshoptDecoder
    meshopt({ encoder: MeshoptEncoder, level: "high", quantizePosition: 14, quantizeTexcoord: 14, quantizeNormal: 10 }),
  );
  roundJsonNumbers(doc);
  const glb = Buffer.from(await io.writeBinary(doc));
  const name = `room.${hash(glb)}.glb`;
  fs.writeFileSync(path.join(PUB, name), glb);
  console.log(`✓ ${name} ${kb(glb.length)}`);
  return `/3d/${name}`;
}

function encodeKtx2(src: string, kind: "rgbm" | "srgb"): string {
  const tmp = path.join(os.tmpdir(), `lm-${process.pid}-${path.basename(src, ".png")}.ktx2`);
  const color = kind === "rgbm" ? ["-linear", "-mip_linear"] : ["-srgb", "-mip_srgb"];
  execFileSync(
    "basisu",
    ["-ktx2", "-uastc", "-uastc_level", "3", "-ktx2_zstandard_level", "19", "-mipmap", ...color, "-file", src, "-output_file", tmp],
    { stdio: "pipe" },
  );
  const buf = fs.readFileSync(tmp);
  fs.rmSync(tmp);
  const name = `${path.basename(src, ".png")}.${hash(buf)}.ktx2`;
  fs.writeFileSync(path.join(LM_PUB, name), buf);
  console.log(`✓ lm/${name} ${kb(buf.length)}`);
  return `/3d/lm/${name}`;
}

async function encodeViews(): Promise<Record<string, Record<string, string>>> {
  const out: Record<string, Record<string, string>> = {};
  for (const [name, spec] of Object.entries(VIEWS)) {
    const src = path.join(ART, "views", spec.file);
    out[name] = {};
    for (const tier of ["desktop", "mobile"] as const) {
      const [width, quality] = spec[tier];
      const buf = await sharp(src).resize({ width, kernel: "lanczos3" }).webp({ quality, effort: 6, smartSubsample: true }).toBuffer();
      const file = `${name}.${tier}.${hash(buf)}.webp`;
      fs.writeFileSync(path.join(VIEWS_PUB, file), buf);
      console.log(`✓ views/${file} ${kb(buf.length)}`);
      out[name][tier] = `/3d/views/${file}`;
    }
  }
  return out;
}

async function main() {
  fs.mkdirSync(LM_PUB, { recursive: true });
  fs.mkdirSync(VIEWS_PUB, { recursive: true });
  const list = (dir: string, prefix: string) => fs.readdirSync(dir).map((f) => `${prefix}/${f}`);
  const before = new Set([...list(PUB, "/3d"), ...list(LM_PUB, "/3d/lm"), ...list(VIEWS_PUB, "/3d/views")]);
  const room = await buildRoom();
  const bake = JSON.parse(fs.readFileSync(path.join(ART, "lightmaps", "lightmaps.json"), "utf8")) as BakeManifest;
  const lightmaps: Record<string, Record<string, unknown>> = {};
  const cache = new Map<string, string>();
  for (const [tier, sets] of Object.entries(bake.files)) {
    lightmaps[tier] = {};
    for (const [set, files] of Object.entries(sets)) {
      const url = (file: string, kind: "rgbm" | "srgb") => {
        if (!cache.has(file)) cache.set(file, encodeKtx2(path.join(ART, "lightmaps", file), kind));
        return cache.get(file)!;
      };
      const scale = bake.sets[set]!;
      lightmaps[tier]![set] = {
        day: url(files.day, "rgbm"),
        mask: url(files.mask, "srgb"),
        scale: { day: scale.day, mask: scale.mask },
      };
    }
  }
  const views = await encodeViews();
  const version = hash(Buffer.from(JSON.stringify({ room, lightmaps, views })));
  const manifest = { version, room, rgbmRange: bake.rgbmRange, lightmaps, views };
  fs.writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`✓ ${path.relative(ROOT, MANIFEST)} (version ${version})`);

  // remove files the new manifest no longer references (keeps public/3d from growing)
  const keep = new Set([room, ...cache.values(), ...Object.values(views).flatMap((v) => Object.values(v)), "/3d/lm", "/3d/views", "/3d/blockout.glb"]);
  for (const url of before) {
    if (keep.has(url)) continue;
    const file = path.join(ROOT, "public", url);
    if (fs.statSync(file).isFile()) {
      fs.rmSync(file);
      console.log(`  removed ${url}`);
    }
  }
}

await main();
