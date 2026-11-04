"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { CHAPTERS, parsePath } from "@/lib/routes";
import { useRoom } from "@/lib/store";
import { resolveNightness } from "@/lib/time-of-day";

/** Renders "TODO(Ömer): …" placeholders highlighted so they're easy to spot on the preview. */
export function WithTodos({ text }: { text: string }) {
  const parts = text.split(/(TODO(?:\(Ömer\))?:?[^·]*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) =>
        part.startsWith("TODO") ? (
          <mark key={i} className="todo">
            {part.trim()}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

/** Progress comes from the 3D chunk (LoadProgress in Scene.tsx), so this stays three-free. */
export function Loader({ name }: { name: string }) {
  const progress = useRoom((s) => s.loadProgress);
  const ready = useRoom((s) => s.sceneReady);
  // from the URL, so the server renders it too (the still is in the first paint)
  const { chapter } = parsePath(usePathname());
  // the overview: a still of the room (taken from the 3D, `pnpm posters`) that the real one fades
  // in over; a chapter with a caption: the dimmed room's dark, so its words can show at once
  const ground = !chapter ? "poster" : CHAPTERS[chapter].kind === "caption" ? "dark" : "plain";
  return (
    <div className="loader" data-done={ready ? "1" : "0"} data-ground={ground} aria-hidden={ready} role="status" aria-live="polite">
      {ground === "poster" ? (
        <>
          <div className="loader-poster" aria-hidden="true" />
          {/* whose room it is, while it loads (and the page's largest early paint, for LCP) */}
          <p className="loader-name">{name}</p>
        </>
      ) : null}
      <div className="loader-bar" aria-hidden="true">
        <span style={{ transform: `scaleX(${Math.max(0.04, progress / 100)})` }} />
      </div>
      <p className="loader-text">{ready ? "Come in" : `Loading the room · ${Math.round(progress)}%`}</p>
    </div>
  );
}

export function Toast() {
  const toast = useRoom((s) => s.toast);
  // visible until the timer marks this toast's id as dismissed
  const [dismissed, setDismissed] = useState<number | null>(null);
  const visible = toast !== null && toast.id !== dismissed;
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setDismissed(toast.id), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);
  return (
    <div className="toast" role="status" aria-live="polite" data-visible={visible ? "1" : "0"}>
      {toast?.text ? <WithTodos text={toast.text} /> : null}
    </div>
  );
}

/** Day/night follows the visitor's clock (or ?time=day|night), easing between states. */
export function TimeKeeper() {
  const override = useRoom((s) => s.timeOverride);
  const nightness = useRoom((s) => s.nightness);
  const first = useRef(true);

  useEffect(() => {
    let raf = 0;
    const ease = (to: number, duration: number) => {
      cancelAnimationFrame(raf);
      const from = useRoom.getState().nightness;
      if (Math.abs(from - to) < 0.001 || duration === 0) {
        useRoom.setState({ nightness: to });
        return;
      }
      const start = performance.now();
      const step = (now: number) => {
        const k = Math.min(1, (now - start) / duration);
        const e = k * k * (3 - 2 * k);
        useRoom.setState({ nightness: from + (to - from) * e });
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const { reducedMotion, testMode } = useRoom.getState();
    // the first time, start where the page already is (the loader's still matches it); later
    // changes (the window's switch, the clock passing dusk) ease
    ease(resolveNightness(override), reducedMotion || testMode || first.current ? 0 : 1400);
    first.current = false;
    const interval = window.setInterval(() => ease(resolveNightness(override), 4000), 60_000);
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(interval);
    };
  }, [override]);

  useEffect(() => {
    document.documentElement.style.setProperty("--night", nightness.toFixed(3));
    document.documentElement.dataset.time = nightness > 0.5 ? "night" : "day";
  }, [nightness]);

  return null;
}
