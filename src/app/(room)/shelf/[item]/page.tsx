import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ChapterPanel, Gallery, Lede, LinkList, Metrics, PhotoRing, Prose, Text } from "@/components/panels/ui";
import { ContentError, getBooks, getShelfItems, getShelfMeta } from "@/lib/content/load";

export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = [...getShelfItems().map((i) => i.slug), ...getBooks().map((b) => b.slug)];
  const duplicate = slugs.find((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicate) throw new ContentError(`"${duplicate}" is used by both a shelf item and a book — rename one of the files`);
  return slugs.map((item) => ({ item }));
}

type Props = { params: Promise<{ item: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await params;
  const entry = getShelfItems().find((i) => i.slug === item) ?? getBooks().find((b) => b.slug === item);
  return { title: entry?.data.title.replace(/^TODO:?\s*/, "") || "Bookshelf" };
}

export default async function ShelfItemPage({ params }: Props) {
  const { item } = await params;
  const shelves = getShelfMeta().shelves;

  const entry = getShelfItems().find((i) => i.slug === item);
  if (entry) {
    const shelf = shelves.find((s) => s.id === entry.data.shelf);
    const isMun = entry.data.shelf === "mun";
    return (
      <ChapterPanel eyebrow={shelf?.title ?? "Bookshelf"} title={entry.data.title} closeHref="/shelf" testId="chapter-shelf-item">
        <p className="role">
          <Text>{entry.data.role}</Text> · <Text>{entry.data.period}</Text>
        </p>
        <Lede>{entry.data.summary}</Lede>
        <Metrics items={entry.data.metrics} />
        {isMun ? <PhotoRing images={entry.data.images} /> : null}
        <Prose html={entry.html} />
        {isMun ? null : <Gallery images={entry.data.images} />}
        <LinkList links={entry.data.links} />
      </ChapterPanel>
    );
  }

  const book = getBooks().find((b) => b.slug === item);
  if (book) {
    return (
      <ChapterPanel eyebrow="Books I've read" title={book.data.title} closeHref="/shelf" testId="chapter-book">
        <p className="role">
          by <Text>{book.data.author}</Text>
          {book.data.readIn ? ` · read ${book.data.readIn}` : null}
        </p>
        <blockquote className="takeaway">
          <Text>{book.data.takeaway}</Text>
        </blockquote>
        <Prose html={book.html} />
      </ChapterPanel>
    );
  }

  notFound();
}
