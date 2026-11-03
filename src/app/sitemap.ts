import type { MetadataRoute } from "next";
import { getBooks, getComputerApps, getGlobePlaces, getPhoneApps, getShelfItems } from "@/lib/content/load";
import { CHAPTER_IDS, CHAPTERS, chapterHref } from "@/lib/routes";

const base = process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/map",
    ...CHAPTER_IDS.map((id) => CHAPTERS[id].path),
    ...getShelfItems().map((i) => chapterHref("shelf", i.slug)),
    ...getBooks().map((b) => chapterHref("shelf", b.slug)),
    ...getComputerApps().map((a) => chapterHref("computer", a.slug)),
    ...getPhoneApps().map((a) => chapterHref("phone", a.slug)),
    ...getGlobePlaces().map((p) => chapterHref("globe", p.slug)),
  ];
  return paths.map((path) => ({ url: `${base}${path}` }));
}
