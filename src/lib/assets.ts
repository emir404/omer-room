import generated from "./assets.manifest.json";
import type { Tier } from "./quality";

/**
 * Asset manifest — the one place the scene learns which files to load.
 *
 * `assets.manifest.json` is written by `pnpm assets` (scripts/build-assets.ts) from the Blender art
 * pipeline (art/README.md): the baked room GLB and, per device tier and bake set (a mesh's
 * `userData.bake`), its lightmaps. File names carry a content hash, so they can be cached forever.
 */
export interface LightmapSet {
  /** RGBM (linear): light = rgb · a² · rgbmRange · scale.day — daylight (sun + sky). */
  day: string;
  /** sRGB: R = desk lamp, G = monitor, B = string lights, each baked alone (× scale.mask[i]). */
  mask: string;
  scale: { day: number; mask: [number, number, number] };
}

export interface AssetManifest {
  version: string;
  room: string;
  rgbmRange: number;
  /** Per tier, per bake set. null = the Phase 1 blockout (realtime lights). */
  lightmaps: Record<Tier, Record<string, LightmapSet>> | null;
  basisTranscoderPath: string;
}

export const ASSETS: AssetManifest = {
  version: generated.version,
  room: generated.room,
  rgbmRange: generated.rgbmRange,
  lightmaps: generated.lightmaps as unknown as AssetManifest["lightmaps"],
  basisTranscoderPath: "/basis/r187/",
};

export const roomUrl = () => ASSETS.room;
