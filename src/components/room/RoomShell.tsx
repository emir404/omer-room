"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect } from "react";
import { ModeToggle } from "@/components/ModeToggle";
import { PanelHost } from "@/components/panels/PanelHost";
import type { SceneData } from "@/lib/content/scene-data";
import { isTouchDevice, prefersReducedMotion } from "@/lib/quality";
import { readStoredSound, setSoundEnabled } from "@/lib/sound";
import { useRoom } from "@/lib/store";
import { overrideFromSearch, readStoredOverride } from "@/lib/time-of-day";
import { initialMode, setDocumentMode } from "@/lib/webgl";
import { Loader, TimeKeeper, Toast } from "./Chrome";
import { Hotspots } from "./Hotspots";
import { RouteSync } from "./RouteSync";

/** Text-view sections for each chapter (doc mode shows the whole site as one page). */
const SECTION: Record<string, string> = { shelf: "school", computer: "work", phone: "side-quests", globe: "places", window: "kozan", letter: "letter", contact: "contact" };

/** Doc mode on a chapter URL: open that item (or section) in the text view and scroll to it. */
function DocAnchor() {
  const mode = useRoom((s) => s.mode);
  const chapter = useRoom((s) => s.chapter);
  const item = useRoom((s) => s.item);
  useEffect(() => {
    if (mode !== "doc" || !chapter) return;
    const target = (item && document.getElementById(item)) || document.getElementById(SECTION[chapter] ?? "");
    if (target instanceof HTMLDetailsElement) target.open = true;
    target?.scrollIntoView({ block: "start" });
  }, [mode, chapter, item]);
  return null;
}

// The 3D chunk (three + R3F + drei) loads after the page is already readable; so do the live
// screen UIs, which only exist in the room.
const RoomCanvas = dynamic(() => import("./RoomCanvas"), { ssr: false });
const ScreenLayer = dynamic(() => import("@/components/screens/ScreenLayer").then((m) => m.ScreenLayer), { ssr: false });

function fallBackToText() {
  setDocumentMode("doc");
  delete document.documentElement.dataset.scene;
  useRoom.setState({ mode: "doc", sceneReady: false });
}

/** If anything in the 3D throws (bad GLB, shader error), show the text layout instead. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    console.error("[room] 3D failed, falling back to the text layout", error);
    fallBackToText();
  }
  override render() {
    return this.state.failed ? null : this.props.children;
  }
}

/**
 * The room: the canvas, the live screens behind it, the object buttons/pins and the chapter panels,
 * plus the one control on the page (3D ↔ text). Without WebGL or JavaScript, `text` (the whole
 * site as one page, server-rendered) is what shows instead.
 */
export function RoomShell({ data, text, children }: { data: SceneData; text: ReactNode; children: ReactNode }) {
  const mode = useRoom((s) => s.mode);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const testMode = params.get("test") === "1";
    // tests: no fades/transitions, so screenshots are deterministic (see globals.css)
    if (testMode) document.documentElement.dataset.test = "1";
    const sound = !testMode && readStoredSound();
    if (sound) setSoundEnabled(true);
    useRoom.setState({
      mode: initialMode(),
      touch: isTouchDevice(),
      reducedMotion: prefersReducedMotion(),
      testMode,
      sound,
      timeOverride: overrideFromSearch(window.location.search) ?? readStoredOverride(),
    });

    // WebGL context failures surface as promise rejections, not React errors.
    const onRejection = (event: PromiseRejectionEvent) => {
      if (/webgl|context/i.test(String(event.reason))) fallBackToText();
    };
    window.addEventListener("unhandledrejection", onRejection);
    return () => window.removeEventListener("unhandledrejection", onRejection);
  }, []);

  return (
    <div className="room-root">
      <ModeToggle current="room" />
      {mode === "room" ? (
        <>
          <ScreenLayer data={data} />
          <div className="stage" aria-hidden="true" data-testid="stage">
            <SceneBoundary>
              <RoomCanvas data={data} />
            </SceneBoundary>
          </div>
          <Hotspots objects={data.objects} />
          <Loader />
        </>
      ) : null}
      <RouteSync />
      <DocAnchor />
      <TimeKeeper />
      <div className="when-doc">{text}</div>
      <PanelHost>{children}</PanelHost>
      <Toast />
    </div>
  );
}
