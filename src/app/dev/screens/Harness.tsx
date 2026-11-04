"use client";

import { type MouseEvent, type ReactNode, useEffect, useState, useSyncExternalStore } from "react";
import { OmerOS } from "@/components/screens/OmerOS";
import { PhoneUI } from "@/components/screens/PhoneUI";
import type { SceneData } from "@/lib/content/scene-data";
import { useRoom } from "@/lib/store";
import "@/components/screens/screens.css";
import "./harness.css";

// Before the first frame renders: ?test=1 freezes the clock at 9:41 and turns transitions off (as
// the e2e shots do), ?time=night switches the wallpaper. A dev page, so a module-level setup is fine.
if (typeof window !== "undefined") {
  const query = new URLSearchParams(window.location.search);
  const html = document.documentElement;
  if (query.get("test") === "1") {
    useRoom.setState({ testMode: true });
    html.dataset.test = "1";
  }
  html.dataset.time = query.get("time") === "night" ? "night" : "day";
}

const noop = () => () => {};

type Frame = { id: string; label: string; width: number; height: number; compact?: boolean; node: ReactNode };

interface HarnessProps {
  data: SceneData;
  frame?: string;
  os?: string;
  osc?: string;
  app?: string;
  showSwitch: boolean;
}

/** The frames, each a `.screen-inner` box at the design size ScreenLayer would give it. */
export function Harness({ data, frame, os, osc, app, showSwitch }: HarnessProps) {
  // client only, like the real screens (ScreenLayer is never server-rendered)
  const ready = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  const [role, setRole] = useState<string | null>(os ?? null);
  const [compactRole, setCompactRole] = useState<string | null>(osc ?? null);
  const [phoneApp, setPhoneApp] = useState<string | null>(app ?? null);
  const [awake, setAwake] = useState(true);

  // for filming transitions from a script: window.__screens.wake(false), .phone("copilot"), …
  useEffect(() => {
    Object.assign(window, { __screens: { wake: setAwake, phone: setPhoneApp, os: setRole, compact: setCompactRole } });
  }, []);

  /** Links inside a frame drive the frame (the room's routes don't exist here). */
  const follow = (event: MouseEvent) => {
    const link = (event.target as HTMLElement).closest("a");
    const href = link?.getAttribute("href");
    if (!href?.startsWith("/")) return;
    event.preventDefault();
    event.stopPropagation();
    const [, chapter, item = null] = href.match(/^\/(computer|phone)(?:\/([^/?#]+))?/) ?? [];
    if (chapter === "computer") {
      setRole(item ?? role);
      setCompactRole(item);
    } else if (chapter === "phone") {
      setPhoneApp(item);
    } else if (href === "/") {
      setAwake(false);
      setCompactRole(null);
    }
  };

  const phone = (props: { awake: boolean; active: string | null }) => (
    <PhoneUI
      apps={data.phone}
      socials={data.socials}
      name={data.name}
      tagline={data.tagline}
      email={data.email}
      now={data.now}
      location={data.location}
      calUrl={data.calUrl}
      {...props}
    />
  );
  const firstApp = data.phone[0]?.slug ?? null;
  const firstRole = data.computer[0]?.slug ?? null;

  const frames: Frame[] = [
    { id: "os-1440", label: "OmerOS · wide · 1440 × 900 (largest design size)", width: 1440, height: 900, node: <OmerOS apps={data.computer} active={role} name={data.name} layout="wide" /> },
    { id: "os-1280", label: "OmerOS · wide · 1280 × 800", width: 1280, height: 800, node: <OmerOS apps={data.computer} active={role} name={data.name} layout="wide" /> },
    { id: "os-1210", label: "OmerOS · wide · 1210 × 756 (a 1440 × 900 viewport)", width: 1210, height: 756, node: <OmerOS apps={data.computer} active={role} name={data.name} layout="wide" /> },
    { id: "os-960", label: "OmerOS · wide · 960 × 600 (smallest design size)", width: 960, height: 600, node: <OmerOS apps={data.computer} active={role} name={data.name} layout="wide" /> },
    { id: "os-compact", label: "OmerOS · compact · 390 × 844", width: 390, height: 844, compact: true, node: <OmerOS apps={data.computer} active={compactRole} name={data.name} layout="compact" /> },
    {
      id: "os-compact-role",
      label: "OmerOS · compact · 390 × 844 · a role",
      width: 390,
      height: 844,
      compact: true,
      node: <OmerOS apps={data.computer} active={osc ?? firstRole} name={data.name} layout="compact" />,
    },
    { id: "phone-awake", label: "PhoneUI · awake · 402 × 874", width: 402, height: 874, node: phone({ awake, active: phoneApp }) },
    { id: "phone-app", label: "PhoneUI · awake · an app page", width: 402, height: 874, node: phone({ awake: true, active: app ?? firstApp }) },
    { id: "phone-asleep", label: "PhoneUI · asleep (lock screen)", width: 402, height: 874, node: phone({ awake: false, active: null }) },
  ];
  const shown = frame ? frames.filter((f) => f.id === frame) : frames;

  return (
    <main className="dev-screens" data-single={frame ? "1" : undefined}>
      {frame ? null : (
        <header className="dev-head">
          <h1>Screens</h1>
          <p>
            Frames: {frames.map((f) => f.id).join(", ")}. The phone&rsquo;s first frame wakes and sleeps:{" "}
            <button type="button" onClick={() => setAwake((a) => !a)}>
              {awake ? "Lock" : "Wake"}
            </button>
          </p>
        </header>
      )}
      {ready
        ? shown.map((f) => (
            <section key={f.id} id={f.id} className="dev-frame">
              {frame ? null : <h2>{f.label}</h2>}
              <div className="screen-inner dev-screen" data-frame={f.id} style={{ width: f.width, height: f.height }} onClickCapture={follow}>
                {f.node}
                {f.compact && showSwitch ? <span className="dev-switch" aria-hidden="true" /> : null}
              </div>
            </section>
          ))
        : null}
    </main>
  );
}
