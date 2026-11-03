import type { Metadata } from "next";
import { ChapterPanel, ItemLink, Lede, List } from "@/components/panels/ui";
import { getBooks, getObjects, getShelfItems, getShelfMeta } from "@/lib/content/load";
import { chapterHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Bookshelf" };

/** The shelf's index: one row per binder (the same four are labeled on the shelf itself). */
export default function ShelfPage() {
  const meta = getShelfMeta();
  const items = getShelfItems();
  const books = getBooks();
  const label = getObjects().find((o) => o.id === "shelf")?.label ?? "Bookshelf";
  const count = (id: string) => (id === "books" ? books.length : items.filter((i) => i.data.shelf === id).length);

  return (
    <ChapterPanel eyebrow="Bookshelf" title={label} testId="chapter-shelf">
      <Lede>{meta.intro}</Lede>
      <List label="Binders">
        {meta.shelves.map((shelf) => (
          <li key={shelf.id}>
            <ItemLink href={chapterHref("shelf", shelf.id)} title={shelf.title} subtitle={shelf.blurb} meta={String(count(shelf.id))} />
          </li>
        ))}
      </List>
    </ChapterPanel>
  );
}
