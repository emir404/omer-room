"use client";

import { type ReactNode, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import { scene, screenSlots } from "@/components/room/registry";
import type { SceneData } from "@/lib/content/scene-data";
import { isDesktopWidth } from "@/lib/layout";
import type { ScreenId } from "@/lib/scene-contract";
import { useRoom } from "@/lib/store";
import { OmerOS } from "./OmerOS";
import { PhoneUI } from "./PhoneUI";
import "./screens.css";

/** The phone UI is laid out in iPhone points (the kit's Phone): 402 × 874. */
const PHONE = { width: 402, height: 874 } as const;

/**
 * The desktop is laid out at 16:10, at about the size it will have once the camera rests on it
 * (the monitor then fills ~84% of the viewport, CameraRig), so docking it is a 1:1 CSS zoom and
 * the text is crisp. Clamped so small windows still get a full desktop.
 */
function computerSize(vw: number, vh: number) {
  const h = Math.min(vh * 0.84, (vw * 0.84) / 1.6);
  const width = Math.max(960, Math.min(1440, Math.round(h * 1.6)));
  return { width, height: Math.round(width / 1.6) };
}

const subscribeResize = (cb: () => void) => {
  window.addEventListener("resize", cb);
  return () => window.removeEventListener("resize", cb);
};
const viewport = () => `${window.innerWidth}x${window.innerHeight}`;

function Slot({ id, width, height, docked, label, children }: { id: ScreenId; width: number; height: number; docked: boolean; label: string; children: ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!el.current || !inner.current) return;
    screenSlots.set(id, { el: el.current, inner: inner.current, width, height, docked });
    scene.invalidate();
    return () => {
      screenSlots.delete(id);
    };
  }, [id, width, height, docked]);
  // docked: keyboard focus moves onto the screen (Tab then walks its controls)
  useEffect(() => {
    if (!docked) return;
    const frame = requestAnimationFrame(() => el.current?.focus({ preventScroll: true }));
    return () => cancelAnimationFrame(frame);
  }, [docked]);
  return (
    <div ref={el} className="screen" data-screen={id} data-docked={docked ? "1" : "0"} inert={!docked} role="region" aria-label={label} tabIndex={-1}>
      <div ref={inner} className="screen-inner" style={{ width, height }}>
        {children}
      </div>
    </div>
  );
}

/**
 * The computer's and the phone's live UIs. They sit behind the canvas, mapped onto their screens
 * (ScreenProjector), so the room always shows them running. When a screen chapter is open and the
 * camera has arrived, that screen docks: it takes clicks and keyboard focus, and the canvas lets
 * pointer events through. Clicking around it (the backdrop) steps back into the room.
 *
 * On narrow viewports the computer opens as a sheet instead (its page content, PanelHost).
 */
export function ScreenLayer({ data }: { data: SceneData }) {
  const focus = useRoom((s) => s.focus);
  const chapter = useRoom((s) => s.chapter);
  const item = useRoom((s) => s.item);
  const atRest = useRoom((s) => s.cameraAtRest);
  const ready = useRoom((s) => s.sceneReady);
  const navigate = useRoom((s) => s.navigate);
  const size = useSyncExternalStore(subscribeResize, viewport, () => "1440x900");
  // the desktop keeps the last app you opened; the phone goes back to its home screen
  const lastApp = useRoom((s) => s.lastComputerApp);
  const [vw, vh] = size.split("x").map(Number) as [number, number];
  const computer = computerSize(vw, vh);

  const wantsDock = ready && atRest && (focus === "computer" || focus === "phone");
  const docked: ScreenId | null = wantsDock && !(focus === "computer" && !isDesktopWidth(vw)) ? (focus as ScreenId) : null;

  useEffect(() => {
    if (docked) document.documentElement.dataset.docked = docked;
    else delete document.documentElement.dataset.docked;
    return () => {
      delete document.documentElement.dataset.docked;
    };
  }, [docked]);

  return (
    <div className="screens" data-docked={docked ?? undefined} data-ready={ready ? "1" : "0"}>
      {docked ? <button type="button" className="screens-backdrop" aria-label="Step back into the room" tabIndex={-1} onClick={() => navigate("/")} /> : null}
      <Slot id="computer" width={computer.width} height={computer.height} docked={docked === "computer"} label="Ömer's computer">
        <OmerOS apps={data.computer} active={chapter === "computer" ? (item ?? lastApp) : lastApp} name={data.name} />
      </Slot>
      <Slot id="phone" width={PHONE.width} height={PHONE.height} docked={docked === "phone"} label="Ömer's phone">
        <PhoneUI apps={data.phone} socials={data.socials} name={data.name} tagline={data.tagline} email={data.email} active={chapter === "phone" ? item : null} />
      </Slot>
    </div>
  );
}
