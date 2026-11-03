import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { ContentImage, ContentLink, Metric } from "@/lib/content/schemas";
import { iconOf } from "@/lib/icons";

/** Server-safe building blocks for chapter content. */

const isTodo = (text: string) => /^TODO/.test(text);

/**
 * Highlights placeholders so they're impossible to miss on the preview: a whole "TODO…" string,
 * or a "TODO(Ömer): …" segment inside a longer line (up to the next "·").
 */
export function Text({ children }: { children: string }) {
  if (isTodo(children)) return <mark className="todo">{children}</mark>;
  if (!children.includes("TODO")) return <>{children}</>;
  return (
    <>
      {children.split(/(TODO(?:\(Ömer\))?:?[^·]*)/g).map((part, i) =>
        part.startsWith("TODO") ? (
          <mark key={i} className="todo">
            {part.trim()}
          </mark>
        ) : (
          part
        ),
      )}
    </>
  );
}

export function ChapterPanel({
  eyebrow,
  title,
  closeHref = "/",
  testId,
  children,
}: {
  eyebrow?: string;
  title: string;
  closeHref?: string;
  testId?: string;
  children: ReactNode;
}) {
  const toRoom = closeHref === "/";
  return (
    <article className="chapter" data-testid={testId}>
      <header className="chapter-head">
        <div>
          {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
          <h1 tabIndex={-1}>
            <Text>{title}</Text>
          </h1>
        </div>
        <Link href={closeHref} scroll={false} className="close" aria-label={toRoom ? "Close, back to the room" : "Back"}>
          <span aria-hidden="true">{toRoom ? "×" : "←"}</span>
        </Link>
      </header>
      <div className="chapter-body">{children}</div>
    </article>
  );
}

export function Lede({ children }: { children: string }) {
  return (
    <p className="lede">
      <Text>{children}</Text>
    </p>
  );
}

export function Metrics({ items }: { items: Metric[] }) {
  if (!items.length) return null;
  return (
    <dl className="metrics">
      {items.map((m) => (
        <div className="metric" key={`${m.value}-${m.label}`}>
          <dt>
            <Text>{m.label}</Text>
          </dt>
          <dd>
            <Text>{m.value}</Text>
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function Prose({ html }: { html: string }) {
  if (!html) return null;
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Gallery({ images, empty = "Photos coming soon" }: { images: ContentImage[]; empty?: string }) {
  if (!images.length) {
    return (
      <div className="gallery-empty">
        <span aria-hidden="true">▣</span> {empty}
      </div>
    );
  }
  return (
    <ul className="gallery">
      {images.map((image) => (
        <li key={image.src}>
          <figure>
            <div className="gallery-frame">
              <Image src={image.src} alt={image.alt} fill sizes="(max-width: 768px) 90vw, 420px" />
            </div>
            {image.caption ? <figcaption>{image.caption}</figcaption> : null}
          </figure>
        </li>
      ))}
    </ul>
  );
}

/** MUN photos on a slowly rotating ring (pure CSS; pauses for reduced motion). */
export function PhotoRing({ images }: { images: ContentImage[] }) {
  if (!images.length) return <Gallery images={[]} empty="Conference photos coming soon — they'll spin on a ring here" />;
  const step = 360 / images.length;
  return (
    <div className="ring" style={{ ["--n" as string]: images.length }}>
      <ul className="ring-track">
        {images.map((image, i) => (
          <li key={image.src} style={{ transform: `rotateY(${i * step}deg) translateZ(var(--ring-r))` }}>
            <Image src={image.src} alt={image.alt} fill sizes="200px" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export function LinkList({ links }: { links: ContentLink[] }) {
  if (!links.length) return null;
  return (
    <ul className="links">
      {links.map((link) => (
        <li key={link.label}>
          {isTodo(link.url) ? (
            <span>
              {link.label} <mark className="todo">{link.url}</mark>
            </span>
          ) : (
            <a href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label} <span aria-hidden="true">↗</span>
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

export function ItemLink({ href, title, meta }: { href: string; title: string; meta?: string }) {
  return (
    <Link href={href} scroll={false} className="item-link">
      <span className="item-title">
        <Text>{title}</Text>
      </span>
      {meta ? (
        <span className="item-meta">
          <Text>{meta}</Text>
        </span>
      ) : null}
      <span className="item-arrow" aria-hidden="true">
        →
      </span>
    </Link>
  );
}

export function AppIcon({ name, label }: { name: string; label?: string }) {
  const icon = iconOf(name);
  return (
    <span className="picon" style={{ ["--c" as string]: icon.color }} aria-hidden={label ? undefined : true} aria-label={label}>
      <span>{icon.glyph}</span>
    </span>
  );
}
