import Link from "next/link";
import { AppIcon, Gallery, LinkList, Metrics, Prose, Text } from "@/components/panels/ui";
import type { Entry } from "@/lib/content/load";
import type { PhoneApp, Site } from "@/lib/content/schemas";
import { chapterHref } from "@/lib/routes";
import { Clock } from "./Clock";

const isUrl = (value: string) => /^https?:\/\//.test(value);

/**
 * The phone: a home screen of app icons. Socials (from content/site.json) link out; project apps
 * open a page inside the phone (/phone/<app>). Plain links throughout — no JS required.
 */
export function PhoneUI({ apps, socials, active }: { apps: Entry<PhoneApp>[]; socials: Site["socials"]; active: Entry<PhoneApp> | null }) {
  return (
    <div className="phone" data-testid="phone-ui">
      <div className="phone-status">
        <Clock />
        <span className="phone-status-icons" aria-hidden="true">
          ▮▮▮ ◔
        </span>
      </div>
      <h1 tabIndex={-1} className="sr-only">
        Phone: socials and side quests
      </h1>

      {active ? (
        <article className="phone-app-page" aria-labelledby={`phone-${active.slug}`}>
          <header className="phone-app-head">
            <Link href="/phone" scroll={false} className="phone-back" aria-label="Back to the home screen">
              ‹
            </Link>
            <AppIcon name={active.data.icon} />
            <div>
              <h2 id={`phone-${active.slug}`}>{active.data.title}</h2>
              {active.data.subtitle ? <p className="phone-subtitle">{active.data.subtitle}</p> : null}
            </div>
          </header>
          <div className="phone-app-body">
            <p className="phone-summary">
              <Text>{active.data.summary}</Text>
            </p>
            <Metrics items={active.data.metrics} />
            <Prose html={active.html} />
            <Gallery images={active.data.images} empty="Screenshots coming soon" />
            <LinkList links={active.data.links} />
            {active.data.cta ? (
              <Link href={active.data.cta.href} scroll={false} className="phone-cta">
                {active.data.cta.label} →
              </Link>
            ) : null}
          </div>
        </article>
      ) : (
        <ul className="phone-grid" aria-label="Apps">
          {apps.map((app) => (
            <li key={app.slug}>
              <Link href={chapterHref("phone", app.slug)} scroll={false} className="phone-app">
                <AppIcon name={app.data.icon} />
                <span>{app.data.title}</span>
              </Link>
            </li>
          ))}
          {socials.map((social) => (
            <li key={social.id}>
              {isUrl(social.url) ? (
                <a href={social.url} target="_blank" rel="noopener noreferrer" className="phone-app">
                  <AppIcon name={social.icon} />
                  <span>{social.label}</span>
                </a>
              ) : (
                <span className="phone-app is-todo" title="TODO(Ömer): add this link in content/site.json">
                  <AppIcon name={social.icon} />
                  <span>{social.label}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      <Link href={active ? "/phone" : "/"} scroll={false} className="phone-home" aria-label={active ? "Home screen" : "Put the phone down"}>
        <span aria-hidden="true" />
      </Link>
    </div>
  );
}
