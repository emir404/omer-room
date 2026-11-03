"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import {
  CylinderGeometry,
  Group,
  type Material,
  Mesh,
  MeshPhysicalMaterial,
  type Object3D,
  Raycaster,
  SphereGeometry,
  SRGBColorSpace,
  type Texture,
  TextureLoader,
  Vector2,
  Vector3,
} from "three";
import { ASSETS } from "@/lib/assets";
import type { ScenePlace } from "@/lib/content/scene-data";
import { detectTier } from "@/lib/quality";
import { useRoom } from "@/lib/store";
import { useSceneIndex } from "../scene-index";

/** Matches the sphere's equirectangular UVs (u = lng, v = lat), so the map and the pins line up. */
export function latLngToVector(lat: number, lng: number, radius: number): Vector3 {
  const phi = ((lng + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new Vector3(-Math.cos(phi) * Math.sin(theta) * radius, Math.cos(theta) * radius, Math.sin(phi) * Math.sin(theta) * radius);
}

const HEAD = new SphereGeometry(1, 20, 14);
const NEEDLE = new CylinderGeometry(0.11, 0.11, 1, 8, 1).translate(0, 0.5, 0);

/**
 * The desk globe: a varnished physical map (Natural Earth relief, art/blender/views.py) on a sphere
 * that spins on its tilted axis. Map pins for every place in content/globe; on /globe you can drag
 * it round, and opening a place turns that pin toward you.
 */
export function Globe({ places }: { places: ScenePlace[] }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const camera = useThree((s) => s.camera);
  const pins = useMemo(() => new Group(), []);
  const tmp = useMemo(() => ({ v: new Vector3() }), []);
  const spin = useRef({ dragging: false, lastX: 0, velocity: 0, touched: -1e9 });
  const sphereRef = useRef<Mesh | null>(null);

  useEffect(() => {
    const pivot = index?.pivots.get("globe");
    if (!index || !pivot) return;
    // the largest mesh on the pivot is the globe itself
    const size = (o: Object3D) => {
      const m = o as Mesh;
      m.geometry.computeBoundingSphere();
      return m.geometry.boundingSphere!.radius * m.scale.x;
    };
    const sphere = pivot.children.filter((c) => (c as Mesh).isMesh).sort((a, b) => size(b) - size(a))[0] as Mesh | undefined;
    if (!sphere) return;
    sphereRef.current = sphere;
    // radius in pivot space (compressed GLBs carry a dequantization scale on the mesh node)
    const radius = size(sphere);
    const center = sphere.position.clone();

    const previous = sphere.material as Material;
    const material = new MeshPhysicalMaterial({
      color: "#ffffff",
      roughness: 0.5,
      metalness: 0,
      clearcoat: 0.7,
      clearcoatRoughness: 0.22,
      envMap: index.envMap,
      envMapIntensity: 0.45,
    });
    let map: Texture | null = null;
    const url = ASSETS.views?.globe[detectTier()];
    if (url) {
      map = new TextureLoader().load(url, () => invalidate());
      map.flipY = false;
      map.colorSpace = SRGBColorSpace;
      map.anisotropy = Math.min(8, gl.capabilities.getMaxAnisotropy());
      material.map = map;
    } else {
      material.color.set("#6FA3B5");
    }
    sphere.material = material;

    const head = new MeshPhysicalMaterial({ color: "#E8590C", roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.12, envMap: index.envMap, envMapIntensity: 0.6 });
    const needle = new MeshPhysicalMaterial({ color: "#C9CDD2", roughness: 0.3, metalness: 0.9, envMap: index.envMap, envMapIntensity: 0.8 });
    pins.name = "runtime_globe_pins";
    const up = new Vector3(0, 1, 0);
    for (const place of places) {
      const dir = latLngToVector(place.lat, place.lng, 1).normalize();
      const pin = new Group();
      pin.position.copy(dir).multiplyScalar(radius).add(center);
      pin.quaternion.setFromUnitVectors(up, dir);
      const stick = new Mesh(NEEDLE, needle);
      stick.scale.set(radius * 0.01, radius * 0.17, radius * 0.01);
      const ball = new Mesh(HEAD, head);
      ball.scale.setScalar(radius * 0.06);
      ball.position.y = radius * 0.17;
      ball.userData.sub = { key: `place:${place.slug}`, label: place.title, href: place.href };
      stick.userData.sub = ball.userData.sub;
      pin.add(stick, ball);
      pins.add(pin);
      index.ownerOf.set(ball, "globe");
      index.ownerOf.set(stick, "globe");
    }
    pivot.add(pins);
    invalidate();
    return () => {
      pivot.remove(pins);
      pins.clear();
      sphere.material = previous;
      sphereRef.current = null;
      map?.dispose();
      material.dispose();
      head.dispose();
      needle.dispose();
    };
  }, [index, places, pins, invalidate, gl]);

  // drag to spin (only while you're looking at the globe)
  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const state = spin.current;
    const onDown = (e: PointerEvent) => {
      const sphere = sphereRef.current;
      if (!sphere || useRoom.getState().focus !== "globe") return;
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.intersectObject(sphere, false).length) return;
      state.dragging = true;
      state.lastX = e.clientX;
      state.velocity = 0;
      state.touched = performance.now();
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = "grabbing";
    };
    const onMove = (e: PointerEvent) => {
      if (!state.dragging) return;
      const pivot = index?.pivots.get("globe");
      if (!pivot) return;
      const dx = e.clientX - state.lastX;
      state.lastX = e.clientX;
      const turn = dx * 0.008;
      pivot.rotation.y += turn;
      state.velocity = turn / (1 / 60);
      state.touched = performance.now();
      invalidate();
    };
    const onUp = (e: PointerEvent) => {
      if (!state.dragging) return;
      state.dragging = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = "";
      invalidate();
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [gl, camera, index, invalidate]);

  useFrame((frame, rawDelta) => {
    const pivot = index?.pivots.get("globe");
    if (!pivot) return;
    const delta = Math.min(rawDelta, 0.1);
    const { focus, item, hovered, testMode } = useRoom.getState();
    if (testMode) return;
    const state = spin.current;
    // the selected pin pulses
    for (const pin of pins.children) {
      const ball = pin.children[1];
      if (!ball) continue;
      const selected = focus === "globe" && (ball.userData.sub as { key: string }).key === `place:${item}`;
      const s = selected ? 1 + 0.18 * Math.sin(frame.clock.elapsedTime * 4) : 1;
      ball.scale.setScalar((ball.userData.base ??= ball.scale.x) * s);
    }
    if (state.dragging) return;
    if (Math.abs(state.velocity) > 0.01) {
      // let go: coast to a stop
      pivot.rotation.y += state.velocity * delta;
      state.velocity *= Math.exp(-delta * 3);
      frame.invalidate();
      return;
    }
    if (focus === "globe") {
      if (focus === "globe" && item) frame.invalidate();
      // after a drag, leave it where you put it; otherwise turn the selected (or first) place to you
      if (performance.now() - state.touched < 5000 && !item) return;
      const place = places.find((p) => p.slug === item) ?? (performance.now() - state.touched < 5000 ? null : places[0]);
      if (!place) return;
      const p = latLngToVector(place.lat, place.lng, 1);
      // compare in the pivot's parent space (the globe's base may be rotated in the room)
      const cam = (pivot.parent ? pivot.parent.worldToLocal(frame.camera.getWorldPosition(tmp.v)) : frame.camera.getWorldPosition(tmp.v)).sub(pivot.position);
      const goal = Math.atan2(cam.x, cam.z) - Math.atan2(p.x, p.z);
      const diff = ((((goal - pivot.rotation.y + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
      pivot.rotation.y += diff * (1 - Math.exp(-delta * 4));
      if (Math.abs(diff) > 0.002) frame.invalidate();
    } else {
      const active = hovered === "globe";
      pivot.rotation.y += delta * (active ? 0.7 : 0.12);
      if (active) frame.invalidate();
    }
  });

  return null;
}
