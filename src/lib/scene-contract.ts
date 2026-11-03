/**
 * The seam between code and art.
 *
 * Every node in `public/3d/room.glb` follows this naming contract, so the Blender art pass can
 * replace the blockout GLB without touching any logic. `scripts/check-scene.ts` enforces it.
 *
 * Names match /^[a-z0-9_]+$/ and are shaped `<kind>__<id>[__<suffix>...]`
 * (double underscore separates parts; ids may contain single underscores).
 * GLTFLoader strips `. : / [ ]` from names, so Blender's `.001` suffixes must never reach export.
 */

/** Clickable objects in the room. `hoop` has no chapter (it's a toy). */
export const OBJECT_IDS = ["shelf", "computer", "phone", "globe", "window", "letter", "contact", "hoop"] as const;
export type ObjectId = (typeof OBJECT_IDS)[number];

/** Everything the camera can focus: the room overview + every object. */
export type FocusId = "room" | ObjectId;
export const FOCUS_IDS: readonly FocusId[] = ["room", ...OBJECT_IDS];

export const NODE_KINDS = [
  "obj", // group of meshes that highlight together; id ∈ OBJECT_IDS
  "part", // a mesh inside an obj group (part__<objectId>__NN)
  "hit", // invisible click/hover proxy for an object
  "cam", // camera empty (cam__<focus>) + its look-at target (cam__<focus>__target)
  "label", // empty where the hover label / mobile pin anchors
  "screen", // a screen quad that hosts a DOM UI when focused (computer, phone)
  "display", // a quad with a live texture that isn't a DOM host (window view, now ticker, letter)
  "slot", // content-driven surface: slot__book__NN, slot__photo__NN
  "pivot", // a transform the code animates (globe spin, mailbox flag)
  "anchor", // a point the code needs (hoop rim, ball rest)
  "decor", // static set dressing
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const SCREEN_IDS = ["computer", "phone"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export const DISPLAY_IDS = ["window", "now", "letter"] as const;
export type DisplayId = (typeof DISPLAY_IDS)[number];

export const SLOT_KINDS = ["book", "photo"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

/** globe: spins (pins are added as children). contact_flag: mailbox flag lifts on hover.
 *  hoop_ball: the ball itself — its rest transform is where it returns after a shot. */
export const PIVOT_IDS = ["globe", "contact_flag", "hoop_ball"] as const;
export type PivotId = (typeof PIVOT_IDS)[number];

export const ANCHOR_IDS = ["hoop_rim"] as const;
export type AnchorId = (typeof ANCHOR_IDS)[number];

export const NAME_RE = /^[a-z0-9_]+$/;
const SEP = "__";

export interface ParsedName {
  kind: NodeKind;
  id: string;
  rest: string[];
}

export function parseNodeName(name: string): ParsedName | null {
  if (!NAME_RE.test(name)) return null;
  const [kind, id, ...rest] = name.split(SEP);
  if (!kind || !id || !(NODE_KINDS as readonly string[]).includes(kind)) return null;
  return { kind: kind as NodeKind, id, rest };
}

const pad = (n: number) => String(n).padStart(2, "0");

export const nodeName = {
  obj: (id: ObjectId) => `obj__${id}`,
  part: (id: ObjectId, n: number) => `part__${id}__${pad(n)}`,
  hit: (id: ObjectId) => `hit__${id}`,
  label: (id: ObjectId) => `label__${id}`,
  cam: (id: FocusId) => `cam__${id}`,
  camTarget: (id: FocusId) => `cam__${id}__target`,
  screen: (id: ScreenId) => `screen__${id}`,
  display: (id: DisplayId) => `display__${id}`,
  slot: (kind: SlotKind, n: number) => `slot__${kind}__${pad(n)}`,
  pivot: (id: PivotId) => `pivot__${id}`,
  anchor: (id: AnchorId) => `anchor__${id}`,
  decor: (id: string, n?: number) => (n === undefined ? `decor__${id}` : `decor__${id}__${pad(n)}`),
};

/** Custom properties (glTF `extras` → three `userData`) the code reads. */
export interface NodeExtras {
  /** slot__* only: width / height of the visible front face. */
  aspect?: number;
  /** lightmap set this node samples: lm_<bake>_{day,night,mask} (Phase 2). */
  bake?: string;
  /** decor/part: emissive at night (lamp shade, string-light bulbs, LED). */
  glow?: "lamp" | "monitor" | "string";
  /** Moves at runtime (globe, ball): realtime-lit instead of baked. */
  dynamic?: boolean;
}

/** Node names every room GLB must contain. */
export function requiredNodeNames(): string[] {
  const names: string[] = [];
  for (const id of FOCUS_IDS) names.push(nodeName.cam(id), nodeName.camTarget(id));
  for (const id of OBJECT_IDS) names.push(nodeName.obj(id), nodeName.hit(id), nodeName.label(id));
  for (const id of SCREEN_IDS) names.push(nodeName.screen(id));
  for (const id of DISPLAY_IDS) names.push(nodeName.display(id));
  for (const id of PIVOT_IDS) names.push(nodeName.pivot(id));
  for (const id of ANCHOR_IDS) names.push(nodeName.anchor(id));
  return names;
}
