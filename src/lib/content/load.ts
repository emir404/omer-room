import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import { z } from "zod";
import { renderMarkdown } from "../markdown";
import {
  BookSchema,
  ComputerAppSchema,
  ContactPageSchema,
  type ContentImage,
  GlobePlaceSchema,
  LetterPageSchema,
  ObjectsSchema,
  PhoneAppSchema,
  ShelfItemSchema,
  ShelfMetaSchema,
  SiteSchema,
  WindowPageSchema,
} from "./schemas";

/**
 * Reads /content at build time (and on every request in dev, so edits show up on refresh).
 * Every file is validated; a bad file throws a ContentError naming the file and the field.
 */

const ROOT = process.cwd();
const CONTENT = path.join(ROOT, "content");

export class ContentError extends Error {
  override name = "ContentError";
}

export interface Entry<T> {
  slug: string;
  file: string;
  data: T;
  /** Rendered Markdown body. */
  html: string;
}

const rel = (file: string) => path.relative(ROOT, file);

function fail(file: string, error: z.ZodError): never {
  throw new ContentError(`${rel(file)} is invalid:\n${z.prettifyError(error)}`);
}

function checkImages(file: string, list: (ContentImage | undefined)[]) {
  for (const image of list) {
    if (!image) continue;
    const onDisk = path.join(ROOT, "public", image.src);
    if (!fs.existsSync(onDisk)) {
      throw new ContentError(`${rel(file)}: image "${image.src}" not found (expected it at ${rel(onDisk)})`);
    }
  }
}

function readJson<S extends z.ZodType>(name: string, schema: S): z.infer<S> {
  const file = path.join(CONTENT, name);
  let raw: unknown;
  try {
    raw = JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (error) {
    throw new ContentError(`${rel(file)} is not valid JSON: ${(error as Error).message}`);
  }
  const result = schema.safeParse(raw);
  if (!result.success) fail(file, result.error);
  return result.data;
}

function readMarkdown<S extends z.ZodType>(file: string, schema: S): Entry<z.infer<S>> {
  const { data, content } = matter(fs.readFileSync(file, "utf8"));
  const result = schema.safeParse(data);
  if (!result.success) fail(file, result.error);
  return { slug: path.basename(file, ".md"), file: rel(file), data: result.data, html: renderMarkdown(content) };
}

function readCollection<S extends z.ZodType>(dir: string, schema: S): Entry<z.infer<S>>[] {
  const folder = path.join(CONTENT, dir);
  if (!fs.existsSync(folder)) return [];
  return fs
    .readdirSync(folder)
    .filter((name) => name.endsWith(".md") && !name.startsWith("_"))
    .sort()
    .map((name) => readMarkdown(path.join(folder, name), schema))
    .filter((entry) => !(entry.data as { draft?: boolean }).draft)
    .sort((a, b) => (a.data as { order: number }).order - (b.data as { order: number }).order);
}

// Cache in production builds only, so `pnpm dev` always shows the latest edits.
const memo = new Map<string, unknown>();
function cached<T>(key: string, load: () => T): T {
  if (process.env.NODE_ENV !== "production") return load();
  if (!memo.has(key)) memo.set(key, load());
  return memo.get(key) as T;
}

export const getSite = () => cached("site", () => readJson("site.json", SiteSchema));

export const getObjects = () =>
  cached("objects", () => [...readJson("objects.json", ObjectsSchema)].sort((a, b) => a.order - b.order));

export const getShelfMeta = () => cached("shelf", () => readJson("shelf.json", ShelfMetaSchema));

export const getShelfItems = () =>
  cached("shelf-items", () => {
    const items = readCollection("shelf", ShelfItemSchema);
    for (const item of items) checkImages(item.file, item.data.images);
    return items;
  });

export const getBooks = () =>
  cached("books", () => {
    const books = readCollection("books", BookSchema);
    const pinned = new Map<number, string>();
    for (const book of books) {
      const slot = book.data.slot;
      if (slot === undefined) continue;
      const other = pinned.get(slot);
      if (other) throw new ContentError(`${book.file}: slot ${slot} is already taken by ${other}`);
      pinned.set(slot, book.file);
    }
    return books;
  });

export const getComputerApps = () =>
  cached("computer", () => {
    const apps = readCollection("computer", ComputerAppSchema);
    for (const app of apps) checkImages(app.file, app.data.images);
    return apps;
  });

export const getPhoneApps = () =>
  cached("phone", () => {
    const apps = readCollection("phone", PhoneAppSchema);
    for (const app of apps) checkImages(app.file, app.data.images);
    return apps;
  });

export const getGlobePlaces = () =>
  cached("globe", () => {
    const places = readCollection("globe", GlobePlaceSchema);
    for (const place of places) checkImages(place.file, place.data.photos);
    return places;
  });

export const getWindowPage = () =>
  cached("window", () => {
    const page = readMarkdown(path.join(CONTENT, "window.md"), WindowPageSchema);
    checkImages(page.file, page.data.photos);
    return page;
  });

export const getLetterPage = () =>
  cached("letter", () => {
    const page = readMarkdown(path.join(CONTENT, "letter.md"), LetterPageSchema);
    checkImages(page.file, [page.data.letter, ...page.data.reactions.map((r) => r.image)]);
    return page;
  });

export const getContactPage = () =>
  cached("contact", () => readMarkdown(path.join(CONTENT, "contact.md"), ContactPageSchema));

/** Loads and validates everything (used by `pnpm content:check` and the text-only map). */
export function loadAllContent() {
  return {
    site: getSite(),
    objects: getObjects(),
    shelfMeta: getShelfMeta(),
    shelfItems: getShelfItems(),
    books: getBooks(),
    computerApps: getComputerApps(),
    phoneApps: getPhoneApps(),
    globePlaces: getGlobePlaces(),
    windowPage: getWindowPage(),
    letterPage: getLetterPage(),
    contactPage: getContactPage(),
  };
}
