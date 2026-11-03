"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { useRoom } from "@/lib/store";
import { useSceneIndex } from "./scene-index";

/**
 * `<html data-scene="ready">` once the GLB is indexed, shaders are compiled and two frames have
 * rendered. The loader fades on it; Playwright waits on it.
 */
export function ReadySignal() {
  const index = useSceneIndex((s) => s.index);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!index) return;
    let cancelled = false;
    const frame = () =>
      new Promise<void>((resolve) => {
        invalidate();
        requestAnimationFrame(() => resolve());
      });
    void (async () => {
      try {
        await gl.compileAsync(scene, camera);
      } catch {
        // compileAsync is an optimization; rendering still works without it
      }
      await frame();
      await frame();
      if (cancelled) return;
      document.documentElement.dataset.scene = "ready";
      useRoom.setState({ sceneReady: true });
    })();
    return () => {
      cancelled = true;
    };
  }, [index, gl, scene, camera, invalidate]);

  return null;
}
