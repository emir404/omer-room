/**
 * `pnpm covers` — real book covers for the shelf. For every book in content/books it:
 *   1. finds the cover on Open Library (covers.openlibrary.org) — by `isbn`, else by title + author —
 *      and saves public/content/books/<file-name>.jpg (skipped if a cover is already there);
 *   2. makes the shelf's textures from it: <file-name>.webp (512 px wide, desktops) and
 *      <file-name>.sm.webp (256 px, phones and thumbnails);
 *   3. writes the spine color (the cover's dominant color, a touch deeper) into the book's file,
 *      unless the file already sets one.
 * Adding a book is: write its .md (title, author), run this, done.
 *
 *   pnpm covers            fetch what's missing
 *   pnpm covers --force    re-download every cover and redo the textures
 */
import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import sharp from "sharp";

const ROOT = process.cwd();
const BOOKS = path.join(ROOT, "content", "books");
const OUT = path.join(ROOT, "public", "content", "books");
const force = process.argv.includes("--force");
const UA = { "User-Agent": "omer-room covers script (personal site build)" };

async function find(title: string, author: string): Promise<string | null> {
  const query = new URLSearchParams({ title, author, limit: "5", fields: "title,author_name,cover_i,edition_count" });
  const res = await fetch(`https://openlibrary.org/search.json?${query}`, { headers: UA });
  if (!res.ok) return null;
  const data = (await res.json()) as { docs: { cover_i?: number; edition_count?: number }[] };
  // the work with the most editions that has a cover: usually the edition people know
  const doc = data.docs.filter((d) => d.cover_i).sort((a, b) => (b.edition_count ?? 0) - (a.edition_count ?? 0))[0];
  return doc?.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg` : null;
}

async function download(url: string): Promise<Buffer | null> {
  const res = await fetch(url, { headers: UA });
  if (!res.ok) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  // Open Library answers a missing cover with a tiny placeholder
  const meta = await sharp(buffer).metadata();
  return (meta.width ?? 0) >= 120 ? buffer : null;
}

const hex = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0");

/** Writes `spine: { color }` into the frontmatter, keeping the rest of the file as it is. */
function setSpineColor(file: string, color: string) {
  const text = fs.readFileSync(file, "utf8");
  const end = text.indexOf("\n---", 3);
  if (end < 0) return;
  fs.writeFileSync(file, `${text.slice(0, end)}\nspine:\n  color: "${color}"${text.slice(end)}`);
}

fs.mkdirSync(OUT, { recursive: true });
let fetched = 0;
let missing = 0;
for (const name of fs.readdirSync(BOOKS).filter((f) => f.endsWith(".md") && !f.startsWith("_")).sort()) {
  const slug = path.basename(name, ".md");
  const file = path.join(BOOKS, name);
  const { data } = matter(fs.readFileSync(file, "utf8"));
  const title = String(data.title ?? "");
  const author = String(data.author ?? "");
  if (!title || title.startsWith("TODO")) continue;
  const jpg = path.join(OUT, `${slug}.jpg`);

  if (!fs.existsSync(jpg) || force) {
    const isbn = data.isbn ? String(data.isbn).replace(/[^0-9X]/gi, "") : "";
    const url = isbn ? `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false` : await find(title, author.replace(/^TODO.*/, ""));
    const image = url ? await download(url) : null;
    if (!image) {
      console.warn(`! ${slug}: no cover found on Open Library (add one by hand at public/content/books/${slug}.jpg)`);
      missing++;
      continue;
    }
    await sharp(image).jpeg({ quality: 88, mozjpeg: true }).toFile(jpg);
    fetched++;
    console.log(`✓ ${slug}: ${path.relative(ROOT, jpg)}`);
  }

  // the shelf's textures (always regenerated: cheap, and they follow the jpg)
  await sharp(jpg).resize({ width: 512, withoutEnlargement: true }).webp({ quality: 80 }).toFile(path.join(OUT, `${slug}.webp`));
  await sharp(jpg).resize({ width: 256, withoutEnlargement: true }).webp({ quality: 78 }).toFile(path.join(OUT, `${slug}.sm.webp`));

  if (!data.spine) {
    // a spine usually carries the cover's ground: average the cover's outer border, a touch deeper
    const W = 32;
    const H = 48;
    const { data: px } = await sharp(jpg).resize(W, H, { fit: "fill" }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let r = 0;
    let g = 0;
    let b = 0;
    let n = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (x > 2 && x < W - 3 && y > 2 && y < H - 3) continue;
        const i = (y * W + x) * 3;
        r += px[i]!;
        g += px[i + 1]!;
        b += px[i + 2]!;
        n++;
      }
    }
    const color = `#${hex((r / n) * 0.9)}${hex((g / n) * 0.9)}${hex((b / n) * 0.9)}`;
    setSpineColor(file, color);
    console.log(`  ${slug}: spine ${color}`);
  }
}
console.log(fetched ? `${fetched} cover(s) fetched.` : "No new covers.", missing ? `${missing} not found.` : "");
