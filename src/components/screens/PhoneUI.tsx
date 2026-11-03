"use client";

import { ArrowUpRight, ChevronLeft, ChevronRight, Mail } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/kit/parts/Avatar";
import { Phone } from "@/components/kit/phone";
import { Gallery, LinkList, metaOf, Metrics, Prose, Text } from "@/components/panels/ui";
import { Row } from "@/components/ui/Row";
import type { ScreenApp } from "@/lib/content/scene-data";
import type { Site } from "@/lib/content/schemas";
import { useClock } from "./Clock";

const isUrl = (value: string) => /^https?:\/\//.test(value);
const MARKS: Record<string, string> = { x: "/brands/x.svg", instagram: "/brands/instagram.svg", linkedin: "/brands/linkedin.svg" };

function Mark({ icon }: { icon: string }) {
  const src = MARKS[icon];
  // eslint-disable-next-line @next/next/no-img-element -- official marks from public/brands, drawn at their own proportions
  return src ? <img className="ph-mark" src={src} alt="" width={22} height={22} /> : <ArrowUpRight className="ph-mark" size={20} strokeWidth={2} aria-hidden />;
}

/**
 * Ömer's phone: his contact card (socials as quick actions), then his side quests; each opens a
 * page inside the phone (/phone/<app>). iOS geometry from the stageshow kit's Phone (402 × 874 pt).
 * Always live on the phone in the room; it takes taps once the camera rests on it.
 */
export function PhoneUI({
  apps,
  socials,
  name,
  tagline,
  email,
  active,
}: {
  apps: ScreenApp[];
  socials: Site["socials"];
  name: string;
  tagline: string;
  email: string;
  active: string | null;
}) {
  const time = useClock("phone");
  const app = apps.find((a) => a.slug === active) ?? null;
  const first = name.split(" ")[0] ?? name;
  const hasEmail = !email.startsWith("TODO");

  return (
    <Phone width={402} frame="bare" status island home time={time || "9:41"} wallpaper="#F2F2F7" className="ph" data-testid="phone-ui">
      <div className="ph-scroll">
        {app ? (
          <article className="ph-page" aria-labelledby="ph-page-title">
            <nav className="ph-nav">
              <Link href="/phone" scroll={false} className="ph-back">
                <ChevronLeft size={22} strokeWidth={2.4} aria-hidden />
                <span>{first}</span>
              </Link>
            </nav>
            <h2 id="ph-page-title" className="ph-title">
              <Text>{app.title}</Text>
            </h2>
            {app.subtitle ? <p className="ph-subtitle">{app.subtitle}</p> : null}
            <p className="ph-summary">
              <Text>{app.summary}</Text>
            </p>
            <div className="ph-card">
              <Metrics items={app.metrics} />
            </div>
            <div className="ph-prose">
              <Prose html={app.html} />
            </div>
            <Gallery images={app.images} />
            <LinkList links={app.links} />
            {app.cta ? (
              <Link href={app.cta.href} scroll={false} className="ph-cta">
                {app.cta.label}
              </Link>
            ) : null}
          </article>
        ) : (
          <div className="ph-home">
            <header className="ph-profile">
              <Avatar name={name} tone="ios" size={92} />
              <h2 className="ph-name">{name}</h2>
              <p className="ph-tagline">
                <Text>{tagline}</Text>
              </p>
            </header>
            <ul className="ph-actions" aria-label="Reach me">
              {socials.map((s) => (
                <li key={s.id}>
                  {isUrl(s.url) ? (
                    <a className="ph-action" href={s.url} target="_blank" rel="noopener noreferrer">
                      <Mark icon={s.icon} />
                      <span>{s.label}</span>
                    </a>
                  ) : (
                    <span className="ph-action" data-todo title="TODO(Ömer): add this link in content/site.json">
                      <Mark icon={s.icon} />
                      <span>{s.label}</span>
                    </span>
                  )}
                </li>
              ))}
              <li>
                {hasEmail ? (
                  <a className="ph-action" href={`mailto:${email}`}>
                    <Mail className="ph-mark ph-mark-mail" size={21} strokeWidth={2} aria-hidden />
                    <span>Email</span>
                  </a>
                ) : (
                  <span className="ph-action" data-todo title="TODO(Ömer): add your email in content/site.json">
                    <Mail className="ph-mark ph-mark-mail" size={21} strokeWidth={2} aria-hidden />
                    <span>Email</span>
                  </span>
                )}
              </li>
            </ul>
            <section className="ph-group" aria-labelledby="ph-quests">
              <h3 id="ph-quests">Side quests</h3>
              <ul className="ph-list">
                {apps.map((a) => (
                  <li key={a.slug}>
                    <Link href={a.href} scroll={false} className="row-link">
                      <Row title={<Text>{a.title}</Text>} subtitle={<Text>{a.subtitle ? `${a.subtitle}${a.metrics[0] ? ` · ${metaOf(a.metrics[0])}` : ""}` : (metaOf(a.metrics[0]) ?? a.summary)}</Text>}>
                        <ChevronRight className="row-chevron" size={18} strokeWidth={2.4} aria-hidden />
                      </Row>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        )}
      </div>
      <Link href={app ? "/phone" : "/"} scroll={false} className="ph-home-bar" aria-label={app ? "Home screen" : "Put the phone down"} />
    </Phone>
  );
}
