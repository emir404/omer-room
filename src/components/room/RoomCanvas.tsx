"use client";

import { PerformanceMonitor } from "@react-three/drei";
import { Canvas, useThree } from "@react-three/fiber";
import { useMemo } from "react";
import { AgXToneMapping, PCFShadowMap } from "three";
import { ASSETS } from "@/lib/assets";
import type { SceneData } from "@/lib/content/scene-data";
import { detectTier, dprRange } from "@/lib/quality";
import { useRoom } from "@/lib/store";
import { setDocumentMode } from "@/lib/webgl";
import { Scene } from "./Scene";

/** Steps DPR down when the GPU struggles, back up when it recovers (never via the `dpr` prop). */
function AdaptiveDpr({ range }: { range: [number, number] }) {
  const setDpr = useThree((s) => s.setDpr);
  const current = useThree((s) => s.viewport.dpr);
  return (
    <PerformanceMonitor
      onDecline={() => setDpr(Math.max(range[0], current - 0.25))}
      onIncline={() => setDpr(Math.min(range[1], current + 0.25))}
      flipflops={3}
      onFallback={() => setDpr(range[0])}
    />
  );
}

/** The 3D chunk: loaded lazily by RoomShell so text content never waits on three.js. */
export default function RoomCanvas({ data }: { data: SceneData }) {
  const testMode = useRoom((s) => s.testMode);
  const range = useMemo<[number, number]>(() => (testMode ? [1, 1] : dprRange(detectTier())), [testMode]);

  return (
    <Canvas
      className="room-canvas"
      frameloop="demand"
      shadows={ASSETS.lightmaps ? false : { type: PCFShadowMap }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance", preserveDrawingBuffer: testMode }}
      camera={{ fov: 32, near: 0.05, far: 60, position: [6, 4.6, 6.4] }}
      onCreated={(state) => {
        state.setDpr(range[1]);
        // baked lighting comes from Blender (AgX view transform); match it
        if (ASSETS.lightmaps) state.gl.toneMapping = AgXToneMapping;
        const canvas = state.gl.domElement;
        canvas.addEventListener("webglcontextlost", (event) => {
          event.preventDefault();
          // Context failures skip React error boundaries — fall back to the text layout.
          setDocumentMode("doc");
          useRoom.setState({ mode: "doc", sceneReady: false });
          delete document.documentElement.dataset.scene;
        });
      }}
    >
      <AdaptiveDpr range={range} />
      <Scene data={data} />
    </Canvas>
  );
}
