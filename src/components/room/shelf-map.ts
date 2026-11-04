"use client";

import { create } from "zustand";
import type { SceneBook, SceneShelf } from "@/lib/content/scene-data";
import type { SectionId } from "@/lib/scene-contract";
import { HERO_PROP, SHELF_PROPS } from "@/lib/shelf-props";
import { assignSlots } from "@/lib/slots";
import type { SceneIndex } from "./scene-index";

/**
 * Content ↔ the things on the shelf. Books fill the book items (featured ones stand face-out),
 * school items get a binder each, props tell the story SHELF_PROPS gives them. The result answers
 * two questions: what does this URL put in your hand, and what does this thing open?
 */
export interface ShelfMap {
  /** A route slug (shelf item or book) → the items that tell it, the one to hold first. */
  bySlug: Map<string, string[]>;
  /** An item id → its route slug, tooltip and URL. */
  byItem: Map<string, { slug: string; label: string; href: string }>;
  /** Book items → the book on them (null = left empty, hidden). */
  books: Map<string, SceneBook | null>;
  /** Binder items → the school item they hold. */
  binders: Map<string, SceneShelf["items"][number] | null>;
  /** Which section each item sits in (extras.section; a pre-items GLB guesses). */
  sectionOf: Map<string, SectionId>;
}

const EMPTY: ShelfMap = { bySlug: new Map(), byItem: new Map(), books: new Map(), binders: new Map(), sectionOf: new Map() };

export const useShelfMap = create<{ map: ShelfMap }>(() => ({ map: EMPTY }));

const byNumber = (a: string, b: string) => a.localeCompare(b, "en", { numeric: true });

export function buildShelfMap(index: SceneIndex, shelf: SceneShelf, books: SceneBook[]): ShelfMap {
  const bySlug = new Map<string, string[]>();
  const byItem: ShelfMap["byItem"] = new Map();
  const sectionOf = new Map<string, SectionId>();
  const add = (slug: string, id: string, label: string, href: string, first = false) => {
    const list = bySlug.get(slug) ?? [];
    if (first) list.unshift(id);
    else list.push(id);
    bySlug.set(slug, list);
    byItem.set(id, { slug, label, href });
  };

  for (const [id, node] of index.items) {
    const section = node.userData.section as SectionId | undefined;
    sectionOf.set(id, section ?? (id.startsWith("book_") ? "books" : "school"));
  }

  // books: featured ones take the face-out spots, the rest fill the spines in order
  const bookItems = [...index.items.keys()].filter((id) => id.startsWith("book_")).sort(byNumber);
  const faceout = bookItems.filter((id) => index.items.get(id)!.userData.faceout);
  const spines = bookItems.filter((id) => !faceout.includes(id));
  const featured = books.filter((b) => b.featured);
  const rest = books.filter((b) => !b.featured);
  // (a pinned `slot` is a spine position, so it doesn't apply to the face-out spots)
  const out = assignSlots(
    featured.map((b) => ({ ...b, slot: undefined })),
    faceout.length,
  );
  const pinned = assignSlots([...out.overflow, ...rest], spines.length);
  const bookOn = new Map<string, SceneBook | null>();
  faceout.forEach((id, i) => bookOn.set(id, (out.assigned[i] as SceneBook | null) ?? null));
  spines.forEach((id, i) => bookOn.set(id, pinned.assigned[i] ?? null));
  for (const [id, book] of bookOn) if (book) add(book.slug, id, book.title, book.href);

  // school items: a binder each, in order
  const binderItems = [...index.items.keys()].filter((id) => id.startsWith("binder_")).sort(byNumber);
  const school = shelf.items.filter((i) => i.section === "school");
  const binders = new Map<string, SceneShelf["items"][number] | null>();
  binderItems.forEach((id, i) => {
    const item = school[i] ?? null;
    binders.set(id, item);
    if (item) add(item.slug, id, item.title, item.href);
  });

  // props: the modeled things, each telling its shelf item's story (the hero goes first)
  for (const [id, prop] of Object.entries(SHELF_PROPS)) {
    if (!index.items.has(id)) continue;
    const item = shelf.items.find((i) => i.slug === prop.item);
    if (!item) continue;
    add(item.slug, id, prop.label, item.href, HERO_PROP[item.slug] === id);
  }

  return { bySlug, byItem, books: bookOn, binders, sectionOf };
}
