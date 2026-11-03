"use client";

import { useGLTF } from "@react-three/drei";
import { type ThreeEvent, useLoader, useThree } from "@react-three/fiber";
import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import {
  CubeCamera,
  type CubeTexture,
  HalfFloatType,
  type Intersection,
  type Mesh,
  type MeshStandardMaterial,
  type Object3D,
  type Texture,
  type WebGLRenderer,
  WebGLCubeRenderTarget,
} from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { KTX2Loader } from "three/addons/loaders/KTX2Loader.js";
import { ASSETS, type LightmapSet, roomUrl } from "@/lib/assets";
import { detectTier } from "@/lib/quality";
import { objectHref } from "@/lib/routes";
import { type NodeExtras, type ObjectId, parseNodeName } from "@/lib/scene-contract";
import { playSfx } from "@/lib/sound";
import { setHovered, useRoom } from "@/lib/store";
import { overlay } from "./registry";
import { createRoomMaterial, HIT_MATERIAL, type LightmapBinding, setRoomLighting, updateRoomMaterial } from "./RoomMaterial";
import { buildSceneIndex, type SceneIndex, useSceneIndex } from "./scene-index";

const SHELL = /^decor__(floor|wall|rug|baseboard)/;

/** Swap GLB materials for room materials, set shadow flags, and index everything by name. */
function prepare(scene: Object3D, lightmaps: Map<string, LightmapBinding>, envMap: CubeTexture | null): SceneIndex {
  const index = buildSceneIndex(scene);
  index.lightmaps = lightmaps;
  const baked = lightmaps.size > 0;
  scene.traverse((node) => {
    const mesh = node as Mesh;
    if (!mesh.isMesh) return;
    const kind = parseNodeName(mesh.name)?.kind;
    if (kind === "hit") {
      mesh.material = HIT_MATERIAL;
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return;
    }
    if (kind === "screen" || kind === "display") {
      mesh.castShadow = false;
      mesh.receiveShadow = false;
      return; // LiveTextures owns these materials
    }
    const extras = mesh.userData as NodeExtras & { sourceMaterial?: MeshStandardMaterial };
    // always build from the GLB's material (prepare can run twice on the same scene in dev)
    const source = (extras.sourceMaterial ??= mesh.material as MeshStandardMaterial);
    const material = createRoomMaterial({
      color: source.color.clone(),
      map: source.map ?? null,
      roughness: source.roughness,
      metalness: source.metalness,
      glow: extras.glow,
      lightmap: extras.bake ? (lightmaps.get(extras.bake) ?? null) : null,
      envMap,
    });
    mesh.material = material;
    // baked lighting already has its shadows; realtime shadows are a blockout-only thing
    mesh.castShadow = !baked && !SHELL.test(mesh.name);
    mesh.receiveShadow = !baked;
    index.materials.push(material);
    const owner = index.ownerOf.get(mesh);
    if (owner) index.objectMaterials.set(owner, [...(index.objectMaterials.get(owner) ?? []), material]);
  });
  return index;
}

type Target =
  | { kind: "object"; id: ObjectId }
  | { kind: "sub"; key: string; label: string; href: string; mesh: Mesh };

/** Objects whose insides become clickable once the camera is on them. */
const HAS_SUBTARGETS: readonly ObjectId[] = ["shelf", "globe"];

function resolveTarget(index: SceneIndex, intersections: Intersection[]): Target | null {
  const { focus } = useRoom.getState();
  for (const { object } of intersections) {
    // Spines and globe pins carry userData.sub; runtime pins are registered in ownerOf by Globe.
    const owner = index.ownerOf.get(object);
    const sub = object.userData.sub as { key: string; label: string; href: string } | undefined;
    if (sub && owner === focus) return { kind: "sub", ...sub, mesh: object as Mesh };

    const parsed = parseNodeName(object.name);
    const id = parsed?.kind === "hit" ? (parsed.id as ObjectId) : owner;
    if (!id) return null; // walls, furniture: they block what's behind them
    if (id !== focus) return { kind: "object", id };
    if (!HAS_SUBTARGETS.includes(id)) return null; // already looking at it
    // focused shelf/globe: look past its proxy and frame for a spine or pin
  }
  return null;
}

/** Lightmap URLs for this device: [day, mask] per bake set. */
function lightmapUrls(): { sets: [string, LightmapSet][]; urls: string[] } {
  const sets = Object.entries(ASSETS.lightmaps?.[detectTier()] ?? {});
  return { sets, urls: sets.flatMap(([, s]) => [s.day, s.mask]) };
}

