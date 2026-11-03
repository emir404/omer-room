"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { Color, type Mesh, SRGBColorSpace, type Texture, TextureLoader } from "three";
import type { SceneData } from "@/lib/content/scene-data";
import { useRoom } from "@/lib/store";
import { canvasTexture, ensureFonts, makeCanvas } from "@/lib/textures/canvas";
import { drawFarm, FARM_H, FARM_W } from "@/lib/textures/farm";
import {
  drawLetterPlaceholder,
  drawOSIdle,
  drawPhoneIdle,
  drawTicker,
  LETTER_H,
  LETTER_W,
  OS_H,
  OS_W,
  PHONE_H,
  PHONE_W,
  TICKER_H,
  TICKER_W,
} from "@/lib/textures/screens";
import { createRoomMaterial, createScreenMaterial } from "./RoomMaterial";
import { useSceneIndex } from "./scene-index";

const FPS = 12;

/**
 * Everything that shows a moving picture: the farm through the window, the idle computer and
 * phone screens, the LED "now" ticker — redrawn together at a stepped 12 fps (pixel-art cadence,
 * and the room can idle without rendering at 60). Also puts the letter inside its frame.
 */
export function LiveTextures({ data }: { data: SceneData }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!index) return;
    const farm = makeCanvas(FARM_W, FARM_H);
    const os = makeCanvas(OS_W, OS_H);
    const phone = makeCanvas(PHONE_W, PHONE_H);
    const ticker = makeCanvas(TICKER_W, TICKER_H);
    const textures = {
      farm: canvasTexture(farm.canvas, true),
      os: canvasTexture(os.canvas, true),
      phone: canvasTexture(phone.canvas, true),
      ticker: canvasTexture(ticker.canvas, true),
    };
    const assign = (mesh: Mesh | undefined, texture: Texture) => {
      if (mesh) mesh.material = createScreenMaterial(texture);
    };
    assign(index.displays.get("window"), textures.farm);
    assign(index.screens.get("computer"), textures.os);
    assign(index.screens.get("phone"), textures.phone);
    assign(index.displays.get("now"), textures.ticker);

    // the letter is paper, so it stays lit by the room (and dims at night)
    let letterTexture: Texture;
    if (data.letterImage) {
      letterTexture = new TextureLoader().load(data.letterImage, () => invalidate());
      letterTexture.flipY = false;
      letterTexture.colorSpace = SRGBColorSpace;
    } else {
      const letter = makeCanvas(LETTER_W, LETTER_H);
      drawLetterPlaceholder(letter.ctx);
      letterTexture = canvasTexture(letter.canvas, false);
    }
    const letterMesh = index.displays.get("letter");
    if (letterMesh) {
      const material = createRoomMaterial({ color: new Color("#ffffff"), map: letterTexture, roughness: 0.92 });
      letterMesh.material = material;
      letterMesh.receiveShadow = true;
      index.materials.push(material);
    }

    const { testMode } = useRoom.getState();
    const start = performance.now();
    const draw = () => {
      // tests freeze the clock so screenshots are stable
      const t = testMode ? 2.5 : (performance.now() - start) / 1000;
      const n = useRoom.getState().nightness;
      drawFarm(farm.ctx, t, n);
      drawOSIdle(os.ctx, data.osApps, data.name, t, n);
      drawPhoneIdle(phone.ctx, data.phoneApps, t);
      drawTicker(ticker.ctx, data.now, t, n);
      for (const texture of Object.values(textures)) texture.needsUpdate = true;
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
    // re-draw immediately when day/night flips (don't wait for the next tick)
    const unsubscribe = useRoom.subscribe((s, prev) => {
      if (s.nightness !== prev.nightness) draw();
    });

    return () => {
      disposed = true;
      window.clearInterval(timer);
      unsubscribe();
      for (const texture of Object.values(textures)) texture.dispose();
      letterTexture.dispose();
    };
  }, [index, data, invalidate]);

  return null;
}
