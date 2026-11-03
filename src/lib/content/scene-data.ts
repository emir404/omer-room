import { chapterHref, objectHref } from "../routes";
import type { ObjectId } from "../scene-contract";
import { getBooks, getComputerApps, getGlobePlaces, getLetterPage, getObjects, getPhoneApps, getShelfItems, getSite } from "./load";

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
}

export interface ScenePlace {
  slug: string;
  title: string;
  lat: number;
  lng: number;
  href: string;
}

export interface SceneScreenApp {
  key: string;
  title: string;
  icon: string;
  /** Internal route, external URL, or null for a placeholder that isn't wired yet. */
  href: string | null;
  external: boolean;
}

export interface SceneData {
  name: string;
  firstName: string;
  now: string;
  objects: SceneObject[];
  books: SceneBook[];
  photos: { src: string; alt: string }[];
  places: ScenePlace[];
  osApps: SceneScreenApp[];
  phoneApps: SceneScreenApp[];
  letterImage: string | null;
  hoop: { swish: string; miss: string[] };
}

const SPINES = ["#2F4A3A", "#8C3B2A", "#233A5E", "#C08A2B", "#5A3D5C", "#3F5F6B", "#7A4E2D", "#4B5D3A"];

/** Picks black or cream text for a spine color. */
function textOn(hex: string): string {
  const n = Number.parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.6 ? "#1E1B16" : "#F4EEE3";
}

const isUrl = (value: string) => /^https?:\/\//.test(value);

export function getSceneData(): SceneData {
  const site = getSite();
  const letter = getLetterPage();

  return {
    name: site.name,
    firstName: site.firstName,
    now: site.now,
    objects: getObjects().map((o) => ({ ...o, href: objectHref(o.id) })),
    books: getBooks().map((b, i) => {
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
      };
    }),
    photos: getShelfItems()
      .filter((item) => item.data.shelf === "mun")
      .flatMap((item) => item.data.images.map((img) => ({ src: img.src, alt: img.alt }))),
    places: getGlobePlaces().map((p) => ({
      slug: p.slug,
      title: p.data.title,
      lat: p.data.lat,
      lng: p.data.lng,
      href: chapterHref("globe", p.slug),
    })),
    osApps: getComputerApps().map((app) => ({
      key: app.slug,
      title: app.data.title,
      icon: app.data.icon,
      href: chapterHref("computer", app.slug),
      external: false,
    })),
    phoneApps: [
      ...getPhoneApps().map((app) => ({
        key: app.slug,
        title: app.data.title,
        icon: app.data.icon,
        href: chapterHref("phone", app.slug),
        external: false,
      })),
      ...site.socials.map((s) => ({
        key: s.id,
        title: s.label,
        icon: s.icon,
        href: isUrl(s.url) ? s.url : null,
        external: true,
      })),
    ],
    letterImage: letter.data.letter?.src ?? null,
    hoop: site.hoop,
  };
}
