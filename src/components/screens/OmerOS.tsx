import Link from "next/link";
import { AppIcon, Gallery, LinkList, Metrics, Prose, Text } from "@/components/panels/ui";
import type { Entry } from "@/lib/content/load";
import type { ComputerApp } from "@/lib/content/schemas";
import { chapterHref } from "@/lib/routes";
import { Clock } from "./Clock";

/**
 * ÖmerOS — the computer's desktop. Every icon is a link (/computer/<app>), so it works without
 * JavaScript, deep-links, and reads fine in the text layout. Styled as a slightly pixelated
 * retro OS in globals.css (.os).
 */
export function OmerOS({ apps, active }: { apps: Entry<ComputerApp>[]; active: Entry<ComputerApp> | null }) {
  return (
    <div className="os" data-testid="omer-os">
      <div className="os-menubar">
        <span className="os-logo">ÖmerOS</span>
        <span className="os-menu">File</span>
        <span className="os-menu">Work</span>
        <span className="os-spacer" />
        <Clock />
      </div>
      <div className="os-desktop">
        <h1 tabIndex={-1} className="sr-only">
          Computer: what I do for work
        </h1>
        <ul className="os-icons" aria-label="Folders">
          {apps.map((app) => (
            <li key={app.slug}>
              <Link
                href={chapterHref("computer", app.slug)}
                scroll={false}
                className="os-icon"
                aria-current={active?.slug === app.slug ? "page" : undefined}
              >
                <AppIcon name={app.data.icon} />
                <span className="os-icon-label">{app.data.title}</span>
              </Link>
            </li>
          ))}
        </ul>

        {active ? (
          <article className="os-window" aria-labelledby={`os-${active.slug}`}>
            <header className="os-titlebar">
              <Link href="/computer" scroll={false} className="os-close" aria-label="Close window">
                ×
              </Link>
              <h2 id={`os-${active.slug}`}>{active.data.title}</h2>
            </header>
            <div className="os-window-body">
              <p className="os-role">
                <Text>{active.data.role}</Text> · <Text>{active.data.period}</Text>
              </p>
              <p className="os-summary">
                <Text>{active.data.summary}</Text>
              </p>
              <Metrics items={active.data.metrics} />
              <Prose html={active.html} />
              <Gallery images={active.data.images} empty="Screenshots coming soon" />
              <LinkList links={active.data.links} />
            </div>
          </article>
        ) : (
          <div className="os-hint">
            <p>Pick a folder.</p>
            <p className="os-hint-small">Esc to step back from the desk.</p>
          </div>
        )}
      </div>
      <Link href="/" scroll={false} className="os-power" aria-label="Step back from the computer">
        <span aria-hidden="true">⏻</span>
      </Link>
    </div>
  );
}
