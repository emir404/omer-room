import assert from "node:assert/strict";
import { test } from "node:test";
import type { SceneBook, SceneShelf } from "../../lib/content/scene-data";
import type { SceneIndex } from "./scene-index";
import { buildShelfMap } from "./shelf-map";

const node = (userData: Record<string, unknown> = {}) => ({ userData });

function fakeIndex(ids: [string, Record<string, unknown>?][]): SceneIndex {
  return { items: new Map(ids.map(([id, data]) => [id, node(data)])) } as unknown as SceneIndex;
}

const book = (slug: string, order: number, featured = false): SceneBook => ({
  slug,
  title: slug,
  author: "",
  order,
  color: "#000000",
  text: "#ffffff",
  href: `/shelf/${slug}`,
  cover: null,
  featured,
});

const shelf: SceneShelf = {
  sections: [],
  items: [
    { slug: "club", section: "school", title: "Club", spine: "Club", role: "", href: "/shelf/club" },
    { slug: "research", section: "school", title: "Research", spine: "Research", role: "", href: "/shelf/research" },
    { slug: "economics-olympiad", section: "olympiad", title: "Olympiad", spine: "Olympiad", role: "", href: "/shelf/economics-olympiad" },
  ],
};

test("featured books stand face-out first; the rest fill the spines in order", () => {
  const index = fakeIndex([["book_01"], ["book_02", { faceout: true }], ["book_03"], ["book_04", { faceout: true }]]);
  const map = buildShelfMap(index, shelf, [book("a", 1), book("b", 2, true), book("c", 3), book("d", 4, true), book("e", 5)]);
  assert.equal(map.books.get("book_02")?.slug, "b");
  assert.equal(map.books.get("book_04")?.slug, "d");
  assert.equal(map.books.get("book_01")?.slug, "a");
  assert.equal(map.books.get("book_03")?.slug, "c");
  // "e" doesn't fit: no spot, no item to hold (it's still in the Books list)
  assert.equal(map.bySlug.get("e"), undefined);
  assert.deepEqual(map.bySlug.get("b"), ["book_02"]);
});

test("school items get a binder each, in order; empty binders stay empty", () => {
  const index = fakeIndex([["binder_01"], ["binder_02"], ["binder_03"]]);
  const map = buildShelfMap(index, shelf, []);
  assert.equal(map.binders.get("binder_01")?.slug, "club");
  assert.equal(map.binders.get("binder_02")?.slug, "research");
  assert.equal(map.binders.get("binder_03"), null);
});

test("a shelf item's hero prop is what a deep link puts in your hand", () => {
  const index = fakeIndex([["medal_silver_1"], ["trophy"], ["medal_gold", { section: "olympiad" }]]);
  const map = buildShelfMap(index, shelf, []);
  assert.equal(map.bySlug.get("economics-olympiad")?.[0], "medal_gold");
  assert.equal(map.byItem.get("trophy")?.href, "/shelf/economics-olympiad");
  assert.equal(map.sectionOf.get("medal_gold"), "olympiad");
});
