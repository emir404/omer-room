import { ArrowUpRight, ImagePlus } from "lucide-react";
import { Window } from "@/components/kit/window";
import { Text } from "@/components/panels/ui";
import type { ScreenApp, ScreenImage } from "@/lib/content/scene-data";
import type { ContentLink, Metric } from "@/lib/content/schemas";

/** Building blocks shared by the desktop (OmerOS) and the phone (PhoneUI). No hooks, no state. */

export const isUrl = (value: string) => /^https?:\/\//.test(value);
export const isTodo = (value: string | undefined) => !value || value.startsWith("TODO");

/** The links that go somewhere (the rest are still TODO placeholders). */
export const liveLinks = (app: ScreenApp) => app.links.filter((link) => isUrl(link.url));

/** "witharc.co" from "https://witharc.co/…", for a link that has no better label. */
export const hostOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

/** A caption that is just an address ("witharc.co") says the image is that website. */
const isAddress = (caption: string | undefined) => !!caption && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/\S*)?$/i.test(caption);

/** A line of copy that is only a placeholder ("TODO(Ömer): …"): drawn as a quiet note, not as copy. */
export function Copy({ text, className, noteClass }: { text: string; className: string; noteClass?: string }) {
  if (isTodo(text)) {
    return (
      <p className={`todo-note${noteClass ? ` ${noteClass}` : ""}`}>
        <Text>{text}</Text>
      </p>
    );
  }
  return (
    <p className={className}>
      <Text>{text}</Text>
    </p>
  );
}

/** A role's "Co-Founder & CEO · Grades 11–12 · 30 hrs/week" line, each part with its own TODO mark. */
export function MetaLine({ parts, className }: { parts: (string | undefined)[]; className?: string }) {
  const shown = parts.flatMap((part) => (part ? part.split(" · ") : []));
  if (!shown.length) return null;
  return (
    <p className={className}>
      {shown.map((part, i) => (
        <span key={`${i}-${part}`}>
          {i ? <span aria-hidden="true"> · </span> : null}
          <Text>{part}</Text>
        </span>
      ))}
    </p>
  );
}

/** One number gets to be big; the rest are rows ("$120K+ revenue generated"). */
export function Numbers({ items, className }: { items: Metric[]; className?: string }) {
  if (!items.length) return null;
  const [hero, ...rest] = items;
  return (
    <section className={`nums${className ? ` ${className}` : ""}`} aria-label="Numbers" data-rows={rest.length}>
      <div className="nums-hero">
        <span className="nums-value">
          <Text>{hero!.value}</Text>
        </span>
        <span className="nums-label">
          <Text>{hero!.label}</Text>
        </span>
      </div>
      {rest.length ? (
        <ul className="nums-rows">
          {rest.map((m) => (
            <li key={`${m.value}-${m.label}`} className="nums-row">
              <span className="nums-row-value">
                <Text>{m.value}</Text>
              </span>
              <span className="nums-row-label">
                <Text>{m.label}</Text>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * The Markdown body: its headings demoted one level (the screen's page title is the h2), and a
 * paragraph that is only a placeholder drawn as a quiet "to add" note.
 */
export function Story({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  const marked = html
    .replace(/<(\/?)h2>/g, "<$1h3>")
    .replace(/<p><mark class="todo">/g, '<p class="todo-note"><mark class="todo">');
  return <div className={`story${className ? ` ${className}` : ""}`} dangerouslySetInnerHTML={{ __html: marked }} />;
}

/**
 * Screenshots at their own proportions, reserved before they load, never loaded before they're
 * needed. `browser`: a screenshot captioned with an address sits in the kit's browser chrome (the
 * address in its field) rather than as a bare slab of someone's page. `slot`: with no images yet,
 * a tidy "to add" tile holds their place.
 */
export function Shots({ images, className, browser, slot }: { images: ScreenImage[]; className?: string; browser?: boolean; slot?: string }) {
  if (!images.length) {
    return slot ? (
      <div className={`shots-slot${className ? ` ${className}-slot` : ""}`}>
        <ImagePlus size={22} strokeWidth={1.6} aria-hidden />
        <p>
          <mark className="todo">screenshots or photos</mark>
        </p>
        <p className="shots-slot-path">{slot}</p>
      </div>
    ) : null;
  }
  return (
    <ul className={`shots${className ? ` ${className}` : ""}`}>
      {images.map((image) => {
        const img = (
          <span className="shot-frame" style={image.width && image.height ? { aspectRatio: `${image.width} / ${image.height}` } : undefined}>
            {/* eslint-disable-next-line @next/next/no-img-element -- laid out inside a transformed screen; the file is already a sized WebP */}
            <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" draggable={false} />
          </span>
        );
        const site = browser && isAddress(image.caption);
        return (
          <li key={image.src}>
            <figure>
              {site ? (
                <Window url={image.caption} urlShape="pill" lights="grey" className="shot-browser">
                  {img}
                </Window>
              ) : (
                img
              )}
              {image.caption && !site ? <figcaption>{image.caption}</figcaption> : null}
            </figure>
          </li>
        );
      })}
    </ul>
  );
}

/** External links as pills; a placeholder shows what is missing and goes nowhere. */
export function LinkPills({ links, className }: { links: ContentLink[]; className?: string }) {
  if (!links.length) return null;
  return (
    <ul className={`link-pills${className ? ` ${className}` : ""}`}>
      {links.map((link) => (
        <li key={link.label}>
          {isUrl(link.url) ? (
            <a className="link-pill" href={link.url} target="_blank" rel="noopener noreferrer">
              {link.label}
              <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
            </a>
          ) : (
            <span className="link-pill" data-todo>
              {link.label} <Text>{link.url}</Text>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
