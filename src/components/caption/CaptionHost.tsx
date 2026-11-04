"use client";

import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { focusObjectButton } from "@/components/room/registry";
import type { ChapterData } from "@/lib/content/chapters";
import { type ChapterId, parentPath, parsePath } from "@/lib/routes";
import { playSfx } from "@/lib/sound";
import { useRoom } from "@/lib/store";
import { CaptionChrome, type CaptionView, HoldHint, resolveView } from "./views";
import "./caption.css";

/**
 * The words beside the thing you're looking at: replaces the old side panels. The room dims
 * (Spotlight) and the caption floats over the dark next to the lit object — on the right on
 * desktop, under it on phones (the camera frames the object in the space left free, CameraRig).
 *
 * The view comes from the URL, so it's server-rendered with the page and back/forward work. A new
 * view shows once the camera has arrived; the old one fades out first.
 */
export function CaptionHost({ data }: { data: ChapterData }) {
  const pathname = usePathname();
  const { chapter, item } = parsePath(pathname);
  const view = useMemo(() => resolveView(data, chapter, item), [data, chapter, item]);
  const atRest = useRoom((s) => s.cameraAtRest);
  const ready = useRoom((s) => s.sceneReady);
  const [leaving, setLeaving] = useState<CaptionView | null>(null);
  const last = useRef<CaptionView | null>(view);
  const host = useRef<HTMLDivElement>(null);

  // the previous view fades out on top while the new one waits for the camera
  useEffect(() => {
    const was = last.current;
    last.current = view;
    if (was && was.key !== view?.key) {
      setLeaving(was);
      const timer = window.setTimeout(() => setLeaving(null), 220);
      return () => window.clearTimeout(timer);
    }
  }, [view]);

  // before the room is ready the words already show (over the loader's dark); after, once the
  // camera has arrived
  const shown = Boolean(view) && (!ready || atRest);

  // focus the caption's heading once it's up; give focus back to the object's button on close
  const lastChapter = useRef<ChapterId | null>(chapter);
  useEffect(() => {
    if (!shown) return;
    const frame = requestAnimationFrame(() => host.current?.querySelector<HTMLElement>(".cap-live h1")?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [shown, view?.key]);
  useEffect(() => {
    const was = lastChapter.current;
    lastChapter.current = chapter;
    if (!chapter && was) requestAnimationFrame(() => focusObjectButton(was));
  }, [chapter]);

  // Esc steps back: a thing in your hand → its shelf → the bookcase → the room. Never history.back()
  // (a deep-link visitor would leave the site).
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (parsePath(window.location.pathname).focus === "room") return;
      event.preventDefault();
      playSfx("close");
      const back = document.querySelector<HTMLAnchorElement>(".cap-live [data-back]")?.getAttribute("href");
      useRoom.getState().navigate(back ?? parentPath(window.location.pathname));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="captions" ref={host} data-holding={view?.holding ? "1" : undefined}>
      {leaving ? (
        <div className="cap-layer cap-leaving" key={`out:${leaving.key}`} aria-hidden="true" inert>
          <CaptionChrome view={leaving}>{leaving.node}</CaptionChrome>
        </div>
      ) : null}
      {view ? (
        <div className="cap-layer cap-live" key={view.key} data-shown={shown ? "1" : "0"} aria-hidden={!shown || undefined}>
          <div className="cap-scroll">
            <CaptionChrome view={view}>{view.node}</CaptionChrome>
          </div>
          {view.holding && ready ? <HoldHint /> : null}
        </div>
      ) : null}
    </div>
  );
}
