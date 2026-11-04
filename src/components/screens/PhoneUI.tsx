"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Avatar } from "@/components/kit/parts/Avatar";
import { Icon } from "@/components/kit/parts/Icon";
import { LockScreen, Phone } from "@/components/kit/phone";
import { metaOf, Text } from "@/components/panels/ui";
import type { ScreenApp } from "@/lib/content/scene-data";
import type { Site } from "@/lib/content/schemas";
import { useClock } from "./Clock";
import { brandSrc } from "./marks";
import { Copy, hostOf, isTodo, isUrl, LinkPills, Shots, Story } from "./parts";
import "./screens.css";
import "./phone-ui.css";

export interface PhoneUIProps {
  /** The side quests (content/phone/*.md), each a page on the phone. */
  apps: ScreenApp[];
  socials: Site["socials"];
  name: string;
  tagline: string;
  email: string;
  /** The app page on screen (/phone/<slug>), or null for the home view. */
  active: string | null;
  /**
   * In the visitor's hand (docked): the home view or an app. Asleep (seen from across the room):
   * the lock screen. Waking unlocks with the iOS motion; the default keeps older callers awake.
   */
  awake?: boolean;
  /** site.json `now`: the status line on the card. */
  now?: string;
  /** site.json `location`. */
  location?: string;
  /** site.json `calUrl`: the "Book a call" row (a TODO shows as a disabled row). */
  calUrl?: string;
}

/**
 * Ömer's phone (402 × 874 pt, the kit's Phone). Awake it shows his card: avatar, name and tagline,
 * quick actions with the real brand marks, then inset grouped lists (his side quests, the now line,
 * where he is, how to reach him). Each side quest opens as a page pushed in from the right.
 * Asleep it is the lock screen. Always live on the phone in the room; it takes taps once docked.
 */
export function PhoneUI({ apps, socials, name, tagline, email, active, awake = true, now, location, calUrl }: PhoneUIProps) {
  const time = useClock("phone");
  const date = useClock("lockdate");
  const app = apps.find((a) => a.slug === active) ?? null;
  // the page stays mounted while it slides back out, so it leaves with its content
  const [last, setLast] = useState<ScreenApp | null>(app);
  if (app && app !== last) setLast(app);
  const page = app ?? last;
  const depth = app ? 1 : 0;
  const first = name.split(" ")[0] ?? name;

  return (
    <Phone
      width={402}
      frame="bare"
      status
      island
      home
      dark={!awake}
      time={time || "9:41"}
      wallpaper="#f2f2f7"
      className="ph"
      data-testid="phone-ui"
      data-awake={awake || undefined}
      data-depth={depth}
    >
      <div className="ph-views" aria-hidden={!awake || undefined}>
        <section className="ph-view ph-home" aria-labelledby="ph-name" aria-hidden={depth === 1 || undefined} inert={depth === 1}>
          <Home apps={apps} socials={socials} name={name} tagline={tagline} email={email} now={now} location={location} calUrl={calUrl} />
        </section>
        <section className="ph-view ph-app" aria-labelledby="ph-page-title" aria-hidden={depth === 0 || undefined} inert={depth === 0}>
          {page ? <AppPage app={page} first={first} others={apps.filter((a) => a.slug !== page.slug)} /> : null}
        </section>
      </div>
      <div className="ph-lock" aria-hidden={awake || undefined} inert={awake}>
        <LockScreen date={date || " "} time={time || "9:41"} />
      </div>
      <Link href={app ? "/phone" : "/"} scroll={false} className="ph-home-bar" aria-label={app ? "Home screen" : "Put the phone down"} tabIndex={awake ? undefined : -1} />
    </Phone>
  );
}

/* ------------------------------------------------------------------ the card */

type HomeProps = Omit<PhoneUIProps, "active" | "awake">;

