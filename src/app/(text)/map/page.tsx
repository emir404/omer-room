import type { Metadata } from "next";
import Link from "next/link";
import { Text } from "@/components/panels/ui";
import type { Metric } from "@/lib/content/schemas";
import { loadAllContent } from "@/lib/content/load";
import { chapterHref } from "@/lib/routes";

export const metadata: Metadata = { title: "Text version", description: "Everything in the room, as plain text." };

function MetricLine({ metrics }: { metrics: Metric[] }) {
  if (!metrics.length) return null;
  return <p className="map-metrics">{metrics.map((m) => `${m.value} ${m.label}`).join(" · ")}</p>;
}

/** The whole site as one accessible page: a site map, the no-3D fallback, and good for crawlers. */
export default function TextMap() {
  const c = loadAllContent();
  const isUrl = (v: string) => /^https?:\/\//.test(v);

  return (
    <main className="textmap" data-testid="text-map">
      <p className="map-back">
        <Link href="/">← Back to the room</Link>
      </p>
      <header>
        <h1>{c.site.name}</h1>
        <p className="lede">
          <Text>{c.site.tagline}</Text>
        </p>
        <p>
          <strong>Now:</strong> <Text>{c.site.now}</Text>
        </p>
      </header>

      <section aria-labelledby="map-shelf">
        <h2 id="map-shelf">
          <Link href="/shelf">Bookshelf — {c.objects.find((o) => o.id === "shelf")?.label}</Link>
        </h2>
        {c.shelfMeta.shelves.map((shelf) => (
          <div key={shelf.id}>
            <h3>{shelf.title}</h3>
            <ul>
              {shelf.id === "books"
                ? c.books.map((b) => (
                    <li key={b.slug}>
                      <Link href={chapterHref("shelf", b.slug)}>
                        <Text>{b.data.title}</Text>
                      </Link>{" "}
                      by <Text>{b.data.author}</Text> — <Text>{b.data.takeaway}</Text>
                    </li>
                  ))
                : c.shelfItems
                    .filter((i) => i.data.shelf === shelf.id)
                    .map((i) => (
                      <li key={i.slug}>
                        <Link href={chapterHref("shelf", i.slug)}>{i.data.title}</Link> — {i.data.role} ({i.data.period}). {i.data.summary}
                        <MetricLine metrics={i.data.metrics} />
                      </li>
                    ))}
            </ul>
          </div>
        ))}
      </section>

      <section aria-labelledby="map-work">
        <h2 id="map-work">
          <Link href="/computer">Computer — work</Link>
        </h2>
        <ul>
          {c.computerApps.map((app) => (
            <li key={app.slug}>
              <Link href={chapterHref("computer", app.slug)}>{app.data.title}</Link> — <Text>{app.data.role}</Text>. <Text>{app.data.summary}</Text>
              <MetricLine metrics={app.data.metrics} />
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="map-phone">
        <h2 id="map-phone">
          <Link href="/phone">Phone — socials & side quests</Link>
        </h2>
        <ul>
          {c.phoneApps.map((app) => (
            <li key={app.slug}>
              <Link href={chapterHref("phone", app.slug)}>{app.data.title}</Link>
              {app.data.subtitle ? ` (${app.data.subtitle})` : ""} — <Text>{app.data.summary}</Text>
              <MetricLine metrics={app.data.metrics} />
            </li>
          ))}
          {c.site.socials.map((s) => (
            <li key={s.id}>
              {isUrl(s.url) ? (
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.label}
                </a>
              ) : (
                <>
                  {s.label}: <Text>{s.url}</Text>
                </>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="map-places">
        <h2 id="map-places">
          <Link href="/globe">Globe — places I&apos;ve been</Link>
        </h2>
        <ul>
          {c.globePlaces.map((p) => (
            <li key={p.slug}>
              <Link href={chapterHref("globe", p.slug)}>{p.data.title}</Link>, {p.data.country} — {p.data.summary}
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="map-window">
        <h2 id="map-window">
          <Link href="/window">Window — {c.windowPage.data.title}</Link>
        </h2>
        <p>
          {c.windowPage.data.place}. {c.windowPage.data.intro}
        </p>
        <MetricLine metrics={c.windowPage.data.metrics} />
      </section>

      <section aria-labelledby="map-letter">
        <h2 id="map-letter">
          <Link href="/letter">The framed letter — {c.letterPage.data.title}</Link>
        </h2>
        <p>{c.letterPage.data.intro}</p>
        <MetricLine metrics={c.letterPage.data.metrics} />
      </section>

      <section aria-labelledby="map-contact">
        <h2 id="map-contact">
          <Link href="/contact">Mailbox — {c.contactPage.data.title}</Link>
        </h2>
        <p>
          Email: <Text>{c.site.email}</Text> · Book a call: <Text>{c.site.calUrl}</Text>
        </p>
      </section>
    </main>
  );
}
