import type { Tier } from "./quality";

/**
 * Asset manifest — the one place the scene learns which files to load.
 * Phase 2 (Blender art pass) flips `room` to the baked GLB and fills `lightmaps`;
 * no component code changes.
 */
export interface LightmapSet {
  day: string;
  night: string;
  /** R = desk lamp, G = monitor, B = string lights (each baked alone). */
  mask: string;
}

export interface AssetManifest {
  version: string;
  room: string;
  /** Per tier, per bake set (node userData.bake). null = blockout lighting. */
  lightmaps: Record<Tier, Record<string, LightmapSet>> | null;
  basisTranscoderPath: string;
}

export const ASSETS: AssetManifest = {
  version: "blockout-1",
  room: "/3d/room.glb",
  lightmaps: null,
  basisTranscoderPath: "/basis/r187/",
};

export const roomUrl = () => `${ASSETS.room}?v=${ASSETS.version}`;
