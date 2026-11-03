"use client";

import { usePathname } from "next/navigation";
import { type ReactNode, useEffect, useLayoutEffect, useRef, useState } from "react";
import { focusObjectButton } from "@/components/room/registry";
import { CHAPTERS, type ChapterId, parentPath, parsePath } from "@/lib/routes";
import { playSfx } from "@/lib/sound";
import { useRoom } from "@/lib/store";

type HostKind = "intro" | "panel" | "screen";

interface Snapshot {
  key: string;
  kind: HostKind;
  html: string;
  style: string;
  scrollTop: number;
}

/**
 * Where page content goes. The same server-rendered children are placed by CSS according to
 * html[data-mode] and this host's data-kind:
 *   room mode: a right-hand sheet (a bottom sheet on phones) for panel chapters; screen chapters
 *              live on the monitor and the phone (ScreenLayer), except the computer on phones,
 *              which opens here as a sheet
 *   doc mode:  hidden — the text view (in the layout) shows everything
 *
 * Exit animation without router hacks: Next's layout `children` always renders the *current*
 * route, so an exiting React tree would show the new page. Instead, right before the new chapter
 * paints, the old host's DOM is frozen into an inert "ghost" copy that fades out on top.
 */
export function PanelHost({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { chapter } = parsePath(pathname);
  const key = chapter ?? "intro";
  const kind: HostKind = chapter ? CHAPTERS[chapter].kind : "intro";

  const atRest = useRoom((s) => s.cameraAtRest);
  const sceneReady = useRoom((s) => s.sceneReady);
  const [expanded, setExpanded] = useState(false);
  const [ghost, setGhost] = useState<(Snapshot & { id: number }) | null>(null);
  const host = useRef<HTMLElement>(null);
  const snapshot = useRef<Snapshot | null>(null);
  const previous = useRef<{ key: string; chapter: ChapterId | null }>({ key, chapter });

  // 1) chapter changed → show the previous chapter's frozen DOM as a fading ghost (before paint)
  useLayoutEffect(() => {
    const was = previous.current;
    if (was.key !== key && snapshot.current?.key === was.key) {
      // layout effect on purpose: the ghost must exist before the new chapter paints
      setGhost({ ...snapshot.current, id: Date.now() });
      setExpanded(false);
    }
    previous.current = { key, chapter };
  }, [key, chapter]);

  // 2) after every commit, remember what this chapter looks like (for the next exit)
  useLayoutEffect(() => {
    const el = host.current;
    if (!el) return;
    snapshot.current = {
      key,
      kind,
      html: el.innerHTML,
      style: el.getAttribute("style") ?? "",
      scrollTop: el.querySelector(".chapter-scroll")?.scrollTop ?? 0,
    };
  });

  // Esc closes: item → its list (the panel's back link) → chapter → room. Never history.back()
  // (deep-link visitors would leave the site).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (parsePath(window.location.pathname).focus === "room") return;
      event.preventDefault();
      playSfx("close");
      const back = document.querySelector<HTMLAnchorElement>(".chapter-host:not(.chapter-ghost) [data-back]")?.getAttribute("href");
      useRoom.getState().navigate(back ?? parentPath(window.location.pathname));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // focus: opening a chapter focuses its heading; closing returns focus to the object's button
  const lastChapter = useRef<ChapterId | null>(chapter);
  useEffect(() => {
    const was = lastChapter.current;
    lastChapter.current = chapter;
    if (chapter) {
      requestAnimationFrame(() => host.current?.querySelector<HTMLElement>('h1[tabindex="-1"]')?.focus({ preventScroll: true }));
    } else if (was) {
      requestAnimationFrame(() => focusObjectButton(was));
    }
  }, [chapter]);

  return (
    <>
      {ghost ? (
        <section
          key={ghost.id}
          className="chapter-host chapter-ghost"
          data-kind={ghost.kind}
          data-rest="1"
          aria-hidden="true"
          inert
          ref={(el) => {
            if (!el) return;
            el.setAttribute("style", ghost.style);
            const scroller = el.querySelector(".chapter-scroll");
            if (scroller) scroller.scrollTop = ghost.scrollTop;
          }}
          onAnimationEnd={() => setGhost(null)}
          dangerouslySetInnerHTML={{ __html: ghost.html }}
        />
      ) : null}
      <section
        key={key}
        ref={host}
        className="chapter-host"
        data-host={key}
        data-kind={kind}
        data-screen={kind === "screen" ? chapter : undefined}
        data-rest={atRest && sceneReady ? "1" : "0"}
        data-expanded={expanded ? "1" : "0"}
        aria-label={chapter ? CHAPTERS[chapter].title : "Welcome"}
      >
        {kind === "panel" || chapter === "computer" ? (
          <button
            type="button"
            className="sheet-handle"
            aria-label={expanded ? "Collapse panel" : "Expand panel"}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            <span aria-hidden="true" />
          </button>
        ) : null}
        <div className="chapter-scroll" key={pathname}>
          {children}
        </div>
      </section>
    </>
  );
}
