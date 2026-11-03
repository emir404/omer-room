"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { Group, Mesh, MeshStandardMaterial, type Object3D, SphereGeometry, type Texture, Vector3 } from "three";
import type { ScenePlace } from "@/lib/content/scene-data";
import { useRoom } from "@/lib/store";
import { canvasTexture, makeCanvas } from "@/lib/textures/canvas";
import { useSceneIndex } from "../scene-index";

/** Matches the sphere's equirectangular UVs (u = lng, v = lat), so a Phase 2 map lines up. */
export function latLngToVector(lat: number, lng: number, radius: number): Vector3 {
  const phi = ((lng + 180) / 360) * Math.PI * 2;
  const theta = ((90 - lat) / 180) * Math.PI;
  return new Vector3(-Math.cos(phi) * Math.sin(theta) * radius, Math.cos(theta) * radius, Math.sin(phi) * Math.sin(theta) * radius);
}

function graticule() {
  const { canvas, ctx } = makeCanvas(512, 256);
  ctx.fillStyle = "#3D6E8F";
  ctx.fillRect(0, 0, 512, 256);
  ctx.fillStyle = "#4F82A3";
  for (let lng = 0; lng < 360; lng += 30) ctx.fillRect(Math.round((lng / 360) * 512), 0, 1, 256);
  for (let lat = 30; lat < 180; lat += 30) ctx.fillRect(0, Math.round((lat / 180) * 256), 512, 1);
  ctx.fillStyle = "#79A9C8";
  ctx.fillRect(0, 128, 512, 2); // equator
  return canvasTexture(canvas, false);
}

const PIN_GEOMETRY = new SphereGeometry(0.011, 12, 8);
const STEM_GEOMETRY = new SphereGeometry(0.0035, 6, 4);

export function Globe({ places }: { places: ScenePlace[] }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);
  const pins = useMemo(() => new Group(), []);
  const angle = useMemo(() => new Vector3(), []);

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
    // radius in pivot space (compressed GLBs carry a dequantization scale on the mesh node)
    const radius = size(sphere);
    const center = sphere.position.clone();

    // the baked GLB brings its own map; the blockout gets a graticule
    const material = sphere.material as MeshStandardMaterial;
    let map: Texture | null = null;
    if (!material.map) {
      map = graticule();
      material.map = map;
      material.color.set("#ffffff");
      material.needsUpdate = true;
    }

    const pinMaterial = new MeshStandardMaterial({ color: "#E2552B", roughness: 0.4, emissive: "#5A1A08" });
    const stemMaterial = new MeshStandardMaterial({ color: "#F4EEE3", roughness: 0.5 });
    pins.name = "runtime_globe_pins";
    for (const place of places) {
      const dir = latLngToVector(place.lat, place.lng, 1);
      const pin = new Mesh(PIN_GEOMETRY, pinMaterial);
      pin.position.copy(dir).multiplyScalar(radius + 0.022).add(center);
      pin.userData.sub = { key: `place:${place.slug}`, label: place.title, href: place.href };
      pin.castShadow = true;
      for (let k = 1; k <= 3; k++) {
        const stem = new Mesh(STEM_GEOMETRY, stemMaterial);
        stem.position.copy(dir).multiplyScalar(radius + 0.0055 * k).add(center);
        pins.add(stem);
        index.ownerOf.set(stem, "globe");
      }
      pins.add(pin);
      index.ownerOf.set(pin, "globe");
    }
    pivot.add(pins);
    invalidate();
    return () => {
      pivot.remove(pins);
      pins.clear();
      map?.dispose();
      pinMaterial.dispose();
      stemMaterial.dispose();
    };
  }, [index, places, pins, invalidate]);

  useFrame((state, rawDelta) => {
    const pivot = index?.pivots.get("globe");
    if (!pivot) return;
    const delta = Math.min(rawDelta, 0.1);
    const { focus, item, hovered, testMode } = useRoom.getState();
    if (testMode) return;
    if (focus === "globe") {
      // turn the selected (or first) place toward the camera
      const place = places.find((p) => p.slug === item) ?? places[0];
      if (place) {
        const p = latLngToVector(place.lat, place.lng, 1);
        // compare in the pivot's parent space (the globe's base may be rotated in the room)
        const cam = (pivot.parent ? pivot.parent.worldToLocal(state.camera.getWorldPosition(angle)) : state.camera.getWorldPosition(angle)).sub(pivot.position);
        const goal = Math.atan2(cam.x, cam.z) - Math.atan2(p.x, p.z);
        const diff = ((goal - pivot.rotation.y + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
        pivot.rotation.y += diff * (1 - Math.exp(-delta * 4));
        if (Math.abs(diff) > 0.002) state.invalidate();
      }
    } else {
      const active = hovered === "globe";
      pivot.rotation.y += delta * (active ? 0.7 : 0.12);
      if (active) state.invalidate();
    }
  });

  return null;
}