function configureKtx2(gl: WebGLRenderer) {
  return (loader: KTX2Loader) => {
    loader.setTranscoderPath(ASSETS.basisTranscoderPath).detectSupport(gl);
  };
}

/** A small cube map of a neutral studio, for the metals' sheen (brass, medals, the rim). */
function studioCube(gl: WebGLRenderer): CubeTexture {
  const target = new WebGLCubeRenderTarget(128, { type: HalfFloatType });
  const env = new RoomEnvironment();
  new CubeCamera(0.05, 20, target).update(gl, env);
  env.traverse((o) => (o as Mesh).geometry?.dispose());
  return target.texture as unknown as CubeTexture;
}

export function Room() {
  const gl = useThree((s) => s.gl);
  const { sets, urls } = useMemo(() => lightmapUrls(), []);
  // start the lightmaps downloading alongside the GLB (useGLTF suspends first)
  useMemo(() => {
    if (urls.length) useLoader.preload(KTX2Loader, urls, configureKtx2(gl));
  }, [urls, gl]);
  const { scene } = useGLTF(roomUrl(), false, true);
  const textures = useLoader(KTX2Loader, urls, configureKtx2(gl)) as Texture[];
  const lightmaps = useMemo(() => {
    const map = new Map<string, LightmapBinding>();
    const aniso = Math.min(4, gl.capabilities.getMaxAnisotropy());
    sets.forEach(([name, set], i) => {
      const day = textures[i * 2]!;
      const mask = textures[i * 2 + 1]!;
      for (const t of [day, mask]) {
        t.channel = 1;
        t.anisotropy = aniso;
        t.needsUpdate = true;
      }
      map.set(name, { day, mask, dayScale: set.scale.day, maskScale: set.scale.mask, rgbmRange: ASSETS.rgbmRange });
    });
    return map;
  }, [sets, textures, gl]);
  const envMap = useMemo(() => (lightmaps.size ? studioCube(gl) : null), [lightmaps, gl]);
  const index = useMemo(() => prepare(scene, lightmaps, envMap), [scene, lightmaps, envMap]);
  const invalidate = useThree((s) => s.invalidate);
  const lastHover = useRef<string | null>(null);

  useLayoutEffect(() => {
    useSceneIndex.setState({ index });
    return () => useSceneIndex.setState({ index: null });
  }, [index]);

  // highlight + day/night → materials
  const hovered = useRoom((s) => s.hovered);
  const nightness = useRoom((s) => s.nightness);
  const focus = useRoom((s) => s.focus);
  useEffect(() => {
    setRoomLighting(nightness);
    for (const m of index.materials) updateRoomMaterial(m, 0, nightness);
    if (hovered && hovered !== focus) {
      for (const m of index.objectMaterials.get(hovered) ?? []) updateRoomMaterial(m, 1, nightness);
    }
    invalidate();
  }, [index, hovered, nightness, focus, invalidate]);

  const apply = (target: Target | null) => {
    const key = target ? (target.kind === "object" ? target.id : target.key) : null;
    if (key && key !== lastHover.current) playSfx("hover");
    lastHover.current = key;
    if (target?.kind === "sub") {
      overlay.subMesh = target.mesh;
      useRoom.setState({ hoveredSub: { key: target.key, label: target.label } });
      setHovered(null, "pointer");
    } else {
      overlay.subMesh = null;
      if (useRoom.getState().hoveredSub) useRoom.setState({ hoveredSub: null });
      setHovered(target?.id ?? null, "pointer");
    }
    gl.domElement.style.cursor = target ? "pointer" : "";
    invalidate();
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (e.pointerType === "touch") return; // touch: no hover, pins are always visible
    apply(resolveTarget(index, e.intersections));
  };

  const onPointerOut = (e: ThreeEvent<PointerEvent>) => {
    if (e.intersections.length === 0) apply(null);
  };

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta > 8) return; // a drag/swipe, not a click
    const target = resolveTarget(index, e.intersections);
    if (!target) return;
    const { navigate } = useRoom.getState();
    if (target.kind === "sub") {
      playSfx("open");
      navigate(target.href);
      return;
    }
    if (target.id === "hoop") {
      useRoom.setState((s) => ({ shotRequest: s.shotRequest + 1 }));
      return;
    }
    const href = objectHref(target.id);
    if (href) {
      playSfx("open");
      navigate(href);
    }
  };

  return <primitive object={scene} onPointerMove={onPointerMove} onPointerOut={onPointerOut} onClick={onClick} />;
}

export function preloadRoom() {
  useGLTF.preload(roomUrl(), false, true);
}
