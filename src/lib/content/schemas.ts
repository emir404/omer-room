import { z } from "zod";
import { OBJECT_IDS } from "../scene-contract";

/**
 * Schemas for everything in /content. The build fails with a readable message (file + field)
 * if any file doesn't match. Placeholders are allowed anywhere a URL/email is expected as long as
 * they start with "TODO" — they render highlighted so they're easy to spot on the preview.
 */

const todo = z.string().regex(/^TODO/, { message: 'placeholder text must start with "TODO"' });
const urlOrTodo = z.union([z.url(), todo]);
const emailOrTodo = z.union([z.email(), todo]);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, { message: "use a 6-digit hex color like #2F4A3A" });

export const ImageSchema = z.object({
  src: z.string().startsWith("/content/", { message: "images live in public/content/… and start with /content/" }),
  alt: z.string().min(1, { message: "describe the image for screen readers" }),
  caption: z.string().optional(),
});
export type ContentImage = z.infer<typeof ImageSchema>;

export const MetricSchema = z.object({ value: z.string().min(1), label: z.string().min(1) });
export type Metric = z.infer<typeof MetricSchema>;

export const LinkSchema = z.object({ label: z.string().min(1), url: urlOrTodo });
export type ContentLink = z.infer<typeof LinkSchema>;

const metrics = z.array(MetricSchema).default([]);
const images = z.array(ImageSchema).default([]);
const links = z.array(LinkSchema).default([]);
const draft = z.boolean().default(false);

export const SOCIAL_ICONS = ["x", "instagram", "linkedin", "youtube", "tiktok", "github", "link"] as const;

export const SiteSchema = z.object({
  name: z.string().min(1),
  firstName: z.string().min(1),
  tagline: z.string().min(1),
  /** The "now" line: shown on the desk ticker and in the top bar. */
  now: z.string().min(1).max(140),
  location: z.string(),
  email: emailOrTodo,
  calUrl: urlOrTodo,
  socials: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      label: z.string().min(1),
      handle: z.string(),
      url: urlOrTodo,
      icon: z.enum(SOCIAL_ICONS),
    }),
  ),
  seo: z.object({ title: z.string().min(1), description: z.string().min(1) }),
  hoop: z.object({ swish: z.string().min(1), miss: z.array(z.string().min(1)).min(1) }),
});
export type Site = z.infer<typeof SiteSchema>;

export const ObjectsSchema = z
  .array(
    z.object({
      id: z.enum(OBJECT_IDS),
      /** Hover label. Keep it short and playful. */
      label: z.string().min(1).max(40),
      /** Plain description: screen readers, the text-only map, mobile pins. */
      description: z.string().min(1),
      order: z.number().int(),
    }),
  )
  .superRefine((list, ctx) => {
    for (const id of OBJECT_IDS) {
      const count = list.filter((o) => o.id === id).length;
      if (count !== 1) {
        ctx.addIssue({ code: "custom", message: `object "${id}" must appear exactly once (found ${count})` });
      }
    }
  });
export type RoomObjectContent = z.infer<typeof ObjectsSchema>[number];

export const SHELF_IDS = ["school", "olympiad", "mun", "books"] as const;
export type ShelfId = (typeof SHELF_IDS)[number];

export const ShelfMetaSchema = z.object({
  intro: z.string().min(1),
  shelves: z.array(z.object({ id: z.enum(SHELF_IDS), title: z.string().min(1), blurb: z.string().min(1) })).length(4),
});
export type ShelfMeta = z.infer<typeof ShelfMetaSchema>;

export const ShelfItemSchema = z.object({
  title: z.string().min(1),
  shelf: z.enum(["school", "olympiad", "mun"]),
  order: z.number(),
  role: z.string().min(1),
  period: z.string().min(1),
  summary: z.string().min(1),
  metrics,
  images,
  links,
  draft,
});
export type ShelfItem = z.infer<typeof ShelfItemSchema>;

export const BookSchema = z.object({
  title: z.string().min(1).max(60),
  author: z.string().min(1),
  order: z.number(),
  /** Pin this book to a specific spine on the shelf (1-based). Optional. */
  slot: z.number().int().min(1).optional(),
  takeaway: z.string().min(1),
  readIn: z.string().optional(),
  spine: z.object({ color: hex, text: hex.optional() }).optional(),
  draft,
});
export type Book = z.infer<typeof BookSchema>;

export const ComputerAppSchema = z.object({
  title: z.string().min(1).max(32),
  icon: z.enum(["studio", "vc", "rocket", "folder", "briefcase", "doc"]),
  role: z.string().min(1),
  period: z.string().min(1),
  order: z.number(),
  summary: z.string().min(1),
  metrics,
  images,
  links,
  draft,
});
export type ComputerApp = z.infer<typeof ComputerAppSchema>;

export const PhoneAppSchema = z.object({
  title: z.string().min(1).max(32),
  subtitle: z.string().optional(),
  icon: z.enum(["money", "copilot", "star", "mic", "chart", "link"]),
  order: z.number(),
  summary: z.string().min(1),
  metrics,
  images,
  links,
  /** A call to action at the bottom of the app page, e.g. { label, href: "/contact" }. */
  cta: z.object({ label: z.string().min(1), href: z.string().min(1) }).optional(),
  draft,
});
export type PhoneApp = z.infer<typeof PhoneAppSchema>;

export const GlobePlaceSchema = z.object({
  title: z.string().min(1),
  country: z.string().min(1),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  order: z.number(),
  when: z.string().optional(),
  summary: z.string().min(1),
  photos: images,
  draft,
});
export type GlobePlace = z.infer<typeof GlobePlaceSchema>;

export const WindowPageSchema = z.object({
  title: z.string().min(1),
  place: z.string().min(1),
  intro: z.string().min(1),
  facts: z.array(z.object({ label: z.string().min(1), value: z.string().min(1) })).default([]),
  metrics,
  photos: images,
});
export type WindowPage = z.infer<typeof WindowPageSchema>;

export const LetterPageSchema = z.object({
  title: z.string().min(1),
  intro: z.string().min(1),
  /** The letter itself. Also drawn inside the frame on the wall. */
  letter: ImageSchema.optional(),
  metrics,
  reactions: z
    .array(z.object({ caption: z.string().min(1), url: urlOrTodo.optional(), image: ImageSchema.optional() }))
    .default([]),
});
export type LetterPage = z.infer<typeof LetterPageSchema>;

export const ContactPageSchema = z.object({ title: z.string().min(1), intro: z.string().min(1) });
export type ContactPage = z.infer<typeof ContactPageSchema>;
