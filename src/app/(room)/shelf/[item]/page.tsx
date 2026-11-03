import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ChapterPanel, Gallery, ItemLink, Lede, LinkList, List, metaOf, Metrics, Prose, Text } from "@/components/panels/ui";
import { ContentError, getBooks, getShelfItems, getShelfMeta } from "@/lib/content/load";
import { SHELF_IDS, type ShelfId } from "@/lib/content/schemas";
import { chapterHref } from "@/lib/routes";

export const dynamicParams = false;

/** /shelf/<binder> lists a binder; /shelf/<item> and /shelf/<book> open one entry. */
export function generateStaticParams() {
  const slugs = [...SHELF_IDS, ...getShelfItems().map((i) => i.slug), ...getBooks().map((b) => b.slug)];
  const duplicate = slugs.find((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicate) throw new ContentError(`"${duplicate}" is used twice on the shelf (a binder, a shelf item or a book): rename one of the files`);
  return slugs.map((item) => ({ item }));
}

type Props = { params: Promise<{ item: string }> };

const isShelf = (value: string): value is ShelfId => (SHELF_IDS as readonly string[]).includes(value);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await params;
  if (isShelf(item)) return { title: getShelfMeta().shelves.find((s) => s.id === item)?.title ?? "Bookshelf" };
  const entry = getShelfItems().find((i) => i.slug === item) ?? getBooks().find((b) => b.slug === item);
  return { title: entry?.data.title.replace(/^TODO:?\s*/, "") || "Bookshelf" };
}

export default async function ShelfItemPage({ params }: Props) {
  const { item } = await params;
  const shelves = getShelfMeta().shelves;
  const back = { href: "/shelf", label: "Bookshelf" };

  if (isShelf(item)) {
    const shelf = shelves.find((s) => s.id === item)!;
    if (item === "books") {
      return (
        <ChapterPanel eyebrow="Bookshelf" title={shelf.title} back={back} testId="chapter-binder">
          <Lede>{shelf.blurb}</Lede>
          <List label="Books">
            {getBooks().map((b) => (
              <li key={b.slug}>
                <ItemLink
                  href={chapterHref("shelf", b.slug)}
                  title={b.data.title}
                  subtitle={b.data.author}
                  lead={
                    b.data.cover ? (
                      <Image className="cover-thumb" src={b.data.cover.src} alt="" width={30} height={45} />
                    ) : (
                      <span className="cover-thumb" data-empty aria-hidden="true" />
                    )
                  }
                />
              </li>
            ))}
          </List>
        </ChapterPanel>
      );
    }
    const entries = getShelfItems().filter((i) => i.data.shelf === item);
    return (
      <ChapterPanel eyebrow="Bookshelf" title={shelf.title} back={back} testId="chapter-binder">
        <Lede>{shelf.blurb}</Lede>
        <List label={shelf.title}>
          {entries.map((i) => (
            <li key={i.slug}>
              <ItemLink href={chapterHref("shelf", i.slug)} title={i.data.title} subtitle={i.data.role} meta={metaOf(i.data.metrics[0])} />
            </li>
          ))}
        </List>
      </ChapterPanel>
    );
  }

  const entry = getShelfItems().find((i) => i.slug === item);
  if (entry) {
    const shelf = shelves.find((s) => s.id === entry.data.shelf)!;
    return (
      <ChapterPanel eyebrow={`${entry.data.role} · ${entry.data.period}`} title={entry.data.title} back={{ href: chapterHref("shelf", shelf.id), label: shelf.label }} testId="chapter-shelf-item">
        <Lede>{entry.data.summary}</Lede>
        <Metrics items={entry.data.metrics} />
        <Prose html={entry.html} />
        <Gallery images={entry.data.images} empty={entry.data.shelf === "mun" ? "Conference photos go here (they also fill the frames on the shelf)." : undefined} />
        <LinkList links={entry.data.links} />
      </ChapterPanel>
    );
  }

  const book = getBooks().find((b) => b.slug === item);
  if (book) {
    return (
      <ChapterPanel eyebrow={book.data.author} title={book.data.title} back={{ href: chapterHref("shelf", "books"), label: "Books" }} testId="chapter-book">
        {book.data.cover ? (
          <div className="book-cover">
            <Image src={book.data.cover.src} alt={book.data.cover.alt} width={168} height={252} sizes="168px" />
          </div>
        ) : null}
        <blockquote className="takeaway">
          <Text>{book.data.takeaway}</Text>
        </blockquote>
        {book.data.readIn ? <p className="sheet-meta">Read {book.data.readIn}</p> : null}
        <Prose html={book.html} />
      </ChapterPanel>
    );
  }

  notFound();
}
