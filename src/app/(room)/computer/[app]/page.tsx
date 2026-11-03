import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterPanel, Gallery, Lede, LinkList, Metrics, Prose } from "@/components/panels/ui";
import { getComputerApps } from "@/lib/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return getComputerApps().map((app) => ({ app: app.slug }));
}

type Props = { params: Promise<{ app: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { app } = await params;
  return { title: getComputerApps().find((a) => a.slug === app)?.data.title ?? "Work" };
}

/** Phones: one role as a sheet. Desktops show it in the window on the monitor (OmerOS). */
export default async function ComputerAppPage({ params }: Props) {
  const { app } = await params;
  const entry = getComputerApps().find((a) => a.slug === app);
  if (!entry) notFound();
  return (
    <ChapterPanel eyebrow={`${entry.data.role} · ${entry.data.period}`} title={entry.data.title} back={{ href: "/computer", label: "Work" }} testId="chapter-computer-app">
      <Lede>{entry.data.summary}</Lede>
      <Metrics items={entry.data.metrics} />
      <Prose html={entry.html} />
      <Gallery images={entry.data.images} />
      <LinkList links={entry.data.links} />
    </ChapterPanel>
  );
}
