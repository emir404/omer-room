/**
 * `pnpm scene:check` — validates public/3d/room.glb against the scene contract
 * (src/lib/scene-contract.ts) and content/objects.json. Run it after every art export.
 */
import fs from "node:fs";
import path from "node:path";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";
import { ASSETS } from "../src/lib/assets";
import { NAME_RE, OBJECT_IDS, parseNodeName, requiredNodeNames, SLOT_KINDS } from "../src/lib/scene-contract";

const errors: string[] = [];
const warnings: string[] = [];

const file = path.join(process.cwd(), "public", ASSETS.room);
await MeshoptDecoder.ready;
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const doc = await io.read(file);
const nodes = doc.getRoot().listNodes();
const names = nodes.map((n) => n.getName());

// 1. every name follows the contract and is unique
const seen = new Set<string>();
for (const name of names) {
  if (!NAME_RE.test(name) || !parseNodeName(name)) errors.push(`bad node name "${name}" (expected <kind>__<id>, [a-z0-9_])`);
  if (seen.has(name)) errors.push(`duplicate node name "${name}"`);
  seen.add(name);
}

// 2. required nodes exist
for (const required of requiredNodeNames()) {
  if (!seen.has(required)) errors.push(`missing required node "${required}"`);
}

// 3. obj__ ids are known objects, and objects.json lists them all
const objects = JSON.parse(fs.readFileSync(path.join(process.cwd(), "content", "objects.json"), "utf8")) as { id: string }[];
const contentIds = new Set(objects.map((o) => o.id));
for (const name of names) {
  const parsed = parseNodeName(name);
  if (parsed?.kind === "obj" && !(OBJECT_IDS as readonly string[]).includes(parsed.id)) errors.push(`obj "${name}" is not in OBJECT_IDS`);
  if (parsed?.kind === "obj" && !contentIds.has(parsed.id)) errors.push(`obj "${name}" has no entry in content/objects.json`);
}

// 4. slots carry an aspect, and meshes have UV0 (+ UV1 once lightmaps exist)
const slots: Record<string, number> = {};
for (const node of nodes) {
  const parsed = parseNodeName(node.getName());
  const mesh = node.getMesh();
  if (parsed?.kind === "slot") {
    if (!(SLOT_KINDS as readonly string[]).includes(parsed.id)) errors.push(`${node.getName()}: unknown slot kind "${parsed.id}"`);
    slots[parsed.id] = (slots[parsed.id] ?? 0) + 1;
    const aspect = (node.getExtras() as { aspect?: unknown }).aspect;
    if (typeof aspect !== "number") errors.push(`${node.getName()} needs a numeric "aspect" custom property`);
  }
  if (!mesh || parsed?.kind === "hit") continue;
  const extras = node.getExtras() as { bake?: unknown };
  // UV0 carries albedo textures and the runtime pictures (slots, screens, displays); UV1 the lightmap
  const needsUV0 = parsed?.kind === "slot" || parsed?.kind === "screen" || parsed?.kind === "display";
  for (const prim of mesh.listPrimitives()) {
    const textured = Boolean(prim.getMaterial()?.getBaseColorTexture());
    if ((needsUV0 || textured) && !prim.getAttribute("TEXCOORD_0")) errors.push(`${node.getName()} has no UV0 (TEXCOORD_0)`);
    if (extras.bake !== undefined) {
      if (ASSETS.lightmaps && !Object.values(ASSETS.lightmaps).every((sets) => typeof extras.bake === "string" && extras.bake in sets)) {
        errors.push(`${node.getName()} bakes into "${String(extras.bake)}", which has no lightmaps in the manifest`);
      }
      if (!prim.getAttribute("TEXCOORD_1")) errors.push(`${node.getName()} has bake="${String(extras.bake)}" but no lightmap UV (TEXCOORD_1)`);
    }
  }
}

const meshCount = nodes.filter((n) => n.getMesh()).length;
const triangles = doc
  .getRoot()
  .listMeshes()
  .flatMap((mesh) => mesh.listPrimitives())
  .reduce((sum, prim) => sum + (prim.getIndices()?.getCount() ?? 0) / 3, 0);

for (const w of warnings) console.warn(`! ${w}`);
if (errors.length) {
  for (const e of errors) console.error(`✗ ${e}`);
  console.error(`\n${errors.length} contract error(s) in ${ASSETS.room}`);
  process.exit(1);
}
console.log(
  `✓ ${ASSETS.room} follows the scene contract — ${nodes.length} nodes, ${meshCount} meshes, ` +
    `${Math.round(triangles).toLocaleString()} triangles, slots: ${Object.entries(slots).map(([k, n]) => `${n} ${k}`).join(", ")}`,
);
