"use client";

import {
  AddOperation,
  Color,
  type CubeTexture,
  type Material,
  MeshBasicMaterial,
  MeshStandardMaterial,
  ShaderChunk,
  type Texture,
  Vector3,
  type WebGLProgramParametersWithUniforms,
} from "three";
import type { NodeExtras } from "@/lib/scene-contract";

/**
 * The single material entry point for room meshes.
 *
 * Baked (art pass, `lightmap` given): an unlit MeshBasicMaterial whose lighting comes from the
 * Blender bakes on UV1 —
 *     day   = RGBM(dayMap) · scale.day                         (sun + sky)
 *     night = lum(day) · nightTint + Σ mask.i · scale.mask[i] · color.i   (moonlight + lamps)
 *     color = albedo × mix(day, night, nightness) · exposure  (+ glow, hover highlight, metal sheen)
 * It stays a MeshBasicMaterial so `.map`/`.color` work as usual (book spines, photos, the letter).
 *
 * Realtime (no lightmap): a MeshStandardMaterial lit by <Lights /> — the Phase 1 blockout, and the
 * baked room's moving things (globe, ball), whose lighting can't be baked onto them.
 */
export interface LightmapBinding {
  day: Texture;
  mask: Texture;
  dayScale: number;
  maskScale: [number, number, number];
  rgbmRange: number;
}

export interface RoomMaterialOptions {
  color: Color;
  map?: Texture | null;
  roughness?: number;
  metalness?: number;
  glow?: NodeExtras["glow"];
  lightmap?: LightmapBinding | null;
  /** Baked metals: a cube map to reflect (scaled by the local light level). */
  envMap?: CubeTexture | null;
}

export type RoomMaterial = MeshStandardMaterial | MeshBasicMaterial;

const linear = (hex: string) => new Color(hex);
/** A light color normalized to mean 1: the masks store mean(RGB) of each light's colored bake. */
const unit = (hex: string) => {
  const c = linear(hex);
  return c.multiplyScalar(3 / (c.r + c.g + c.b));
};

/** Shared by every baked material: day/night is one uniform write, not a loop. */
export const ROOM_UNIFORMS = {
  uNight: { value: 0 },
  uExposure: { value: 1 },
  uNightTint: { value: new Color(0.02, 0.028, 0.064) },
  uLampColor: { value: unit("#FFB25C") },
  uMonitorColor: { value: unit("#A8D4FF") },
  uStringColor: { value: unit("#FFC46E") },
  /** Per light group intensity (x lamp, y monitor, z string lights): flicker, toggles. */
  uLamps: { value: new Vector3(1.35, 1, 1) },
};

const GLOW: Record<NonNullable<NodeExtras["glow"]>, Color> = {
  lamp: new Color("#FFB45E"),
  monitor: new Color("#A8D8FF"),
  string: new Color("#FFD27A"),
};
/** How lit each glow is by day (the string lights stay on: it's that kind of room). */
const GLOW_DAY: Record<NonNullable<NodeExtras["glow"]>, number> = { lamp: 0.12, monitor: 0.35, string: 0.8 };
const HIGHLIGHT = new Color("#FFD9A0");

interface RoomUserData {
  glow: NodeExtras["glow"] | null;
  baked?: { uEmissive: { value: Color }; uMetal: { value: number } };
}

const BAKED_PARS = /* glsl */ `
uniform sampler2D uMask;
uniform float uDayScale;
uniform vec3 uMaskScale;
uniform float uRgbm;
uniform float uNight;
uniform float uExposure;
uniform vec3 uNightTint;
uniform vec3 uLampColor;
uniform vec3 uMonitorColor;
uniform vec3 uStringColor;
uniform vec3 uLamps;
uniform vec3 uEmissive;
uniform float uMetal;
float roomLight;
`;

// Lightmaps are atlases: from afar, low mips average neighboring islands into dark dotted seams.
// Sampling one mip sharper keeps seams clean; the lighting is smooth enough not to shimmer.
const LIGHTMAP_BIAS = "-1.0";

