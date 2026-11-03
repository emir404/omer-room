import type { Metadata } from "next";
import { ChapterPanel, ItemLink, Lede } from "@/components/panels/ui";
import { getGlobePlaces, getObjects } from "@/lib/content/load";
import { chapterHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Places" };

export default function GlobePage() {
  const places = getGlobePlaces();
  const label = getObjects().find((o) => o.id === "globe")?.label ?? "Places";
  return (
    <ChapterPanel eyebrow="Globe" title={label} testId="chapter-globe">
      <Lede>Every pin is a place that changed how I think. Click one on the globe, or here.</Lede>
      <ul className="item-list">
        {places.map((p) => (
          <li key={p.slug}>
            <ItemLink href={chapterHref("globe", p.slug)} title={p.data.title} meta={[p.data.country, p.data.when].filter(Boolean).join(" · ")} />
          </li>
        ))}
      </ul>
    </ChapterPanel>
  );
}
