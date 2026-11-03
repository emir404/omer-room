"use client";

import dynamic from "next/dynamic";
import { Component, type ReactNode, useEffect } from "react";
import type { SceneData } from "@/lib/content/scene-data";
import { PanelHost } from "@/components/panels/PanelHost";
import { prefersReducedMotion, isTouchDevice } from "@/lib/quality";
import { readStoredSound, setSoundEnabled } from "@/lib/sound";
import { useRoom } from "@/lib/store";
import { overrideFromSearch, readStoredOverride } from "@/lib/time-of-day";
import { initialMode, setDocumentMode } from "@/lib/webgl";
import { Loader, TimeKeeper, Toast, TopBar } from "./Chrome";
import { DocNav } from "./DocNav";
import { Hotspots } from "./Hotspots";
import { RouteSync } from "./RouteSync";

// The 3D chunk (three + R3F + drei) loads after the page is already readable.
const RoomCanvas = dynamic(() => import("./RoomCanvas"), { ssr: false });

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

export function RoomShell({ data, children }: { data: SceneData; children: ReactNode }) {
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
      <TopBar name={data.name} now={data.now} />
      {mode === "room" ? (
        <>
          <div className="stage" aria-hidden="true" data-testid="stage">
            <SceneBoundary>
              <RoomCanvas data={data} />
            </SceneBoundary>
          </div>
          <Hotspots objects={data.objects} />
          <Loader name={data.name} />
        </>
      ) : null}
      <RouteSync />
      <TimeKeeper />
      <DocNav objects={data.objects} />
      <PanelHost>{children}</PanelHost>
      <Toast />
    </div>
  );
}
