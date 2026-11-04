"use client";

import { ChevronLeft, ChevronRight, Globe, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Text } from "@/components/panels/ui";
import type { ScreenApp } from "@/lib/content/scene-data";
import { Copy, hostOf, liveLinks, LinkPills, MetaLine, Numbers, Shots, Story } from "./parts";
import "./omer-compact.css";

/**
 * Ömer's computer at phone size: an iOS navigation stack, not the desktop squeezed. The root is the
 * list of roles (each a card with its headline number); a role pushes in from the right with a back
 * control, and the close control (back to the room) is always in the bar. The top 56px stay clear
 * for the site's 3D/Text switch.
 */
export function OmerCompact({ apps, active, name }: { apps: ScreenApp[]; active: string | null; name: string }) {
  const app = apps.find((a) => a.slug === active) ?? null;
  // the page stays mounted while it slides back out, so it leaves with its content
  const [last, setLast] = useState<ScreenApp | null>(app);
  if (app && app !== last) setLast(app);
  const page = app ?? last;
  const depth = app ? 1 : 0;
  const first = name.split(" ")[0] ?? name;

  return (
    <div className="osc" data-testid="omer-os" data-layout="compact" data-depth={depth}>
      <section className="osc-view osc-list" aria-labelledby="osc-list-title" aria-hidden={depth === 1 || undefined} inert={depth === 1}>
        <header className="osc-large">
          <h2 id="osc-list-title" className="osc-large-title">
            Work
          </h2>
          <p className="osc-large-sub">{first}&rsquo;s computer</p>
        </header>
        <ul className="osc-cards">
          {apps.map((a) => {
            const [hero] = a.metrics;
            return (
              <li key={a.slug}>
                <Link href={a.href} scroll={false} className="osc-card">
                  <span className="osc-card-head">
                    <span className="osc-card-title">{a.title}</span>
                    <ChevronRight className="osc-chevron" size={18} strokeWidth={2.4} aria-hidden />
                  </span>
                  <MetaLine parts={[a.role, a.period?.split(" · ")[0]]} className="osc-card-meta" />
                  {hero ? (
                    <span className="osc-card-num">
                      <span className="osc-card-value">
                        <Text>{hero.value}</Text>
                      </span>
                      <span className="osc-card-label">
                        <Text>{hero.label}</Text>
                      </span>
                    </span>
                  ) : (
                    <span className="osc-card-summary">
                      <Text>{a.summary}</Text>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="osc-view osc-page" aria-labelledby="osc-page-title" aria-hidden={depth === 0 || undefined} inert={depth === 0}>
        {page ? <CompactRole app={page} /> : null}
      </section>

      <div className="osc-bar">
        {depth === 1 ? (
          <Link href="/computer" scroll={false} className="osc-glass osc-back" aria-label="Back to Work">
            <ChevronLeft size={22} strokeWidth={2.2} aria-hidden />
          </Link>
        ) : null}
        <Link href="/" scroll={false} className="osc-glass osc-close" aria-label="Close, step back from the computer">
          <X size={19} strokeWidth={2.2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}

function CompactRole({ app }: { app: ScreenApp }) {
  const site = liveLinks(app)[0];
  return (
    <article className="osc-role" key={app.slug}>
      <header className="osc-role-head">
        <h2 id="osc-page-title" className="osc-role-title">
          {app.title}
        </h2>
        <MetaLine parts={[app.role, app.period]} className="osc-role-meta" />
        <Copy text={app.summary} className="osc-role-summary" noteClass="osc-summary-todo" />
      </header>
      <Numbers items={app.metrics} className="osc-nums" />
      <Shots images={app.images} className="osc-shots" />
      <Story html={app.html} className="osc-story" />
      {site ? (
        <a className="osc-site" href={site.url} target="_blank" rel="noopener noreferrer">
          <Globe size={18} strokeWidth={2} aria-hidden />
          <span>Visit {hostOf(site.url)}</span>
        </a>
      ) : null}
      <LinkPills links={app.links.filter((link) => link !== site)} className="osc-links" />
      {app.images.length ? null : <Shots images={[]} className="osc-shots" slot={`Add them under images in content/computer/${app.slug}.md`} />}
    </article>
  );
}
