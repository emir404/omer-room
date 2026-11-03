"use client";

import { useEffect, useState } from "react";
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
export function Loader() {
  const progress = useRoom((s) => s.loadProgress);
  const ready = useRoom((s) => s.sceneReady);
  return (
    <div className="loader" data-done={ready ? "1" : "0"} aria-hidden={ready} role="status" aria-live="polite">
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
    ease(resolveNightness(override), reducedMotion || testMode ? 0 : 1400);
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
