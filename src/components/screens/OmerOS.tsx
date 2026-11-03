"use client";

import { ArrowUpRight, BatteryFull, Folder, Search, Wifi } from "lucide-react";
import Link from "next/link";
import { Window } from "@/components/kit/window";
import { Metrics, Prose, Text } from "@/components/panels/ui";
import type { ScreenApp } from "@/lib/content/scene-data";
import { Clock } from "./Clock";

const isUrl = (value: string) => /^https?:\/\//.test(value);

/**
 * Ömer's computer: a desktop with one app open, "Work". The sidebar lists every role
 * (content/computer/*.md), the window shows the selected one. Always live on the monitor; it takes
 * clicks once the camera rests on it (ScreenLayer docks it). Laid out at a 16:10 design size.
 */
export function OmerOS({ apps, active, name }: { apps: ScreenApp[]; active: string | null; name: string }) {
  const shown = apps.find((a) => a.slug === active) ?? apps[0];
  if (!shown) return null;
  const links = shown.links.filter((l) => isUrl(l.url));

  const sidebar = (
    <nav className="os-side" aria-label="Work">
      {/* the red traffic light closes the window: back to the room */}
      <Link href="/" scroll={false} className="os-close" aria-label="Close, step back from the computer" />
      <div className="os-search" aria-hidden="true">
        <Search size={13} strokeWidth={2} />
        <span>Search</span>
      </div>
      <p className="os-side-label">Work</p>
      <ul>
        {apps.map((app) => (
          <li key={app.slug}>
            <Link
              href={app.href}
              scroll={false}
              className="os-side-item"
              aria-current={app.slug === shown.slug ? "page" : undefined}
              data-selected={app.slug === shown.slug || undefined}
            >
              <Folder size={15} strokeWidth={2} className="os-side-icon" aria-hidden />
              <span className="os-side-text">
                <Text>{app.title}</Text>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <p className="os-side-owner">{name}</p>
    </nav>
  );

  return (
    <div className="os" data-testid="omer-os">
      <div className="os-wallpaper" aria-hidden="true" />
      <div className="os-menubar">
        <span className="os-menubar-app">Work</span>
        <span>File</span>
        <span>Edit</span>
        <span>View</span>
        <span>Window</span>
        <span className="os-menubar-spacer" />
        <Wifi size={14} strokeWidth={2.2} aria-hidden />
        <BatteryFull size={17} strokeWidth={2} aria-hidden />
        <Clock format="menubar" />
      </div>
      <Window
        className="os-window"
        sidebar={sidebar}
        sidebarWidth={220}
        title={shown.title}
        toolbar={
          links.length ? (
            <a className="os-toolbar-link" href={links[0]!.url} target="_blank" rel="noopener noreferrer">
              {links[0]!.label}
              <ArrowUpRight size={13} strokeWidth={2} aria-hidden />
            </a>
          ) : undefined
        }
      >
        <article className="os-doc" aria-labelledby="os-doc-title">
          <h2 id="os-doc-title" className="sr-only">
            {shown.title}
          </h2>
          <p className="os-kicker">
            <Text>{shown.role ?? ""}</Text>
            {shown.period ? (
              <>
                <span aria-hidden="true"> · </span>
                <Text>{shown.period}</Text>
              </>
            ) : null}
          </p>
          <p className="os-summary">
            <Text>{shown.summary}</Text>
          </p>
          <Metrics items={shown.metrics} />
          <Prose html={shown.html} />
          {shown.images.length ? (
            <ul className="os-shots">
              {shown.images.map((image) => (
                <li key={image.src}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- screenshots inside the 3D screen, laid out at a fixed size */}
                  <img src={image.src} alt={image.alt} loading="lazy" />
                </li>
              ))}
            </ul>
          ) : null}
        </article>
      </Window>
    </div>
  );
}
