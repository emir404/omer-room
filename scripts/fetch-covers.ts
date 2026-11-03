/**
 * `pnpm covers` — real book covers for the shelf. For every book in content/books with an `isbn`
 * and no cover yet, downloads the cover from Open Library (covers.openlibrary.org) to
 * public/content/books/<file-name>.jpg. The site picks a cover at that path up by itself, so
 * adding a book is: write its .md with an isbn, run this, done.
 *
 *   pnpm covers            fetch missing covers
 *   pnpm covers --force    re-download every cover
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";

const ROOT = process.cwd();
const BOOKS = path.join(ROOT, "content", "books");
const OUT = path.join(ROOT, "public", "content", "books");
const force = process.argv.includes("--force");

fs.mkdirSync(OUT, { recursive: true });
let fetched = 0;
for (const file of fs.readdirSync(BOOKS).filter((f) => f.endsWith(".md") && !f.startsWith("_"))) {
  const slug = path.basename(file, ".md");
  const { data } = matter(fs.readFileSync(path.join(BOOKS, file), "utf8"));
  const isbn = typeof data.isbn === "string" || typeof data.isbn === "number" ? String(data.isbn).replace(/[^0-9X]/gi, "") : "";
  if (!isbn) continue;
  const dest = path.join(OUT, `${slug}.jpg`);
  if (fs.existsSync(dest) && !force) {
    console.log(`· ${slug}: cover already there`);
    continue;
  }
  // default=false: a 404 instead of Open Library's blank placeholder when there's no cover
  const res = await fetch(`https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`);
  if (!res.ok) {
    console.warn(`! ${slug}: no cover on Open Library for ISBN ${isbn} (add one by hand at public/content/books/${slug}.jpg)`);
    continue;
  }
  fs.writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
  fetched++;
  console.log(`✓ ${slug}: ${path.relative(ROOT, dest)}`);
}
console.log(fetched ? `${fetched} cover(s) fetched.` : "Nothing to fetch.");
