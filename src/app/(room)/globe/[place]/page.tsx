import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterPanel, Gallery, Lede, Prose } from "@/components/panels/ui";
import { getGlobePlaces } from "@/lib/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  return getGlobePlaces().map((p) => ({ place: p.slug }));
}

type Props = { params: Promise<{ place: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { place } = await params;
  return { title: getGlobePlaces().find((p) => p.slug === place)?.data.title ?? "Places" };
}

export default async function PlacePage({ params }: Props) {
  const { place } = await params;
  const entry = getGlobePlaces().find((p) => p.slug === place);
  if (!entry) notFound();
  return (
    <ChapterPanel eyebrow={[entry.data.country, entry.data.when].filter(Boolean).join(" · ")} title={entry.data.title} closeHref="/globe" testId="chapter-place">
      <Lede>{entry.data.summary}</Lede>
      <Prose html={entry.html} />
      <Gallery images={entry.data.photos} />
    </ChapterPanel>
  );
}
