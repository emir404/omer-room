"use client";

import { useFrame, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Color, type Mesh, MeshBasicMaterial, NoBlending, SRGBColorSpace, type Texture, TextureLoader } from "three";
import { ASSETS } from "@/lib/assets";
import type { SceneData } from "@/lib/content/scene-data";
import { detectTier } from "@/lib/quality";
import type { NodeExtras } from "@/lib/scene-contract";
import { useRoom } from "@/lib/store";
import { canvasTexture, ensureFonts, makeCanvas } from "@/lib/textures/canvas";
import { drawLetterPlaceholder, drawTicker, LETTER_H, LETTER_W, TICKER_H, TICKER_W } from "@/lib/textures/screens";
import { createRoomMaterial, createScreenMaterial } from "./RoomMaterial";
import { type SceneIndex, useSceneIndex } from "./scene-index";
import { createWindowViewMaterial, updateWindowView } from "./WindowView";

const FPS = 12;

/**
 * The screens are cut out of the canvas: the live DOM UIs sit behind it (ScreenLayer) and show
 * through wherever the screen is visible. Alpha 0 with no blending, depth-tested like any opaque
 * mesh, so things in front of a screen still cover it.
 */
const HOLE = new MeshBasicMaterial({ color: 0x000000, opacity: 0, blending: NoBlending, toneMapped: false });

/** The default view: Poly Haven's CC0 "Dry Orchard Meadow", reprojected (art/blender/views.py). */
const DEFAULT_VIEW = { fov: 104, horizon: 0.549 };

/** Paper in the frame: lit by the room like everything else (it dims at night). */
function paperMaterial(index: SceneIndex, mesh: Mesh, map: Texture) {
  const bake = (mesh.userData as NodeExtras).bake;
  const material = createRoomMaterial({
    color: new Color("#ffffff"),
    map,
    roughness: 0.92,
    lightmap: bake ? (index.lightmaps.get(bake) ?? null) : null,
  });
  mesh.material = material;
  mesh.receiveShadow = index.lightmaps.size === 0;
  index.materials.push(material);
  return material;
}

/** The real letter (content/letter.md), shown as is: the frame on the wall is built to its shape. */
function Letter({ letter }: { letter: NonNullable<SceneData["letter"]> }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);
  const image = useLoader(TextureLoader, letter.src);
  useEffect(() => {
    const mesh = index?.displays.get("letter");
    if (!index || !mesh) return;
    image.flipY = false;
    image.colorSpace = SRGBColorSpace;
    image.anisotropy = 8;
    image.needsUpdate = true;
    const paper = (mesh.userData as NodeExtras).aspect ?? 8.5 / 11;
    let map: Texture = image;
    // swapped for an image of another shape since the last `pnpm art`? Fit it, never stretch it.
    if (Math.abs(letter.width / letter.height / paper - 1) > 0.02) {
      const h = 2048;
      const w = Math.round(h * paper);
      const { canvas, ctx } = makeCanvas(w, h);
      ctx.fillStyle = "#FBF9F4";
      ctx.fillRect(0, 0, w, h);
      const s = Math.min(w / letter.width, h / letter.height);
      ctx.drawImage(image.image as CanvasImageSource, (w - letter.width * s) / 2, (h - letter.height * s) / 2, letter.width * s, letter.height * s);
      map = canvasTexture(canvas, false);
    }
    paperMaterial(index, mesh, map);
    invalidate();
    return () => {
      if (map !== image) map.dispose();
    };
  }, [index, image, letter, invalidate]);
  return null;
}

/** The photo behind the window (a content photo, or the default orchard), following the camera. */
function WindowView({ url, fov, horizon }: { url: string; fov: number; horizon: number }) {
  const index = useSceneIndex((s) => s.index);
  const map = useLoader(TextureLoader, url);
  const material = useMemo(() => {
    const image = map.image as { width: number; height: number };
    return createWindowViewMaterial({ map, fov, horizon, aspect: image.width / image.height });
  }, [map, fov, horizon]);
  useEffect(() => {
    const mesh = index?.displays.get("window");
    if (mesh) mesh.material = material;
    return () => material.dispose();
  }, [index, material]);
  useFrame((state) => {
    const mesh = index?.displays.get("window");
    if (!mesh) return;
    const { nightness, testMode } = useRoom.getState();
    updateWindowView(material, mesh, state.camera, nightness, testMode ? 0 : state.clock.elapsedTime);
  });
  return null;
}

/** Screen cut-outs, the LED "now" ticker (a stepped 12 fps), the letter placeholder. */
export function LiveTextures({ data }: { data: SceneData }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!index) return;
    for (const id of ["computer", "phone"] as const) {
      const screen = index.screens.get(id);
      if (screen) screen.material = HOLE;
    }

    const ticker = makeCanvas(TICKER_W, TICKER_H);
    const tickerTexture = canvasTexture(ticker.canvas, true);
    const tickerMesh = index.displays.get("now");
    if (tickerMesh) tickerMesh.material = createScreenMaterial(tickerTexture);

    let placeholder: Texture | null = null;
    const letter = index.displays.get("letter");
    if (letter && !data.letter) {
      const canvas = makeCanvas(LETTER_W, LETTER_H);
      drawLetterPlaceholder(canvas.ctx);
      placeholder = canvasTexture(canvas.canvas, false);
      paperMaterial(index, letter, placeholder);
    }

    const { testMode } = useRoom.getState();
    const start = performance.now();
    const draw = () => {
      // tests freeze the clock so screenshots are stable
      const t = testMode ? 2.5 : (performance.now() - start) / 1000;
      drawTicker(ticker.ctx, data.now, t, useRoom.getState().nightness);
      tickerTexture.needsUpdate = true;
      invalidate();
    };
    let timer = 0;
    let disposed = false;
    void ensureFonts().then(() => {
      if (disposed) return;
      draw();
      if (testMode) return;
      timer = window.setInterval(() => {
        if (document.visibilityState === "visible") draw();
      }, 1000 / FPS);
    });
    const unsubscribe = useRoom.subscribe((s, prev) => {
      if (s.nightness !== prev.nightness) draw();
    });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      unsubscribe();
      tickerTexture.dispose();
      placeholder?.dispose();
    };
  }, [index, data.now, data.letter, invalidate]);

  const view = data.windowView ?? (ASSETS.views ? { src: ASSETS.views.window[detectTier()], ...DEFAULT_VIEW } : null);
  return (
    <>
      {view ? <WindowView url={view.src} fov={view.fov} horizon={view.horizon} /> : null}
      {data.letter ? <Letter letter={data.letter} /> : null}
    </>
  );
}
