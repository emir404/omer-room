import type { Metadata } from "next";
import { ChapterPanel, ItemLink, Lede, List, metaOf } from "@/components/panels/ui";
import { getComputerApps, getObjects } from "@/lib/content/load";
import { chapterHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Work" };

/**
 * On a desktop the work lives on the monitor (the live desktop UI, ScreenLayer); this page is what
 * opens as a sheet on phones, where the monitor is too small to read.
 */
export default function ComputerPage() {
  const apps = getComputerApps();
  const label = getObjects().find((o) => o.id === "computer")?.label ?? "Work";
  return (
    <ChapterPanel eyebrow="Computer" title={label} testId="chapter-computer">
      <Lede>Where I spend most of my week.</Lede>
      <List label="Work">
        {apps.map((app) => (
          <li key={app.slug}>
            <ItemLink href={chapterHref("computer", app.slug)} title={app.data.title} subtitle={app.data.role} meta={metaOf(app.data.metrics[0])} />
          </li>
        ))}
      </List>
    </ChapterPanel>
  );
}
