import { chapterHref } from "../routes";
import type { ObjectId, SectionId } from "../scene-contract";
import { getBooks, getContactPage, getGlobePlaces, getLetterPage, getObjects, getShelfItems, getShelfMeta, getSite, getWindowPage } from "./load";
import { coverTextures } from "./scene-data";
import type { ContentImage, ContentLink, Metric } from "./schemas";

/**
 * The words the room shows beside things (the captions), for every chapter except the two
 * screens, which carry their own UIs. Built on the server, passed to the client once with the
 * room layout; the text view (src/components/text) renders the same content for no-WebGL.
 */

export interface CaptionStory {
  slug: string;
  href: string;
  kicker: string;
  title: string;
  summary: string;
  metrics: Metric[];
  html: string;
  images: ContentImage[];
  links: ContentLink[];
}

export interface ShelfSection {
  id: SectionId;
  label: string;
  title: string;
  blurb: string;
  href: string;
  /** Slugs of what's in it, in shelf order (shelf items, or books for "books"). */
  entries: string[];
}

export interface BookStory {
  slug: string;
  href: string;
  title: string;
  author: string;
  takeaway: string;
  readIn?: string;
  html: string;
  cover: ContentImage | null;
  /** A small version of the cover for lists (256 px). */
  thumb: string | null;
}

export interface PlaceStory extends CaptionStory {
  country: string;
}

export interface ChapterData {
  objects: Partial<Record<ObjectId, { label: string; description: string }>>;
  shelf: { intro: string; sections: ShelfSection[] };
  /** content/shelf/*.md by slug. */
  shelfItems: Record<string, CaptionStory & { section: Exclude<SectionId, "books"> }>;
  books: Record<string, BookStory>;
  globe: { intro: string; places: PlaceStory[] };
  window: CaptionStory & { facts: { label: string; value: string }[] };
  letter: CaptionStory & {
    image: { src: string; alt: string; width: number; height: number; caption?: string } | null;
    reactions: { caption: string; url?: string; image?: ContentImage }[];
  };
  contact: {
    title: string;
    intro: string;
    html: string;
    email: string;
    calUrl: string;
    linkedin: string | null;
    location: string;
  };
}

const GLOBE_INTRO = "Every pin is a place that changed how I think. Drag the globe to spin it, or pick a pin.";

export function getChapterData(): ChapterData {
  const site = getSite();
  const meta = getShelfMeta();
  const items = getShelfItems();
  const books = getBooks();
  const windowPage = getWindowPage();
  const letter = getLetterPage();
  const contact = getContactPage();

  const shelfItems: ChapterData["shelfItems"] = {};
  for (const item of items) {
    shelfItems[item.slug] = {
      slug: item.slug,
      href: chapterHref("shelf", item.slug),
      section: item.data.shelf,
      kicker: `${item.data.role} · ${item.data.period}`,
      title: item.data.title,
      summary: item.data.summary,
      metrics: item.data.metrics,
      html: item.html,
      images: item.data.images,
      links: item.data.links,
    };
  }

  const bookStories: ChapterData["books"] = {};
  for (const book of books) {
    bookStories[book.slug] = {
      slug: book.slug,
      href: chapterHref("shelf", book.slug),
      title: book.data.title,
      author: book.data.author,
      takeaway: book.data.takeaway,
      ...(book.data.readIn ? { readIn: book.data.readIn } : {}),
      html: book.html,
      cover: book.data.cover ?? null,
      thumb: coverTextures(book.data.cover?.src)?.mobile ?? null,
    };
  }

  return {
    objects: Object.fromEntries(getObjects().map((o) => [o.id, { label: o.label, description: o.description }])),
    shelf: {
      intro: meta.intro,
      sections: meta.shelves.map((s) => ({
        id: s.id,
        label: s.label,
        title: s.title,
        blurb: s.blurb,
        href: chapterHref("shelf", s.id),
        entries: s.id === "books" ? books.map((b) => b.slug) : items.filter((i) => i.data.shelf === s.id).map((i) => i.slug),
      })),
    },
    shelfItems,
    books: bookStories,
    globe: {
      intro: GLOBE_INTRO,
      places: getGlobePlaces().map((p) => ({
        slug: p.slug,
        href: chapterHref("globe", p.slug),
        kicker: [p.data.country, p.data.when].filter(Boolean).join(" · "),
        country: p.data.country,
        title: p.data.title,
        summary: p.data.summary,
        metrics: [],
        html: p.html,
        images: p.data.photos,
        links: [],
      })),
    },
    window: {
      slug: "window",
      href: chapterHref("window"),
      kicker: windowPage.data.place,
      title: windowPage.data.title,
      summary: windowPage.data.intro,
      metrics: windowPage.data.metrics,
      html: windowPage.html,
      images: windowPage.data.photos,
      links: [],
      facts: windowPage.data.facts,
    },
    letter: {
      slug: "letter",
      href: chapterHref("letter"),
      kicker: "You might know me from this",
      title: letter.data.title,
      summary: letter.data.intro,
      metrics: letter.data.metrics,
      html: letter.html,
      images: [],
      links: [],
      image:
        letter.data.letter && letter.letterSize
          ? { src: letter.data.letter.src, alt: letter.data.letter.alt, ...letter.letterSize, ...(letter.data.letter.caption ? { caption: letter.data.letter.caption } : {}) }
          : null,
      reactions: letter.data.reactions,
    },
    contact: {
      title: contact.data.title,
      intro: contact.data.intro,
      html: contact.html,
      email: site.email,
      calUrl: site.calUrl,
      linkedin: site.socials.find((s) => s.icon === "linkedin")?.url ?? null,
      location: site.location,
    },
  };
}
