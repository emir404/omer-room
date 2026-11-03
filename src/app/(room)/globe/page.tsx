import type { Metadata } from "next";
import { ChapterPanel, ItemLink, Lede, List } from "@/components/panels/ui";
import { getGlobePlaces, getObjects } from "@/lib/content/load";
import { chapterHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Places" };

export default function GlobePage() {
  const places = getGlobePlaces();
  const label = getObjects().find((o) => o.id === "globe")?.label ?? "Places";
  return (
    <ChapterPanel eyebrow="Globe" title={label} testId="chapter-globe">
      <Lede>Every pin is a place that changed how I think. Drag the globe to spin it, or pick one here.</Lede>
      <List label="Places">
        {places.map((p) => (
          <li key={p.slug}>
            <ItemLink href={chapterHref("globe", p.slug)} title={p.data.title} subtitle={[p.data.country, p.data.when].filter(Boolean).join(" · ")} />
          </li>
        ))}
      </List>
    </ChapterPanel>
  );
}
