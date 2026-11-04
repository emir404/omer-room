"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Vector3 } from "three";
import { useRoom } from "@/lib/store";
import { surfaces } from "./registry";
import { useSceneIndex } from "./scene-index";
import { uvCorners } from "./ScreenProjector";

/**
 * The letter, exactly as it is: once the camera rests on the frame, the original image file (DOM,
 * LetterSurface) is laid over the picture in the frame at its on-screen size, so what you read is
 * the file itself, not a texture of it. While the camera moves, the 3D picture shows.
 */
export function LetterProjector() {
  const index = useSceneIndex((s) => s.index);
  const corners = useMemo(() => ({ list: [] as Vector3[] }), []);
  const tmp = useMemo(() => new Vector3(), []);
  const invalidate = useThree((s) => s.invalidate);
  const focus = useRoom((s) => s.focus);
  const atRest = useRoom((s) => s.cameraAtRest);

  useEffect(() => {
    const mesh = index?.displays.get("letter");
    corners.list = mesh ? uvCorners(mesh) : [];
  }, [index, corners]);

  // the frame renders on demand: arriving (or leaving) needs one to place (or hide) the letter
  useEffect(() => invalidate(), [focus, atRest, invalidate]);

  useFrame(({ camera, size }) => {
    const el = surfaces.letter;
    const mesh = index?.displays.get("letter");
    if (!el || !mesh || corners.list.length !== 4) return;
    const { focus, cameraAtRest, sceneReady } = useRoom.getState();
    const show = focus === "letter" && cameraAtRest && sceneReady;
    if (!show) {
      if (el.dataset.shown !== "0") el.dataset.shown = "0";
      return;
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of corners.list) {
      const p = tmp.copy(c).applyMatrix4(mesh.matrixWorld).project(camera);
      const x = (p.x * 0.5 + 0.5) * size.width;
      const y = (-p.y * 0.5 + 0.5) * size.height;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    }
    el.style.transform = `translate(${Math.round(minX)}px, ${Math.round(minY)}px)`;
    el.style.width = `${Math.round(maxX - minX)}px`;
    el.style.height = `${Math.round(maxY - minY)}px`;
    el.dataset.shown = "1";
  });

  return null;
}
