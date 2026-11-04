import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ContentError, getBooks, getShelfItems, getShelfMeta } from "@/lib/content/load";
import { SHELF_IDS, type ShelfId } from "@/lib/content/schemas";

export const dynamicParams = false;

/** /shelf/<section> frames a shelf; /shelf/<item> and /shelf/<book> put that thing in your hand. */
export function generateStaticParams() {
  const slugs = [...SHELF_IDS, ...getShelfItems().map((i) => i.slug), ...getBooks().map((b) => b.slug)];
  const duplicate = slugs.find((slug, i) => slugs.indexOf(slug) !== i);
  if (duplicate) throw new ContentError(`"${duplicate}" is used twice on the shelf (a section, a shelf item or a book): rename one of the files`);
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

/** The words are the caption (src/components/caption); the thing itself is in the 3D. */
export default async function ShelfItemPage({ params }: Props) {
  const { item } = await params;
  const known = isShelf(item) || getShelfItems().some((i) => i.slug === item) || getBooks().some((b) => b.slug === item);
  if (!known) notFound();
  return null;
}
