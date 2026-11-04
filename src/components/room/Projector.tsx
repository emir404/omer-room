"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Box3, type Camera, type Mesh, type Object3D, Vector3 } from "three";
import type { ObjectId } from "@/lib/scene-contract";
import { useRoom } from "@/lib/store";
import { overlay, pinElements } from "./registry";
import { useSceneIndex } from "./scene-index";

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

const labelSize = new WeakMap<HTMLElement, { w: number; h: number }>();
const PIN_STACK = 14; // label bottom sits 14px above the anchor (see .pin-label in globals.css)
const GAP = 4;

/**
 * Touch pins show labels permanently, so dense corners (the desk) would overlap. Place labels
 * bottom-up; a label that collides moves above the one blocking it (CSS draws a leader line back
 * to its dot), and every label is clamped inside the viewport.
 */
function spreadLabels(pins: { el: HTMLElement; x: number; y: number; cx: number; cy: number }[], width: number) {
  // every dot is an obstacle too (except a label's own dot), so a label never covers another pin;
  // and so is the middle of every other object, so a label never hides what you'd tap
  const DOT = 13;
  const BODY = 16;
  const boxes: { l: number; t: number; r: number; b: number; owner?: HTMLElement }[] = pins.flatMap((p) => [
    { l: p.x - DOT, t: p.y - DOT, r: p.x + DOT, b: p.y + DOT, owner: p.el },
    { l: p.cx - BODY, t: p.cy - BODY, r: p.cx + BODY, b: p.cy + BODY, owner: p.el },
  ]);
  pins.sort((a, b) => b.y - a.y);
  for (const pin of pins) {
    const label = pin.el.querySelector<HTMLElement>(".pin-label");
    if (!label) continue;
    let size = labelSize.get(label);
    if (!size || size.w === 0) {
      size = { w: label.offsetWidth, h: label.offsetHeight };
      labelSize.set(label, size);
    }
    const { w, h } = size;
    const natural = pin.x - w / 2;
    const left = Math.min(width - 8 - w, Math.max(8, natural));
    const baseTop = pin.y - PIN_STACK - h;
    let top = baseTop;
    for (let i = 0; i < 12; i++) {
      const hit = boxes.find((b) => b.owner !== pin.el && left < b.r + GAP && left + w > b.l - GAP && top < b.b + GAP && top + h > b.t - GAP);
      if (!hit) break;
      top = hit.t - h - GAP;
    }
    boxes.push({ l: left, t: top, r: left + w, b: top + h });
    pin.el.style.setProperty("--lx", `${(left - natural).toFixed(1)}px`);
    pin.el.style.setProperty("--ly", `${(top - baseTop).toFixed(1)}px`);
  }
}

/**
 * Every rendered frame: project label anchors → pins, and the hovered thing's bounds → the hover
 * label above it. Writes styles directly. (The live screens have their own: ScreenProjector.)
 */
export function Projector() {
  const index = useSceneIndex((s) => s.index);
  const tmp = useMemo(() => ({ v: new Vector3(), box: new Box3(), corners: Array.from({ length: 8 }, () => new Vector3()) }), []);

  const projectBox = (mesh: Mesh, camera: Camera, width: number, height: number): Rect | null => {
    mesh.geometry.computeBoundingBox();
    const b = mesh.geometry.boundingBox!;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let i = 0;
    for (const x of [b.min.x, b.max.x]) {
      for (const y of [b.min.y, b.max.y]) {
        for (const z of [b.min.z, b.max.z]) {
          const p = tmp.corners[i++]!.set(x, y, z).applyMatrix4(mesh.matrixWorld).project(camera);
          if (p.z > 1) return null; // behind the camera
          const sx = (p.x * 0.5 + 0.5) * width;
          const sy = (-p.y * 0.5 + 0.5) * height;
          minX = Math.min(minX, sx);
          maxX = Math.max(maxX, sx);
          minY = Math.min(minY, sy);
          maxY = Math.max(maxY, sy);
        }
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  /** Screen bounds of a whole node (every mesh under it), e.g. a medal and its ribbon. */
  const projectNode = (node: Object3D, camera: Camera, width: number, height: number): Rect | null => {
    const b = tmp.box.setFromObject(node);
    if (b.isEmpty()) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let i = 0;
    for (const x of [b.min.x, b.max.x]) {
      for (const y of [b.min.y, b.max.y]) {
        for (const z of [b.min.z, b.max.z]) {
          const p = tmp.corners[i++]!.set(x, y, z).project(camera);
          if (p.z > 1) return null;
          const sx = (p.x * 0.5 + 0.5) * width;
          const sy = (-p.y * 0.5 + 0.5) * height;
          minX = Math.min(minX, sx);
          maxX = Math.max(maxX, sx);
          minY = Math.min(minY, sy);
          maxY = Math.max(maxY, sy);
        }
      }
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
  };

  // ?test=1 only: lets Playwright click real 3D objects ("where is the letter on screen?")
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  useEffect(() => {
    if (!index || !useRoom.getState().testMode) return;
    (window as unknown as { __roomTest?: unknown }).__roomTest = {
      center(id: ObjectId) {
        const hit = index.hits.get(id);
        const rect = hit ? projectBox(hit, camera, size.width, size.height) : null;
        return rect ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } : null;
      },
      /** Screen-space center of a thing on the shelf (an item id: book_03, medal_gold…). */
      item(id: string) {
        const node = index.items.get(id);
        const rect = node ? projectNode(node, camera, size.width, size.height) : null;
        return rect ? { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 } : null;
      },
      /** What's in your hand. */
      holding: () => useRoom.getState().holding,
    };
  });

  useFrame(({ camera, size }) => {
    if (!index) return;
    const { width, height } = size;

    const { hovered, focus, hoveredSub, touch } = useRoom.getState();
    const placed: { el: HTMLElement; x: number; y: number; cx: number; cy: number }[] = [];
    for (const [id, el] of pinElements) {
      const anchor = index.labels.get(id);
      if (!anchor) continue;
      const p = anchor.getWorldPosition(tmp.v).project(camera);
      const x = (p.x * 0.5 + 0.5) * width;
      const y = (-p.y * 0.5 + 0.5) * height;
      const visible = p.z < 1 && x > -40 && x < width + 40 && y > -40 && y < height + 40;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.dataset.onscreen = visible ? "1" : "0";
      if (!visible) continue;
      const hit = touch && focus === "room" ? index.hits.get(id) : undefined;
      const body = hit ? projectBox(hit, camera, width, height) : null;
      placed.push({ el, x, y, cx: body ? body.x + body.w / 2 : x, cy: body ? body.y + body.h / 2 : y });
    }
    if (touch && focus === "room") spreadLabels(placed, width);
    const selection = overlay.selection;
    if (selection) {
      const node = hoveredSub ? overlay.subNode : null;
      const mesh = hovered && hovered !== focus ? (index.hits.get(hovered) ?? null) : null;
      const rect = node ? projectNode(node, camera, width, height) : mesh ? projectBox(mesh, camera, width, height) : null;
      if (rect) {
        const pad = 6;
        selection.style.transform = `translate3d(${(rect.x - pad).toFixed(1)}px, ${(rect.y - pad).toFixed(1)}px, 0)`;
        selection.style.width = `${(rect.w + pad * 2).toFixed(1)}px`;
        selection.style.height = `${(rect.h + pad * 2).toFixed(1)}px`;
        selection.dataset.visible = "1";
      } else {
        selection.dataset.visible = "0";
      }
    }

  });

  return null;
}
