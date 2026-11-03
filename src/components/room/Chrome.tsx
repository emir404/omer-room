"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { setSoundEnabled } from "@/lib/sound";
import { useRoom } from "@/lib/store";
import { resolveNightness, storeOverride, type TimeOverride } from "@/lib/time-of-day";

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

const NEXT: Record<TimeOverride, TimeOverride> = { auto: "day", day: "night", night: "auto" };

export function TopBar({ name, now }: { name: string; now: string }) {
  const timeOverride = useRoom((s) => s.timeOverride);
  const nightness = useRoom((s) => s.nightness);
  const sound = useRoom((s) => s.sound);
  const icon = timeOverride === "auto" ? (nightness > 0.5 ? "☾" : "☀") : timeOverride === "day" ? "☀" : "☾";

  return (
    <header className="topbar">
      <Link href="/" scroll={false} className="brand">
        {name}
      </Link>
      <p className="now" title="What I'm up to">
        <span className="now-tag">now</span> <WithTodos text={now} />
      </p>
      <div className="controls">
        <button
          type="button"
          className="control"
          data-testid="time-toggle"
          aria-label={`Lighting: ${timeOverride === "auto" ? "follows your clock" : timeOverride}. Click to change.`}
          onClick={() => {
            const next = NEXT[timeOverride];
            storeOverride(next);
            useRoom.setState({ timeOverride: next });
          }}
        >
          <span aria-hidden="true">{icon}</span>
          <span className="control-text">{timeOverride}</span>
        </button>
        <button
          type="button"
          className="control"
          aria-pressed={sound}
          aria-label={sound ? "Sound on. Click to mute." : "Sound off. Click to turn on."}
          onClick={() => {
            setSoundEnabled(!sound);
            useRoom.setState({ sound: !sound });
          }}
        >
          <span aria-hidden="true">{sound ? "♪" : "♪̸"}</span>
          <span className="control-text">{sound ? "sound" : "muted"}</span>
        </button>
        <Link href="/map" className="control" prefetch={false} aria-label="Text version of this site">
          <span aria-hidden="true">Aa</span>
          <span className="control-text">text version</span>
        </Link>
      </div>
    </header>
  );
}

/** Progress comes from the 3D chunk (LoadProgress in Scene.tsx), so this stays three-free. */
export function Loader({ name }: { name: string }) {
  const progress = useRoom((s) => s.loadProgress);
  const ready = useRoom((s) => s.sceneReady);
  return (
    <div className="loader" data-done={ready ? "1" : "0"} aria-hidden={ready} role="status" aria-live="polite">
      <div className="loader-card">
        <p className="loader-name">{name}</p>
        <div className="loader-bar">
          <span style={{ transform: `scaleX(${Math.max(0.04, progress / 100)})` }} />
        </div>
        <p className="loader-text">{ready ? "come in" : `walking in… ${Math.round(progress)}%`}</p>
      </div>
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

/** Day/night follows the visitor's clock (or the toggle), easing between states. */
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
