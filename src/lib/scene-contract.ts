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
  "item", // something on the shelf you can pick up: item__<id> (see ITEM below)
  "hit", // invisible click/hover proxy for an object
  "cam", // camera empty (cam__<focus>) + its look-at target (cam__<focus>__target)
  "label", // empty where the hover label / mobile pin anchors
  "screen", // a screen quad the live DOM UI (desktop, phone) is mapped onto, always on
  "display", // a quad with a live texture that isn't a DOM host (window view, now ticker, letter)
  "slot", // content-driven surface: slot__book__NN, slot__cover__NN, slot__photo__NN, slot__binder__NN…
  "pivot", // a transform the code animates (globe spin, mailbox flag and door)
  "anchor", // a point the code needs (hoop rim, the shelf's sections)
  "decor", // static set dressing
] as const;
export type NodeKind = (typeof NODE_KINDS)[number];

export const SCREEN_IDS = ["computer", "phone"] as const;
export type ScreenId = (typeof SCREEN_IDS)[number];

export const DISPLAY_IDS = ["window", "now", "letter"] as const;
export type DisplayId = (typeof DISPLAY_IDS)[number];

/**
 * Content-driven surfaces; each front face spans UV 0..1 and carries an `aspect`.
 *  book    a book's spine (slot__book__NN)          cover  the same book's front cover (slot__cover__NN, same NN)
 *  binder  a school binder's spine label            photo  a framed photo (MUN frames, the certificate)
 *  label   a shelf section's name plate (extras.section)
 *  page    a printed page drawn at runtime (slot__page__01: the research paper's title page)
 */
export const SLOT_KINDS = ["book", "cover", "photo", "binder", "label", "page"] as const;
export type SlotKind = (typeof SLOT_KINDS)[number];

/** globe: spins (pins are added as children). contact_flag / contact_door: the mailbox opens when
 *  you come to it. hoop_ball: the ball itself — its rest transform is where it returns after a shot. */
export const PIVOT_IDS = ["globe", "contact_flag", "contact_door", "hoop_ball"] as const;
export type PivotId = (typeof PIVOT_IDS)[number];

/** The shelf's sections, top to bottom on the case; same ids as `shelves` in content/shelf.json. */
export const SECTION_IDS = ["school", "olympiad", "mun", "books"] as const;
export type SectionId = (typeof SECTION_IDS)[number];

/** hoop_rim: where the ball scores. section_<id>: the middle of a shelf section's opening, with
 *  extras w × h (meters) — the camera frames it. */
export const ANCHOR_IDS = ["hoop_rim", "section_school", "section_olympiad", "section_mun", "section_books"] as const;
export type AnchorId = (typeof ANCHOR_IDS)[number];

/**
 * Items: things on the shelf you can pick up. `item__<id>` is an empty at the item's middle,
 * oriented so its local +X points out of the face you'd show someone (a book's front cover, a
 * medal's face, the placard's printed side) and +Y is up (glTF; Blender +Z). Its meshes are
 * children (item__<id>__NN, merged per material inside the item, closed on every side: you see
 * all of it when it's in your hand), plus the slot planes that belong to it.
 *  book_NN               a book: slot__book__NN (spine) + slot__cover__NN (front cover); extras.faceout
 *                        when it stands showing its cover
 *  binder_NN             a school binder (slot__binder__NN on its spine)
 *  paper_research        the bound research paper (slot__page__01 is its title page)
 *  books_lgs             the tied stack of donated books (My LGS Buddy)
 *  certificate           a framed certificate (slot__photo__04)
 *  medal_gold, medal_silver_1, medal_silver_2, medal_bronze_1, medal_bronze_2, trophy
 *  placard, gavel, lanyard, photo_01..03 (slot__photo__01..03)
 * Every item carries extras.section.
 */
export const PROP_IDS = [
  "paper_research",
  "books_lgs",
  "certificate",
  "medal_gold",
  "medal_silver_1",
  "medal_silver_2",
  "medal_bronze_1",
  "medal_bronze_2",
  "trophy",
  "placard",
  "gavel",
  "lanyard",
  "photo_01",
  "photo_02",
  "photo_03",
] as const;
export type PropId = (typeof PROP_IDS)[number];

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
  item: (id: string) => `item__${id}`,
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
  /** slot__* and display__letter: width / height of the visible front face. */
  aspect?: number;
  /** lightmap set this node samples: lm_<bake>_{day,night,mask} (Phase 2). */
  bake?: string;
  /** decor/part: emissive at night (lamp shade, string-light bulbs, LED). */
  glow?: "lamp" | "monitor" | "string";
  /** Moves at runtime (globe, ball): realtime-lit instead of baked. */
  dynamic?: boolean;
  /** item__book_NN: stands face-out (its cover shows on the shelf). */
  faceout?: boolean;
  /** item__* and slot__label__*: the shelf section it sits in. */
  section?: SectionId;
  /** anchor__section_*: width and height of the section's opening, in meters. */
  w?: number;
  h?: number;
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
