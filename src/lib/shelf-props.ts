import type { PropId } from "./scene-contract";

/**
 * The modeled things on the shelf (art/blender/props/shelf.py, PROP_IDS in scene-contract.ts) and
 * the story each one tells: picking one up opens that shelf item (content/shelf/<item>.md). The
 * label is the hover tooltip and the "in your hand" line.
 *
 * Shelf items with no prop here get a binder on their section's shelf (in `order`). `pnpm
 * content:check` fails if an item slug below doesn't exist.
 */
export const SHELF_PROPS: Record<PropId, { item: string; label: string }> = {
  paper_research: { item: "edison-tse-research", label: "The research paper" },
  books_lgs: { item: "my-lgs-buddy", label: "Books we gave away" },
  certificate: { item: "my-lgs-buddy", label: "Ministry of Education recognition" },
  medal_gold: { item: "economics-olympiad", label: "National gold medal" },
  medal_silver_1: { item: "economics-olympiad", label: "The team's IEO silver" },
  medal_silver_2: { item: "economics-olympiad", label: "The team's IEO silver" },
  medal_bronze_1: { item: "economics-olympiad", label: "The team's IEO bronze" },
  medal_bronze_2: { item: "economics-olympiad", label: "The team's IEO bronze" },
  trophy: { item: "economics-olympiad", label: "The team trophy" },
  placard: { item: "mundp", label: "My placard at MUNDP" },
  gavel: { item: "mundp", label: "The gavel" },
  lanyard: { item: "mundp", label: "MUNDP badge" },
  photo_01: { item: "mundp", label: "MUNDP" },
  photo_02: { item: "mundp", label: "MUNDP" },
  photo_03: { item: "mundp", label: "MUNDP" },
};

/** What a deep link to a shelf item puts in your hand (otherwise: its first prop, or its binder). */
export const HERO_PROP: Record<string, PropId> = {
  "economics-olympiad": "medal_gold",
  mundp: "placard",
  "edison-tse-research": "paper_research",
  "my-lgs-buddy": "books_lgs",
};

export function propsOf(item: string): PropId[] {
  return (Object.keys(SHELF_PROPS) as PropId[]).filter((id) => SHELF_PROPS[id].item === item);
}
