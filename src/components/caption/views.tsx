"use client";

import { ArrowUpRight, Calendar, ChevronLeft, ChevronRight, Mail, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Gallery, isUrl, LinkList, metaOf, Metrics, Prose, Text } from "@/components/panels/ui";
import { Row } from "@/components/ui/Row";
import type { BookStory, CaptionStory, ChapterData, ShelfSection } from "@/lib/content/chapters";
import { chapterHref } from "@/lib/routes";
import { SECTION_IDS, type SectionId } from "@/lib/scene-contract";
import { useRoom } from "@/lib/store";
import { storeOverride, type TimeOverride } from "@/lib/time-of-day";

/**
 * What the room says beside the thing you're looking at. Each chapter (and each thing on the shelf,
 * each pin on the globe) resolves to one view; CaptionHost places it next to the object, over the
 * dimmed room. Light text on the dark: the object is the lit thing, this is its label.
 */

export type ViewKind = "shelf" | "section" | "item" | "book" | "globe" | "place" | "window" | "letter" | "contact";

export interface CaptionView {
  key: string;
  kind: ViewKind;
  /** Where Esc and the back link go. */
  back: { href: string; label: string } | null;
  /** Held in the hand (drag to turn it). */
  holding: boolean;
  node: ReactNode;
}

const isSection = (value: string): value is SectionId => (SECTION_IDS as readonly string[]).includes(value);

function Head({ kicker, title }: { kicker?: string; title: string }) {
  return (
    <header className="cap-head">
      {kicker ? (
        <p className="cap-kicker">
          <Text>{kicker}</Text>
        </p>
      ) : null}
      <h1 className="cap-title" tabIndex={-1}>
        <Text>{title}</Text>
      </h1>
    </header>
  );
}

function Summary({ children }: { children: string }) {
  return (
    <p className="cap-summary">
      <Text>{children}</Text>
    </p>
  );
}

function Rows({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className="cap-rows" aria-label={label}>
      {children}
    </ul>
  );
}

function RowLink({ href, title, subtitle, meta, lead }: { href: string; title: string; subtitle?: string; meta?: string; lead?: ReactNode }) {
  return (
    <li>
      <Link href={href} scroll={false} className="cap-row">
        <Row lead={lead} title={<Text>{title}</Text>} subtitle={subtitle ? <Text>{subtitle}</Text> : undefined} meta={meta ? <Text>{meta}</Text> : undefined}>
          <ChevronRight className="cap-chevron" size={16} strokeWidth={2} aria-hidden />
        </Row>
      </Link>
    </li>
  );
}

