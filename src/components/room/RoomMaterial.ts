"use client";

import { Color, MeshBasicMaterial, MeshStandardMaterial, type Texture } from "three";
import type { LightmapSet } from "@/lib/assets";
import type { NodeExtras } from "@/lib/scene-contract";

/**
 * The single material entry point for room meshes.
 *
 * Phase 1 (blockout, `lightmaps` absent): a MeshStandardMaterial lit by the scene's hemisphere +
 * directional lights. Phase 2 (art pass): the same call with `lightmaps` returns the baked
 * shader — albedo × mix(day, night) + light masks — without callers changing.
 */
export interface RoomMaterialOptions {
  color: Color;
  map?: Texture | null;
  roughness?: number;
  metalness?: number;
  glow?: NodeExtras["glow"];
  lightmaps?: { set: LightmapSet; textures: Record<keyof LightmapSet, Texture> } | null;
}

const GLOW: Record<NonNullable<NodeExtras["glow"]>, Color> = {
  lamp: new Color("#FFB45E"),
  monitor: new Color("#A8D8FF"),
  string: new Color("#FFD27A"),
};
const HIGHLIGHT = new Color("#FFD9A0");

interface RoomUserData {
  glow: NodeExtras["glow"] | null;
}

export function createRoomMaterial(options: RoomMaterialOptions): MeshStandardMaterial {
  if (options.lightmaps) {
    // Wired in the art pass; failing loudly beats silently rendering unlit geometry.
    throw new Error("Baked lightmaps are part of Phase 2 — see art/README.md");
  }
  const material = new MeshStandardMaterial({
    color: options.color,
    map: options.map ?? null,
    roughness: options.roughness ?? 0.85,
    metalness: options.metalness ?? 0,
  });
  (material.userData as RoomUserData).glow = options.glow ?? null;
  return material;
}

/** Highlight (0..1) and nightness (0..1) → emissive. Cheap: no shader recompiles. */
export function updateRoomMaterial(material: MeshStandardMaterial, highlight: number, nightness: number) {
  const glow = (material.userData as RoomUserData).glow;
  material.emissive.setRGB(0, 0, 0);
  if (glow) material.emissive.copy(GLOW[glow]).multiplyScalar(0.15 + nightness * 1.4);
  if (highlight > 0) material.emissive.lerp(HIGHLIGHT, highlight * 0.16);
}

/** Invisible but raycastable: mesh.visible stays true, only drawing is skipped. */
export const HIT_MATERIAL = new MeshBasicMaterial({ visible: false });

/** Unlit material for things that emit their own picture (screens, window view, ticker). */
export function createScreenMaterial(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, toneMapped: false });
}
