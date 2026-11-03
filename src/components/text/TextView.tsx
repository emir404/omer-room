import { ArrowUpRight, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";
import { Gallery, isUrl, LinkList, metaOf, Metrics, Prose, Text } from "@/components/panels/ui";
import { Row } from "@/components/ui/Row";
import { loadAllContent } from "@/lib/content/load";
import type { ContentImage, ContentLink, Metric } from "@/lib/content/schemas";
import "./text.css";

/**
 * The whole site as one page: the text version (/text), the layout for browsers without WebGL
 * or JavaScript, and what search engines read. Built to scan: every item is one row (what, my
 * role, the headline number); open a row for the story.
 */

function Item({
  id,
  title,
  subtitle,
  meta,
  lead,
  summary,
  metrics = [],
  html = "",
  images = [],
  links = [],
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  meta?: string;
  lead?: ReactNode;
  summary?: string;
  metrics?: Metric[];
  html?: string;
  images?: ContentImage[];
  links?: ContentLink[];
  children?: ReactNode;
}) {
  return (
    <li>
      <details className="tv-item" id={id}>
        <summary>
          <Row
            lead={lead}
            title={<Text>{title}</Text>}
            subtitle={subtitle ? <Text>{subtitle}</Text> : undefined}
            meta={meta ? <Text>{meta}</Text> : undefined}
          >
            <ChevronRight className="tv-chevron" size={16} strokeWidth={2} aria-hidden />
          </Row>
        </summary>
        <div className="tv-detail">
          {summary ? (
            <p className="tv-summary">
              <Text>{summary}</Text>
            </p>
          ) : null}
          <Metrics items={metrics} />
          <Prose html={html} />
          <Gallery images={images} />
          <LinkList links={links} />
          {children}
        </div>
      </details>
    </li>
  );
}

function Group({ id, title, children, note }: { id: string; title: string; children: ReactNode; note?: string }) {
  return (
    <section className="tv-group" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`}>{title}</h2>
      {note ? <p className="tv-note">{note}</p> : null}
      <ul className="tv-card">{children}</ul>
    </section>
  );
}

export function TextView() {
  const c = loadAllContent();
  const shelf = (id: string) => c.shelfMeta.shelves.find((s) => s.id === id)!;
  const items = (id: string) => c.shelfItems.filter((i) => i.data.shelf === id);
  const letter = c.letterPage;
  const hasEmail = !c.site.email.startsWith("TODO");

  return (
    <main className="tv" data-testid="text-view">
      <header className="tv-head">
        <h1>{c.site.name}</h1>
        <p className="tv-tagline">
          <Text>{c.site.tagline}</Text>
        </p>
        <p className="tv-now">
          <span className="tv-now-tag">Now</span>
          <span>
            <Text>{c.site.now}</Text>
          </span>
        </p>
        <ul className="pills tv-contact">
          <li>
            {hasEmail ? (
              <a className="pill" href={`mailto:${c.site.email}`}>
                Email
              </a>
            ) : (
              <span className="pill" data-todo>
                Email
              </span>
            )}
          </li>
          {c.site.socials.map((s) => (
            <li key={s.id}>
              {isUrl(s.url) ? (
                <a className="pill" href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                  <ArrowUpRight size={14} strokeWidth={2} aria-hidden />
                </a>
              ) : (
                <span className="pill" data-todo>
                  {s.label}
                </span>
              )}
            </li>
          ))}
        </ul>
      </header>

      <Group id="work" title="Work">
        {c.computerApps.map((app) => (
          <Item
            key={app.slug}
            id={app.slug}
            title={app.data.title}
            subtitle={`${app.data.role} · ${app.data.period}`}
            meta={metaOf(app.data.metrics[0])}
            summary={app.data.summary}
            metrics={app.data.metrics}
            html={app.html}
            images={app.data.images}
            links={app.data.links}
          />
        ))}
      </Group>

      {(["school", "olympiad", "mun"] as const).map((id) => (
        <Group key={id} id={id} title={shelf(id).title}>
          {items(id).map((item) => (
            <Item
              key={item.slug}
              id={item.slug}
              title={item.data.title}
              subtitle={item.data.role}
              meta={metaOf(item.data.metrics[0])}
              summary={`${item.data.period}. ${item.data.summary}`}
              metrics={item.data.metrics}
              html={item.html}
              images={item.data.images}
              links={item.data.links}
            />
          ))}
        </Group>
      ))}

      <Group id="side-quests" title="Side quests">
        {c.phoneApps.map((app) => (
          <Item
            key={app.slug}
            id={app.slug}
            title={app.data.title}
            subtitle={app.data.subtitle}
            meta={metaOf(app.data.metrics[0])}
            summary={app.data.summary}
            metrics={app.data.metrics}
            html={app.html}
            images={app.data.images}
            links={app.data.links}
          />
        ))}
      </Group>

      <Group id="books" title={shelf("books").title}>
        {c.books.map((book) => (
          <Item
            key={book.slug}
            id={book.slug}
            title={book.data.title}
            subtitle={book.data.author}
            lead={
              book.data.cover ? (
                // eslint-disable-next-line @next/next/no-img-element -- a 32px thumbnail, shown as is
                <img className="tv-cover" src={book.data.cover.src} alt="" width={28} height={42} />
              ) : (
                <span className="tv-cover" data-empty aria-hidden="true" />
              )
            }
            summary={book.data.takeaway}
            html={book.html}
          />
        ))}
      </Group>

      <Group id="places" title="Places I've been">
        {c.globePlaces.map((place) => (
          <Item
            key={place.slug}
            id={place.slug}
            title={place.data.title}
            subtitle={[place.data.country, place.data.when].filter(Boolean).join(" · ")}
            summary={place.data.summary}
            html={place.html}
            images={place.data.photos}
          />
        ))}
      </Group>

      <Group id="kozan" title="Where I'm from">
        <Item
          id="farm"
          title={c.windowPage.data.title}
          subtitle={c.windowPage.data.place}
          meta={metaOf(c.windowPage.data.metrics[0])}
          summary={c.windowPage.data.intro}
          metrics={c.windowPage.data.metrics}
          html={c.windowPage.html}
          images={c.windowPage.data.photos}
        >
          {c.windowPage.data.facts.length ? (
            <dl className="stat-list tv-facts">
              {c.windowPage.data.facts.map((fact) => (
                <div className="stat-row" key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>
                    <Text>{fact.value}</Text>
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Item>
      </Group>

      <section className="tv-group" id="letter" aria-labelledby="letter-title">
        <h2 id="letter-title">{letter.data.title}</h2>
        <div className="tv-card tv-letter">
          <p className="tv-summary">
            <Text>{letter.data.intro}</Text>
          </p>
          {letter.data.letter && letter.letterSize ? (
            <figure className="letter-figure">
              {/* eslint-disable-next-line @next/next/no-img-element -- the letter is shown exactly as it is: no resizing or recompression */}
              <img src={letter.data.letter.src} alt={letter.data.letter.alt} width={letter.letterSize.width} height={letter.letterSize.height} />
            </figure>
          ) : (
            <p className="gallery-empty">The letter goes here: add it in content/letter.md.</p>
          )}
          <Metrics items={letter.data.metrics} />
          <Prose html={letter.html} />
        </div>
      </section>

      <Group id="contact" title="Say hi">
        <li>
          {hasEmail ? (
            <a className="row-link" href={`mailto:${c.site.email}`}>
              <Row title="Email" meta={c.site.email} />
            </a>
          ) : (
            <Row title="Email" meta={<Text>{c.site.email}</Text>} />
          )}
        </li>
        <li>
          {isUrl(c.site.calUrl) ? (
            <a className="row-link" href={c.site.calUrl} target="_blank" rel="noopener noreferrer">
              <Row title="Book a call" meta="cal.com">
                <ArrowUpRight className="row-chevron" size={16} strokeWidth={2} aria-hidden />
              </Row>
            </a>
          ) : (
            <Row title="Book a call" meta={<Text>{c.site.calUrl}</Text>} />
          )}
        </li>
      </Group>

      <footer className="tv-foot">
        <p>{c.site.location}</p>
      </footer>
    </main>
  );
}
