import type { FocusId, ObjectId } from "./scene-contract";

/**
 * Routes drive the camera: every chapter is a real URL, and the URL decides what the camera
 * looks at. "panel" chapters open a side panel / bottom sheet; "screen" chapters open their UI
 * on the object's screen (computer, phone).
 */
export type ChapterKind = "panel" | "screen";

export interface Chapter {
  id: ObjectId;
  path: `/${string}`;
  kind: ChapterKind;
  /** Short name used in the text-only map, breadcrumbs and <title>. */
  title: string;
}

export const CHAPTERS = {
  shelf: { id: "shelf", path: "/shelf", kind: "panel", title: "Bookshelf" },
  computer: { id: "computer", path: "/computer", kind: "screen", title: "Computer" },
  phone: { id: "phone", path: "/phone", kind: "screen", title: "Phone" },
  globe: { id: "globe", path: "/globe", kind: "panel", title: "Globe" },
  window: { id: "window", path: "/window", kind: "panel", title: "Window" },
  letter: { id: "letter", path: "/letter", kind: "panel", title: "The letter" },
  contact: { id: "contact", path: "/contact", kind: "panel", title: "Mailbox" },
} as const satisfies Record<string, Chapter>;

export type ChapterId = keyof typeof CHAPTERS;
export const CHAPTER_IDS = Object.keys(CHAPTERS) as ChapterId[];

export function isChapterId(value: string): value is ChapterId {
  return Object.hasOwn(CHAPTERS, value);
}

export interface RouteState {
  focus: FocusId;
  chapter: ChapterId | null;
  item: string | null;
}

export function parsePath(pathname: string): RouteState {
  const clean = pathname.split(/[?#]/)[0]!.replace(/\/+$/, "") || "/";
  const [, first, second] = clean.split("/");
  if (first && isChapterId(first)) {
    return { focus: first, chapter: first, item: second ? decodeURIComponent(second) : null };
  }
  return { focus: "room", chapter: null, item: null };
}

/** Where Esc / the close button goes: item → chapter → room. Never history.back(). */
export function parentPath(pathname: string): string {
  const { chapter, item } = parsePath(pathname);
  if (chapter && item) return CHAPTERS[chapter].path;
  return "/";
}

export function chapterHref(id: ChapterId, item?: string): string {
  return item ? `${CHAPTERS[id].path}/${encodeURIComponent(item)}` : CHAPTERS[id].path;
}

/** The URL an object opens, or null for objects that are just toys (the hoop). */
export function objectHref(id: ObjectId): string | null {
  return isChapterId(id) ? CHAPTERS[id].path : null;
}
