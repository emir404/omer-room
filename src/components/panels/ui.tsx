import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import type { ContentImage, ContentLink, Metric } from "@/lib/content/schemas";

/** Server-safe building blocks for content: the captions, the screens and the text view. */

const isTodo = (text: string) => /^TODO/.test(text);

/** A headline number that reads on its own: "9" → "9 teams", "$250K" → "$250K raised". */
export function metaOf(metric: Metric | undefined): string | undefined {
  if (!metric) return undefined;
  const letters = metric.value.replace(/[^a-zA-Zğüşıöç]/g, "").length;
  if (letters >= 3) return metric.value;
  const word = metric.label.split(/\s+/).find((w) => !/^(of|in|for|the|a|an|at|to|on|by|with)$/i.test(w));
  return word ? `${metric.value} ${word.replace(/[,.;:]$/, "")}` : metric.value;
}
export const isUrl = (value: string) => /^https?:\/\//.test(value);

/**
 * Highlights placeholders so they're impossible to miss on the preview: a whole "TODO…" string,
 * or a "TODO(Ömer): …" segment inside a longer line (up to the next "·").
 */
export function Text({ children }: { children: string }) {
  if (!children.includes("TODO")) return <>{children}</>;
  return (
    <>
      {children.split(/(TODO(?:\(Ömer\))?:?[^·]*)/g).map((part, i) =>
        part.startsWith("TODO") ? (
          <mark key={i} className="todo">
            {part.replace(/^TODO(\(Ömer\))?:?\s*/, "").trim()}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

/** One number gets to be big; the rest are rows. */
export function Metrics({ items }: { items: Metric[] }) {
  if (!items.length) return null;
  const [hero, ...rest] = items;
  return (
    <div className="stats">
      <div className="stat-hero">
        <span className="stat-value">
          <Text>{hero!.value}</Text>
        </span>
        <span className="stat-label">
          <Text>{hero!.label}</Text>
        </span>
      </div>
      {rest.length ? (
        <ul className="stat-list">
          {rest.map((m) => (
            <li className="stat-row" data-order="value" key={`${m.value}-${m.label}`}>
              <span className="stat-row-value">
                <Text>{m.value}</Text>
              </span>
              <span className="stat-row-label">
                <Text>{m.label}</Text>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** Markdown body. Paragraphs that are only a TODO become a quiet "to add" note. */
export function Prose({ html }: { html: string }) {
  if (!html) return null;
  const marked = html.replace(/<p><mark class="todo">/g, '<p class="prose-todo"><mark class="todo">');
  return <div className="prose" dangerouslySetInnerHTML={{ __html: marked }} />;
}

export function Gallery({ images, empty }: { images: ContentImage[]; empty?: string }) {
  if (!images.length) return empty ? <p className="gallery-empty">{empty}</p> : null;
  return (
    <ul className="gallery">
      {images.map((image) => (
        <li key={image.src}>
          <figure>
            <div className="gallery-frame">
              <Image src={image.src} alt={image.alt} fill sizes="(max-width: 768px) 90vw, 400px" />
            </div>
            {image.caption ? <figcaption>{image.caption}</figcaption> : null}
          </figure>
        </li>
      ))}
    </ul>
  );
}

/** External links as quiet pill buttons; unfinished ones show what's missing. */
export function LinkList({ links }: { links: ContentLink[] }) {
  if (!links.length) return null;
  return (
    <ul className="pills">
      {links.map((link) => (
        <li key={link.label}>
          {isTodo(link.url) ? (
            <span className="pill" data-todo>
              {link.label} <Text>{link.url}</Text>
            </span>
          ) : (
            <a href={link.url} target="_blank" rel="noopener noreferrer" className="pill">
              {link.label}
              <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}
