/**
 * `pnpm content:check` — validates every file in /content and lists the placeholders that are
 * still waiting for real text. Exits non-zero (with the file + field) if anything is invalid.
 */
import fs from "node:fs";
import path from "node:path";
import { ContentError, loadAllContent } from "../src/lib/content/load";
import { SHELF_PROPS } from "../src/lib/shelf-props";

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

try {
  const c = loadAllContent();
  // every modeled thing on the shelf tells a shelf item's story (src/lib/shelf-props.ts)
  const slugs = new Set(c.shelfItems.map((i) => i.slug));
  for (const [prop, { item }] of Object.entries(SHELF_PROPS)) {
    if (!slugs.has(item)) throw new ContentError(`src/lib/shelf-props.ts: "${prop}" tells the story of content/shelf/${item}.md, which doesn't exist (renamed? update SHELF_PROPS)`);
  }
  console.log(
    `✓ content OK — ${c.shelfItems.length} shelf items, ${c.books.length} books, ` +
      `${c.computerApps.length} computer apps, ${c.phoneApps.length} phone apps, ${c.globePlaces.length} places`,
  );

  const todos = walk(path.join(process.cwd(), "content"))
    .map((file) => ({ file: path.relative(process.cwd(), file), count: (fs.readFileSync(file, "utf8").match(/TODO/g) ?? []).length }))
    .filter((t) => t.count > 0);
  if (todos.length) {
    const total = todos.reduce((sum, t) => sum + t.count, 0);
    console.log(`\n${total} placeholders left to fill:`);
    for (const t of todos) console.log(`  ${String(t.count).padStart(2)}  ${t.file}`);
  }
} catch (error) {
  if (error instanceof ContentError) {
    console.error(`✗ ${error.message}`);
    process.exit(1);
  }
  throw error;
}