const BAKED_LIGHT = /* glsl */ `
	lightMapTexel = texture2D( lightMap, vLightMapUv, ${LIGHTMAP_BIAS} );
	vec3 lDay = lightMapTexel.rgb * ( lightMapTexel.a * lightMapTexel.a ) * uRgbm * uDayScale;
	vec3 lMask = texture2D( uMask, vLightMapUv, ${LIGHTMAP_BIAS} ).rgb * uMaskScale;
	vec3 lNight = dot( lDay, vec3( 0.2126, 0.7152, 0.0722 ) ) * uNightTint
		+ lMask.r * uLamps.x * uLampColor + lMask.g * uLamps.y * uMonitorColor + lMask.b * uLamps.z * uStringColor;
	vec3 lRoom = mix( lDay, lNight, uNight ) * uExposure;
	roomLight = dot( lRoom, vec3( 0.2126, 0.7152, 0.0722 ) );
	reflectedLight.indirectDiffuse += lRoom * ( 1.0 - 0.35 * uMetal );
`;

// three's envmap chunk, with the additive blend scaled by albedo and the local light level
const BAKED_ENVMAP = ShaderChunk.envmap_fragment.replace(
  "outgoingLight += envColor.xyz * specularStrength * reflectivity;",
  "outgoingLight += envColor.xyz * diffuseColor.rgb * reflectivity * clamp( roomLight, 0.0, 1.6 );",
);

function bakedMaterial(options: RoomMaterialOptions, lm: LightmapBinding): MeshBasicMaterial {
  const metal = (options.metalness ?? 0) > 0.5 && Boolean(options.envMap);
  const material = new MeshBasicMaterial({
    color: options.color,
    map: options.map ?? null,
    lightMap: lm.day,
    envMap: metal ? options.envMap! : null,
    combine: AddOperation,
    reflectivity: metal ? 0.55 * (1 - (options.roughness ?? 0.4) * 0.6) : 0,
  });
  const own = {
    uMask: { value: lm.mask },
    uDayScale: { value: lm.dayScale },
    uMaskScale: { value: new Vector3(...lm.maskScale) },
    uRgbm: { value: lm.rgbmRange },
    uEmissive: { value: new Color(0, 0, 0) },
    uMetal: { value: metal ? 1 : 0 },
  };
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms) => {
    Object.assign(shader.uniforms, ROOM_UNIFORMS, own);
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>\n${BAKED_PARS}`)
      .replace("reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;", BAKED_LIGHT)
      .replace("vec3 outgoingLight = reflectedLight.indirectDiffuse;", "vec3 outgoingLight = reflectedLight.indirectDiffuse + uEmissive;")
      .replace("#include <envmap_fragment>", BAKED_ENVMAP);
  };
  // one program for every baked material (three keys programs by this + its own parameters)
  material.customProgramCacheKey = () => "room-baked-v2";
  (material.userData as RoomUserData).glow = options.glow ?? null;
  (material.userData as RoomUserData).baked = { uEmissive: own.uEmissive, uMetal: own.uMetal };
  return material;
}

export function createRoomMaterial(options: RoomMaterialOptions): RoomMaterial {
  if (options.lightmap) return bakedMaterial(options, options.lightmap);
  const material = new MeshStandardMaterial({
    color: options.color,
    map: options.map ?? null,
    roughness: options.roughness ?? 0.85,
    metalness: options.metalness ?? 0,
  });
  (material.userData as RoomUserData).glow = options.glow ?? null;
  return material;
}

const scratch = new Color();

/** Highlight (0..1) and nightness (0..1) → emissive. Cheap: no shader recompiles. */
export function updateRoomMaterial(material: Material, highlight: number, nightness: number) {
  const data = material.userData as RoomUserData;
  const target = data.baked ? data.baked.uEmissive.value : (material as MeshStandardMaterial).emissive;
  if (!target) return;
  target.setRGB(0, 0, 0);
  if (data.glow) target.copy(GLOW[data.glow]).multiplyScalar(GLOW_DAY[data.glow] + nightness * 1.4);
  if (highlight > 0) target.add(scratch.copy(HIGHLIGHT).multiplyScalar(highlight * (data.baked ? 0.09 : 0.16)));
}

/** Day/night for every baked material at once. */
export function setRoomLighting(nightness: number) {
  ROOM_UNIFORMS.uNight.value = nightness;
  ROOM_UNIFORMS.uExposure.value = 1 + nightness * 0.45;
}

/** Invisible but raycastable: mesh.visible stays true, only drawing is skipped. */
export const HIT_MATERIAL = new MeshBasicMaterial({ visible: false });

/** Unlit material for things that emit their own picture (screens, window view, ticker). */
export function createScreenMaterial(map: Texture): MeshBasicMaterial {
  return new MeshBasicMaterial({ map, toneMapped: false });
}
