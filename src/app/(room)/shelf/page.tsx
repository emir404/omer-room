import type { Metadata } from "next";
import { ChapterPanel, ItemLink, Lede } from "@/components/panels/ui";
import { getBooks, getObjects, getShelfItems, getShelfMeta } from "@/lib/content/load";
import { chapterHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Bookshelf" };

export default function ShelfPage() {
  const meta = getShelfMeta();
  const items = getShelfItems();
  const books = getBooks();
  const label = getObjects().find((o) => o.id === "shelf")?.label ?? "Bookshelf";

  return (
    <ChapterPanel eyebrow="Bookshelf" title={label} testId="chapter-shelf">
      <Lede>{meta.intro}</Lede>
      {meta.shelves.map((shelf) => {
        const entries =
          shelf.id === "books"
            ? books.map((b) => ({ href: chapterHref("shelf", b.slug), title: b.data.title, meta: b.data.author }))
            : items.filter((i) => i.data.shelf === shelf.id).map((i) => ({ href: chapterHref("shelf", i.slug), title: i.data.title, meta: i.data.role }));
        return (
          <section key={shelf.id} className="section" aria-labelledby={`shelf-${shelf.id}`}>
            <h2 id={`shelf-${shelf.id}`}>{shelf.title}</h2>
            <p className="section-blurb">{shelf.blurb}</p>
            <ul className="item-list">
              {entries.map((entry) => (
                <li key={entry.href}>
                  <ItemLink {...entry} />
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </ChapterPanel>
  );
}
