import fs from "node:fs";
import path from "node:path";
import { chapterHref, objectHref } from "../routes";
import type { ObjectId } from "../scene-contract";
import { getBooks, getComputerApps, getGlobePlaces, getLetterPage, getObjects, getPhoneApps, getShelfItems, getShelfMeta, getSite, getWindowPage } from "./load";
import type { ContentImage, ContentLink, Metric, ShelfId, Site } from "./schemas";

/**
 * The serializable slice of content the 3D scene needs (labels, spines, pins, screen icons).
 * Built on the server and passed to the client once, from the room layout.
 */
export interface SceneObject {
  id: ObjectId;
  label: string;
  description: string;
  order: number;
  href: string | null;
}

export interface SceneBook {
  slug: string;
  title: string;
  author: string;
  order: number;
  slot?: number;
  color: string;
  text: string;
  href: string;
  /** The real cover's textures for the shelf (`pnpm covers` makes them): 512 px for desktops,
   *  256 px for phones. Null until the book has a cover. */
  cover: { desktop: string; mobile: string } | null;
  featured: boolean;
}

/** The shelf's sections and what's in them: the 3D names the section plates, puts each item in
 *  your hand (its prop, else its binder: school items get one each, in order) and frames sections. */
export interface SceneShelf {
  sections: { id: ShelfId; label: string; title: string; href: string }[];
  items: { slug: string; section: Exclude<ShelfId, "books">; title: string; spine: string; role: string; href: string }[];
}

/** Everything a screen app shows (the live desktop and phone UIs render it). */
export interface ScreenApp {
  slug: string;
  title: string;
  subtitle?: string;
  role?: string;
  period?: string;
  summary: string;
  metrics: Metric[];
  html: string;
  images: ContentImage[];
  links: ContentLink[];
  cta?: { label: string; href: string };
  href: string;
}

export interface ScenePlace {
  slug: string;
  title: string;
  lat: number;
  lng: number;
  href: string;
}


export interface SceneData {
  name: string;
  firstName: string;
  tagline: string;
  now: string;
  location: string;
  email: string;
  socials: Site["socials"];
  objects: SceneObject[];
  books: SceneBook[];
  shelf: SceneShelf;
  photos: { src: string; alt: string }[];
  places: ScenePlace[];
  computer: ScreenApp[];
  phone: ScreenApp[];
  letter: { src: string; alt: string; width: number; height: number } | null;
  /** A photo from content/window.md that replaces the default view out of the window. */
  windowView: { src: string; fov: number; horizon: number } | null;
  hoop: { swish: string; miss: string[] };
}

const SPINES = ["#2F4A3A", "#8C3B2A", "#233A5E", "#C08A2B", "#5A3D5C", "#3F5F6B", "#7A4E2D", "#4B5D3A"];

/** Picks black or cream text for a spine color. */
function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? "#1E1B16" : "#F4EEE3";
}


/** public/content/books/<name>.webp and .sm.webp next to a cover, else the cover itself. */
export function coverTextures(src: string | undefined): SceneBook["cover"] {
  if (!src) return null;
  const base = src.replace(/\.(jpe?g|png|webp)$/i, "");
  const exists = (url: string) => fs.existsSync(path.join(process.cwd(), "public", url));
  const desktop = exists(`${base}.webp`) ? `${base}.webp` : src;
  const mobile = exists(`${base}.sm.webp`) ? `${base}.sm.webp` : desktop;
  return { desktop, mobile };
}

export function getSceneData(): SceneData {
  const site = getSite();
  const letter = getLetterPage();
  const windowPage = getWindowPage();
  const items = getShelfItems();
  const books = getBooks();

  return {
    name: site.name,
    firstName: site.firstName,
    tagline: site.tagline,
    now: site.now,
    location: site.location,
    email: site.email,
    socials: site.socials,
    objects: getObjects().map((o) => ({ ...o, href: objectHref(o.id) })),
    books: books.map((b, i) => {
      const color = b.data.spine?.color ?? SPINES[i % SPINES.length]!;
      return {
        slug: b.slug,
        title: b.data.title,
        author: b.data.author,
        order: b.data.order,
        ...(b.data.slot !== undefined ? { slot: b.data.slot } : {}),
        color,
        text: b.data.spine?.text ?? textOn(color),
        href: chapterHref("shelf", b.slug),
        cover: coverTextures(b.data.cover?.src),
        featured: b.data.featured,
      };
    }),
    shelf: {
      sections: getShelfMeta().shelves.map((shelf) => ({ id: shelf.id, label: shelf.label, title: shelf.title, href: chapterHref("shelf", shelf.id) })),
      items: items.map((item) => ({
        slug: item.slug,
        section: item.data.shelf,
        title: item.data.title,
        spine: item.data.spine ?? item.data.title,
        role: item.data.role,
        href: chapterHref("shelf", item.slug),
      })),
    },
    photos: items
      .filter((item) => item.data.shelf === "mun")
      .flatMap((item) => item.data.images.map((img) => ({ src: img.src, alt: img.alt }))),
    places: getGlobePlaces().map((p) => ({
      slug: p.slug,
      title: p.data.title,
      lat: p.data.lat,
      lng: p.data.lng,
      href: chapterHref("globe", p.slug),
    })),
    computer: getComputerApps().map((app) => ({
      slug: app.slug,
      title: app.data.title,
      role: app.data.role,
      period: app.data.period,
      summary: app.data.summary,
      metrics: app.data.metrics,
      html: app.html,
      images: app.data.images,
      links: app.data.links,
      href: chapterHref("computer", app.slug),
    })),
    phone: getPhoneApps().map((app) => ({
      slug: app.slug,
      title: app.data.title,
      ...(app.data.subtitle ? { subtitle: app.data.subtitle } : {}),
      summary: app.data.summary,
      metrics: app.data.metrics,
      html: app.html,
      images: app.data.images,
      links: app.data.links,
      ...(app.data.cta ? { cta: app.data.cta } : {}),
      href: chapterHref("phone", app.slug),
    })),
    letter: letter.data.letter && letter.letterSize ? { src: letter.data.letter.src, alt: letter.data.letter.alt, ...letter.letterSize } : null,
    windowView: windowPage.data.view ?? null,
    hoop: site.hoop,
  };
}
