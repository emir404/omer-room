import type { WebGLRenderer } from "three";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { ASSETS } from "./assets";

/**
 * One shared KTX2Loader, created after the renderer exists (detectSupport needs it) and pointed
 * at the transcoder copied from the installed three version (scripts/copy-basis.mjs).
 * Phase 2 loads baked lightmaps through this; textures stay outside the GLB so tiers can differ.
 */
let loader: KTX2Loader | null = null;

export function getKTX2Loader(gl: WebGLRenderer): KTX2Loader {
  if (!loader) {
    loader = new KTX2Loader().setTranscoderPath(ASSETS.basisTranscoderPath).detectSupport(gl);
  }
  return loader;
}
