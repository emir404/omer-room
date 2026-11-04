"use client";

import { ChevronLeft, ChevronRight, Folder, Globe, Search, Wifi, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/kit/parts/Avatar";
import { Row } from "@/components/kit/parts/Row";
import { Window } from "@/components/kit/window";
import { Text } from "@/components/panels/ui";
import type { ScreenApp } from "@/lib/content/scene-data";
import { Clock } from "./Clock";
import { AppleMark } from "./marks";
import { OmerCompact } from "./OmerCompact";
import { Copy, hostOf, liveLinks, LinkPills, MetaLine, Numbers, Shots, Story } from "./parts";
import "./screens.css";
import "./omer-os.css";

export interface OmerOSProps {
  /** Every role, in order (content/computer/*.md). */
  apps: ScreenApp[];
  /** The role on screen. Wide: falls back to the first role. Compact: null is the list of roles. */
  active: string | null;
  /** The owner, at the foot of the sidebar. */
  name: string;
  /**
   * wide: a macOS 26 desktop at 16:10 (design width 960–1440). compact: the same computer as an
   * iOS-style navigation stack at phone size (the screen fills the viewport, design size = viewport).
   */
  layout?: "wide" | "compact";
}

/**
 * Ömer's computer. Always live on the monitor; it takes clicks once the camera rests on it
 * (ScreenLayer docks it). Wide is the desktop: the menu bar over the wallpaper and the Work app,
 * whose sidebar lists every role and whose page is that role's case study. Compact is a redesign
 * for phones (OmerCompact), not a squeeze.
 */
export function OmerOS({ apps, active, name, layout = "wide" }: OmerOSProps) {
  if (!apps.length) return null;
  return layout === "compact" ? <OmerCompact apps={apps} active={active} name={name} /> : <OmerDesktop apps={apps} active={active} name={name} />;
}

/** One control in the tall (icon-and-label) toolbar: the glass button, its label under it. */
function Tool({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="os-tool">
      {children}
      <span className="os-tool-label" aria-hidden="true">
        {label}
      </span>
    </span>
  );
}

const glyph = { size: 16, strokeWidth: 1.75, "aria-hidden": true } as const;

function OmerDesktop({ apps, active, name }: Omit<OmerOSProps, "layout">) {
  const index = Math.max(0, apps.findIndex((a) => a.slug === active));
  const shown = apps[index]!;
  const prev = apps[index - 1];
  const next = apps[index + 1];
  const site = liveLinks(shown)[0];

  const sidebar = (
    <nav className="os-side" aria-label="Work">
      {/* the red traffic light closes the window: back to the room */}
      <Link href="/" scroll={false} className="os-close" aria-label="Close, step back from the computer">
        <X size={8} strokeWidth={3} aria-hidden />
      </Link>
      <p className="os-side-label" aria-hidden="true">
        Work
      </p>
      <ul className="os-side-list">
        {apps.map((app) => {
          const current = app.slug === shown.slug;
          return (
            <li key={app.slug}>
              <Link href={app.href} scroll={false} className="os-side-link" aria-current={current ? "page" : undefined}>
                <Row
                  pad={8}
                  selected={current}
                  lead={<Folder size={16} strokeWidth={1.75} className="os-side-icon" aria-hidden />}
                  title={app.title}
                  subtitle={app.role ? <Text>{app.role}</Text> : undefined}
                />
              </Link>
            </li>
          );
        })}
      </ul>
      <div className="os-owner">
        <Avatar name={name} tone="ios" size={28} />
        <span className="os-owner-name">{name}</span>
      </div>
    </nav>
  );

  return (
    <div className="os" data-testid="omer-os" data-layout="wide">
      <div className="os-wallpaper" aria-hidden="true" />
      <div className="os-menubar" aria-hidden="true">
        <AppleMark />
        <span className="os-menubar-app">Work</span>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Window</span>
        <span>Help</span>
        <span className="os-menubar-spacer" />
        <Wifi size={15} strokeWidth={2} />
        <Search size={14} strokeWidth={2.2} />
        <Clock format="menubar" className="os-menubar-clock" />
      </div>
      <Window
        className="os-window"
        sidebar={sidebar}
        sidebarWidth={232}
        sidebarStyle="floating"
        lightsSize="large"
        barSize="tall"
        lead={
          <span className="os-lead">
            <Tool label="Back/Forward">
              <span className="os-cap os-nav">
                {prev ? (
                  <Link href={prev.href} scroll={false} className="os-nav-btn" aria-label="Previous role">
                    <ChevronLeft {...glyph} />
                  </Link>
                ) : (
                  <span className="os-nav-btn" aria-disabled="true">
                    <ChevronLeft {...glyph} />
                  </span>
                )}
                <span className="os-nav-rule" aria-hidden="true" />
                {next ? (
                  <Link href={next.href} scroll={false} className="os-nav-btn" aria-label="Next role">
                    <ChevronRight {...glyph} />
                  </Link>
                ) : (
                  <span className="os-nav-btn" aria-disabled="true">
                    <ChevronRight {...glyph} />
                  </span>
                )}
              </span>
            </Tool>
            <span className="ss-window__heading os-heading">{shown.title}</span>
          </span>
        }
        toolbar={
          <span className="os-tools">
            <Tool label="Website">
              {site ? (
                <a className="os-round" href={site.url} target="_blank" rel="noopener noreferrer" aria-label={`Website: ${hostOf(site.url)}`} title={hostOf(site.url)}>
                  <Globe {...glyph} />
                </a>
              ) : (
                <span className="os-round" aria-disabled="true" title="No website yet">
                  <Globe {...glyph} />
                </span>
              )}
            </Tool>
          </span>
        }
        body={{ className: "os-body" }}
      >
        {/* keyed by role: a new page starts at its top, with the body's short page-swap fade */}
        <div className="os-scroll" key={shown.slug}>
          <article className="os-doc" aria-labelledby="os-doc-title">
            <header className="os-head">
              <h2 id="os-doc-title" className="os-title">
                {shown.title}
              </h2>
              <MetaLine parts={[shown.role, shown.period]} className="os-meta" />
              <Copy text={shown.summary} className="os-summary" noteClass="os-summary-todo" />
            </header>
            <Numbers items={shown.metrics} className="os-nums" />
            {/* real screenshots lead; with none yet, the story does, and their slot closes the page */}
            <Shots images={shown.images} className="os-shots" browser />
            <Story html={shown.html} className="os-story" />
            <LinkPills links={shown.links} className="os-links" />
            {shown.images.length ? null : <Shots images={[]} className="os-shots" slot={`Add them under images in content/computer/${shown.slug}.md`} />}
          </article>
        </div>
      </Window>
    </div>
  );
}