function Home({ apps, socials, name, tagline, email, now, location, calUrl }: HomeProps) {
  const mail = !isTodo(email);
  const cal = calUrl !== undefined && isUrl(calUrl);
  return (
    <div className="ph-card">
      <header className="ph-profile">
        <Avatar name={name} tone="ios" size={84} />
        <h2 id="ph-name" className="ph-name">
          {name}
        </h2>
        <p className="ph-tagline">
          <Text>{tagline}</Text>
        </p>
      </header>

      <ul className="ph-actions" aria-label="Reach me">
        {socials.map((s) => {
          const src = brandSrc(s.icon);
          const mark = src ? (
            // eslint-disable-next-line @next/next/no-img-element -- official marks from public/brands, at their own proportions
            <img className="ph-mark" src={src} alt="" width={24} height={24} draggable={false} />
          ) : (
            <ArrowUpRight className="ph-mark" size={22} strokeWidth={2} aria-hidden />
          );
          return (
            <li key={s.id}>
              {isUrl(s.url) ? (
                <a className="ph-action" href={s.url} target="_blank" rel="noopener noreferrer">
                  {mark}
                  <span>{s.label}</span>
                </a>
              ) : (
                <span className="ph-action" aria-disabled="true" title="TODO(Ömer): add this link in content/site.json">
                  {mark}
                  <span>{s.label}</span>
                </span>
              )}
            </li>
          );
        })}
        <li>
          {mail ? (
            <a className="ph-action" href={`mailto:${email}`}>
              <Icon name="mail" filled size={24} className="ph-mark ph-mark-mail" />
              <span>Email</span>
            </a>
          ) : (
            <span className="ph-action" aria-disabled="true" title="TODO(Ömer): add your email in content/site.json">
              <Icon name="mail" filled size={24} className="ph-mark ph-mark-mail" />
              <span>Email</span>
            </span>
          )}
        </li>
      </ul>

      {now ? (
        <ul className="ph-group" aria-label="Now">
          <li>
            <Field label="Now">
              <Text>{now}</Text>
            </Field>
          </li>
        </ul>
      ) : null}

      <section className="ph-section" aria-labelledby="ph-quests">
        <h3 id="ph-quests" className="ph-section-title">
          Side quests
        </h3>
        <QuestList apps={apps} />
      </section>

      <ul className="ph-group" aria-label="Contact">
        {location ? (
          <li>
            <Field label="Location">{location}</Field>
          </li>
        ) : null}
        <li>
          {mail ? (
            <a className="ph-row ph-row-link ph-field" href={`mailto:${email}`}>
              <span className="ph-field-label">Email</span>
              <span className="ph-field-value ph-tint">{email}</span>
            </a>
          ) : (
            <Field label="Email" disabled>
              <Text>{email}</Text>
            </Field>
          )}
        </li>
        <li>
          {cal ? (
            <a className="ph-row ph-row-link ph-field" href={calUrl} target="_blank" rel="noopener noreferrer">
              <span className="ph-field-label">Book a call</span>
              <span className="ph-field-value ph-tint">{hostOf(calUrl)}</span>
            </a>
          ) : (
            <Field label="Book a call" disabled>
              <Text>{calUrl ?? "TODO(Ömer): your cal.com link"}</Text>
            </Field>
          )}
        </li>
      </ul>
    </div>
  );
}

/** The side quests as an inset grouped list: name, then what it is and its headline number. */
function QuestList({ apps }: { apps: ScreenApp[] }) {
  return (
    <ul className="ph-group">
      {apps.map((a) => {
        const lead = metaOf(a.metrics[0]);
        const subtitle = a.subtitle ? (lead ? `${a.subtitle} · ${lead}` : a.subtitle) : (lead ?? a.summary);
        return (
          <li key={a.slug}>
            <Link href={a.href} scroll={false} className="ph-row ph-row-link">
              <span className="ph-row-text">
                <span className="ph-row-title">{a.title}</span>
                <span className="ph-row-sub">
                  <Text>{subtitle}</Text>
                </span>
              </span>
              <ChevronRight className="ph-chevron" size={17} strokeWidth={2.6} aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** An iOS contact field: a small label over its value. Disabled while the value is a placeholder. */
function Field({ label, disabled, children }: { label: string; disabled?: boolean; children: ReactNode }) {
  return (
    <div className="ph-row ph-field" aria-disabled={disabled || undefined}>
      <span className="ph-field-label">{label}</span>
      <span className="ph-field-value">{children}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ an app page */

function AppPage({ app, first, others }: { app: ScreenApp; first: string; others: ScreenApp[] }) {
  const [hero, ...rest] = app.metrics;
  return (
    <article className="ph-page" key={app.slug}>
      <nav className="ph-nav">
        <Link href="/phone" scroll={false} className="ph-back" aria-label={`Back to ${first}`}>
          <ChevronLeft size={24} strokeWidth={2.3} aria-hidden />
        </Link>
      </nav>
      <header className="ph-page-head">
        <h2 id="ph-page-title" className="ph-page-title">
          {app.title}
        </h2>
        {app.subtitle ? <p className="ph-page-sub">{app.subtitle}</p> : null}
        <Copy text={app.summary} className="ph-page-summary" noteClass="ph-summary-todo" />
      </header>

      {hero ? (
        <section className="ph-stats" aria-label="Numbers">
          <div className="ph-stats-hero">
            <span className="ph-stats-value">
              <Text>{hero.value}</Text>
            </span>
            <span className="ph-stats-label">
              <Text>{hero.label}</Text>
            </span>
          </div>
          {rest.length ? (
            <ul className="ph-stats-rows">
              {rest.map((m) => (
                <li key={`${m.value}-${m.label}`} className="ph-stats-row">
                  <span className="ph-stats-row-value">
                    <Text>{m.value}</Text>
                  </span>
                  <span className="ph-stats-row-label">
                    <Text>{m.label}</Text>
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      <Shots images={app.images} className="ph-shots" crop />
      <Story html={app.html} className="ph-story" />
      <LinkPills links={app.links} className="ph-links" />
      {app.images.length ? null : <Shots images={[]} className="ph-shots" slot />}
      {others.length ? (
        <section className="ph-section" aria-labelledby={`ph-more-${app.slug}`}>
          <h3 id={`ph-more-${app.slug}`} className="ph-section-title">
            More side quests
          </h3>
          <QuestList apps={others} />
        </section>
      ) : null}
      {app.cta ? (
        <div className="ph-cta-bar">
          <Link href={app.cta.href} scroll={false} className="ph-cta">
            {app.cta.label}
          </Link>
        </div>
      ) : null}
    </article>
  );
}