/** Day or night outside (and in the room): follows your clock until you pick one. */
function LightSwitch() {
  const current = useRoom((s) => s.timeOverride);
  const options: { value: TimeOverride; label: string }[] = [
    { value: "auto", label: "Your time" },
    { value: "day", label: "Day" },
    { value: "night", label: "Night" },
  ];
  return (
    <div className="cap-light" role="radiogroup" aria-label="Light outside">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          className="cap-light-option"
          onClick={() => {
            storeOverride(o.value);
            useRoom.setState({ timeOverride: o.value });
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Previous / next along a list, so you can walk the shelf (or the globe) without stepping back. */
function Steps({ list, current, titleOf }: { list: { slug: string; href: string }[]; current: string; titleOf: (slug: string) => string }) {
  const at = list.findIndex((e) => e.slug === current);
  if (at < 0 || list.length < 2) return null;
  const prev = list[(at - 1 + list.length) % list.length]!;
  const next = list[(at + 1) % list.length]!;
  return (
    <nav className="cap-steps" aria-label="More on this shelf">
      <Link href={prev.href} scroll={false} className="cap-step" data-dir="prev" rel="prev">
        <ChevronLeft size={15} strokeWidth={2.2} aria-hidden />
        <span>
          <Text>{titleOf(prev.slug)}</Text>
        </span>
      </Link>
      <span className="cap-count" aria-hidden="true">
        {at + 1} / {list.length}
      </span>
      <Link href={next.href} scroll={false} className="cap-step" data-dir="next" rel="next">
        <span>
          <Text>{titleOf(next.slug)}</Text>
        </span>
        <ChevronRight size={15} strokeWidth={2.2} aria-hidden />
      </Link>
    </nav>
  );
}

function Story({ story }: { story: CaptionStory }) {
  return (
    <>
      <Head kicker={story.kicker} title={story.title} />
      {story.summary ? <Summary>{story.summary}</Summary> : null}
      <Metrics items={story.metrics} />
      <Prose html={story.html} />
      <Gallery images={story.images} />
      <LinkList links={story.links} />
    </>
  );
}

function BookBody({ book }: { book: BookStory }) {
  return (
    <>
      <Head kicker={book.readIn ? `${book.author} · read ${book.readIn}` : book.author} title={book.title} />
      <blockquote className="cap-takeaway">
        <Text>{book.takeaway}</Text>
      </blockquote>
      <Prose html={book.html} />
    </>
  );
}

function sectionOf(data: ChapterData, id: SectionId): ShelfSection | undefined {
  return data.shelf.sections.find((s) => s.id === id);
}

function shelfEntries(data: ChapterData, section: ShelfSection) {
  return section.entries.map((slug) => ({ slug, href: chapterHref("shelf", slug) }));
}

/** The view for a URL, or null where the room shows no caption (the overview, the screens). */
export function resolveView(data: ChapterData, chapter: string | null, item: string | null): CaptionView | null {
  const label = (id: keyof ChapterData["objects"]) => data.objects[id]?.label ?? "";
  const toRoom = null;

  switch (chapter) {
    case "shelf": {
      if (!item) {
        return {
          key: "shelf",
          kind: "shelf",
          back: toRoom,
          holding: false,
          node: (
            <>
              <Head kicker="Bookshelf" title={label("shelf")} />
              <Summary>{data.shelf.intro}</Summary>
              <Rows label="Shelves">
                {data.shelf.sections.map((s) => (
                  <RowLink key={s.id} href={s.href} title={s.title} subtitle={s.blurb} meta={String(s.entries.length)} />
                ))}
              </Rows>
            </>
          ),
        };
      }
      if (isSection(item)) {
        const section = sectionOf(data, item);
        if (!section) return null;
        return {
          key: `section:${item}`,
          kind: "section",
          back: { href: "/shelf", label: "Bookshelf" },
          holding: false,
          node: (
            <>
              <Head kicker="Bookshelf" title={section.title} />
              <Summary>{section.blurb}</Summary>
              <Rows label={section.title}>
                {section.id === "books"
                  ? section.entries.map((slug) => {
                      const b = data.books[slug]!;
                      return (
                        <RowLink
                          key={slug}
                          href={b.href}
                          title={b.title}
                          subtitle={b.author}
                          lead={
                            b.thumb ? (
                              // eslint-disable-next-line @next/next/no-img-element -- a 30px thumbnail of the cover the shelf already shows
                              <img className="cap-cover" src={b.thumb} alt="" width={30} height={45} loading="lazy" />
                            ) : (
                              <span className="cap-cover" data-empty aria-hidden="true" />
                            )
                          }
                        />
                      );
                    })
                  : section.entries.map((slug) => {
                      const i = data.shelfItems[slug]!;
                      return <RowLink key={slug} href={i.href} title={i.title} subtitle={i.kicker.split(" · ")[0]} meta={metaOf(i.metrics[0])} />;
                    })}
              </Rows>
            </>
          ),
        };
      }
      const story = data.shelfItems[item];
      if (story) {
        const section = sectionOf(data, story.section)!;
        return {
          key: `item:${item}`,
          kind: "item",
          back: { href: section.href, label: section.title },
          holding: true,
          node: (
            <>
              <Story story={story} />
              <Steps list={shelfEntries(data, section)} current={item} titleOf={(slug) => data.shelfItems[slug]?.title ?? slug} />
            </>
          ),
        };
      }
      const book = data.books[item];
      if (book) {
        const section = sectionOf(data, "books")!;
        return {
          key: `book:${item}`,
          kind: "book",
          back: { href: section.href, label: section.title },
          holding: true,
          node: (
            <>
              <BookBody book={book} />
              <Steps list={shelfEntries(data, section)} current={item} titleOf={(slug) => data.books[slug]?.title ?? slug} />
            </>
          ),
        };
      }
      return null;
    }
    case "globe": {
      const places = data.globe.places;
      const place = item ? places.find((p) => p.slug === item) : undefined;
      if (place) {
        return {
          key: `place:${place.slug}`,
          kind: "place",
          back: { href: "/globe", label: "Places" },
          holding: false,
          node: (
            <>
              <Story story={place} />
              <Steps list={places} current={place.slug} titleOf={(slug) => places.find((p) => p.slug === slug)?.title ?? slug} />
            </>
          ),
        };
      }
      return {
        key: "globe",
        kind: "globe",
        back: toRoom,
        holding: false,
        node: (
          <>
            <Head kicker="Globe" title={label("globe")} />
            <Summary>{data.globe.intro}</Summary>
            <Rows label="Places">
              {places.map((p) => (
                <RowLink key={p.slug} href={p.href} title={p.title} subtitle={p.kicker} />
              ))}
            </Rows>
          </>
        ),
      };
    }
    case "window": {
      const page = data.window;
      return {
        key: "window",
        kind: "window",
        back: toRoom,
        holding: false,
        node: (
          <>
            <Head kicker={page.kicker} title={page.title} />
            <Summary>{page.summary}</Summary>
            <LightSwitch />
            <Metrics items={page.metrics} />
            {page.facts.length ? (
              <dl className="cap-facts">
                {page.facts.map((fact) => (
                  <div key={fact.label}>
                    <dt>{fact.label}</dt>
                    <dd>
                      <Text>{fact.value}</Text>
                    </dd>
                  </div>
                ))}
              </dl>
            ) : null}
            <Prose html={page.html} />
            <Gallery images={page.images} />
          </>
        ),
      };
    }
    case "letter": {
      const page = data.letter;
      return {
        key: "letter",
        kind: "letter",
        back: toRoom,
        holding: false,
        node: (
          <>
            <Head kicker={page.kicker} title={page.title} />
            <Summary>{page.summary}</Summary>
            <Metrics items={page.metrics} />
            <Prose html={page.html} />
            {page.image ? (
              <ul className="pills">
                <li>
                  <a href={page.image.src} target="_blank" rel="noopener noreferrer" className="pill">
                    Open the letter full size
                    <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                  </a>
                </li>
              </ul>
            ) : (
              <p className="cap-note">The letter goes in the frame, exactly as it is, once its image is added (content/letter.md).</p>
            )}
            {page.reactions.length ? (
              <section className="cap-section" aria-labelledby="cap-reactions">
                <h2 id="cap-reactions">How the internet took it</h2>
                <ul className="cap-reactions">
                  {page.reactions.map((r) => (
                    <li key={r.caption}>
                      {r.image ? (
                        // eslint-disable-next-line @next/next/no-img-element -- screenshots, shown as they are
                        <img src={r.image.src} alt={r.image.alt} loading="lazy" />
                      ) : null}
                      <p>
                        {r.url && isUrl(r.url) ? (
                          <a href={r.url} target="_blank" rel="noopener noreferrer">
                            {r.caption}
                          </a>
                        ) : (
                          <Text>{r.caption}</Text>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </>
        ),
      };
    }
    case "contact": {
      const page = data.contact;
      const external = { target: "_blank", rel: "noopener noreferrer" } as const;
      const hasEmail = !page.email.startsWith("TODO");
      return {
        key: "contact",
        kind: "contact",
        back: toRoom,
        holding: false,
        node: (
          <>
            <Head kicker="Mailbox" title={page.title} />
            <Summary>{page.intro}</Summary>
            <ul className="cap-rows" aria-label="Ways to reach me">
              <li>
                {hasEmail ? (
                  <a className="cap-row" href={`mailto:${page.email}`}>
                    <Row lead={<Mail size={16} strokeWidth={2} aria-hidden />} title="Email" subtitle={page.email} />
                  </a>
                ) : (
                  <span className="cap-row" data-todo>
                    <Row lead={<Mail size={16} strokeWidth={2} aria-hidden />} title="Email" subtitle={<Text>{page.email}</Text>} />
                  </span>
                )}
              </li>
              {page.linkedin ? (
                <li>
                  {isUrl(page.linkedin) ? (
                    <a className="cap-row" href={page.linkedin} {...external}>
                      {/* eslint-disable-next-line @next/next/no-img-element -- the official mark */}
                      <Row lead={<img className="cap-mark" src="/brands/linkedin.svg" alt="" width={16} height={16} />} title="LinkedIn" subtitle={page.linkedin.replace(/^https?:\/\/(www\.)?/, "")}>
                        <ArrowUpRight className="cap-chevron" size={16} strokeWidth={2} aria-hidden />
                      </Row>
                    </a>
                  ) : (
                    <span className="cap-row" data-todo>
                      {/* eslint-disable-next-line @next/next/no-img-element -- the official mark */}
                      <Row lead={<img className="cap-mark" src="/brands/linkedin.svg" alt="" width={16} height={16} />} title="LinkedIn" subtitle={<Text>{page.linkedin}</Text>} />
                    </span>
                  )}
                </li>
              ) : null}
              <li>
                {isUrl(page.calUrl) ? (
                  <a className="cap-row" href={page.calUrl} {...external}>
                    <Row lead={<Calendar size={16} strokeWidth={2} aria-hidden />} title="Book a call" subtitle={page.calUrl.replace(/^https?:\/\//, "")}>
                      <ArrowUpRight className="cap-chevron" size={16} strokeWidth={2} aria-hidden />
                    </Row>
                  </a>
                ) : (
                  <span className="cap-row" data-todo>
                    <Row lead={<Calendar size={16} strokeWidth={2} aria-hidden />} title="Book a call" subtitle={<Text>{page.calUrl}</Text>} />
                  </span>
                )}
              </li>
            </ul>
            <Prose html={page.html} />
            <p className="cap-note">Based in {page.location}.</p>
          </>
        ),
      };
    }
    default:
      return null;
  }
}

/** The caption's own chrome: back to the parent, close to the room. */
export function CaptionChrome({ view, children }: { view: CaptionView; children: ReactNode }) {
  return (
    <article className="cap" data-kind={view.kind} data-testid={`caption-${view.kind}`}>
      <div className="cap-bar">
        {view.back ? (
          <Link href={view.back.href} scroll={false} className="cap-back" data-back>
            <ChevronLeft size={16} strokeWidth={2.2} aria-hidden />
            <span>
              <Text>{view.back.label}</Text>
            </span>
          </Link>
        ) : (
          <span />
        )}
        <Link href="/" scroll={false} className="cap-close" aria-label="Close, back to the room">
          <X size={16} strokeWidth={2.2} aria-hidden />
        </Link>
      </div>
      <div className="cap-body">{children}</div>
    </article>
  );
}

/** Under what's in your hand: how to handle it. */
export function HoldHint() {
  return (
    <p className="cap-hint" aria-hidden="true">
      <span className="cap-hint-fine">Drag to turn it · click outside to put it back</span>
      <span className="cap-hint-coarse">Drag to turn it · tap outside to put it back</span>
    </p>
  );
}
