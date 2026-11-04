"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import {
  Box3,
  type BufferGeometry,
  type Camera,
  DataTexture,
  type Material,
  MathUtils,
  Matrix4,
  Mesh,
  type MeshBasicMaterial,
  MeshStandardMaterial,
  type Object3D,
  type PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
} from "three";
import { captionInset, isDesktopWidth, LAYOUT } from "@/lib/layout";
import { useRoom } from "@/lib/store";
import { useSceneIndex } from "./scene-index";
import { useShelfMap } from "./shelf-map";

/**
 * Picking things up. On /shelf/<item> the thing (a medal, a book, a binder…) slides off the shelf
 * and comes to you: it floats in the space left of the caption, turned a little so it reads as an
 * object, lit by a small studio (its baked shelf light would look wrong once it moves). Drag to turn
 * it; click outside it to put it back. Leaving the URL flies it home.
 *
 * Which thing: the one you clicked (`picked`), else the item's hero (shelf-map.ts).
 */

const FLY = 0.85; // seconds, there or back
const BASE_YAW = -0.42; // a three-quarter view: the face and one side
const BASE_PITCH = 0.12;

interface Held {
  id: string;
  node: Object3D;
  rest: { position: Vector3; quaternion: Quaternion; scale: Vector3 };
  /** The item's middle in its own space, and how big it is (world). */
  center: Vector3;
  radius: number;
  t: number;
  yaw: number;
  pitch: number;
  vyaw: number;
  vpitch: number;
  meshes: { mesh: Mesh; room: Material | Material[]; studio: MeshStandardMaterial }[];
  lifted: boolean;
}

const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (a: number, b: number, t: number) => {
  const k = MathUtils.clamp((t - a) / (b - a), 0, 1);
  return k * k * (3 - 2 * k);
};

function measure(node: Object3D): { center: Vector3; radius: number } {
  node.updateMatrixWorld(true);
  const inv = new Matrix4().copy(node.matrixWorld).invert();
  const box = new Box3();
  const tmp = new Box3();
  node.traverse((child) => {
    const mesh = child as Mesh;
    if (!mesh.isMesh || !mesh.visible) return;
    mesh.geometry.computeBoundingBox();
    tmp.copy(mesh.geometry.boundingBox!).applyMatrix4(new Matrix4().multiplyMatrices(inv, mesh.matrixWorld));
    box.union(tmp);
  });
  const center = box.getCenter(new Vector3());
  const scale = node.getWorldScale(new Vector3());
  const radius = (box.getSize(new Vector3()).multiply(scale).length() / 2) || 0.1;
  return { center, radius };
}

/** A realtime-lit twin of a room material: same color and picture, lit by the studio cube.
 *  `source` is the GLB's own material (Room.tsx keeps it), for roughness and metalness. */
function studioMaterial(room: Material, source: MeshStandardMaterial | undefined, env: MeshStandardMaterial["envMap"]): MeshStandardMaterial {
  const basic = room as MeshBasicMaterial;
  const metalness = source?.metalness ?? 0;
  return new MeshStandardMaterial({
    color: basic.color?.clone(),
    map: basic.map ?? null,
    roughness: source?.roughness ?? 0.6,
    metalness,
    envMap: env,
    envMapIntensity: metalness > 0.5 ? 1.15 : 0.85,
  });
}

export function Inspector() {
  const index = useSceneIndex((s) => s.index);
  const map = useShelfMap((s) => s.map);
  const chapter = useRoom((s) => s.chapter);
  const item = useRoom((s) => s.item);
  const picked = useRoom((s) => s.picked);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const held = useMemo(() => new Map<string, Held>(), []);
  const drag = useMemo(() => ({ active: false, x: 0, y: 0, moved: 0, last: 0, id: -1 }), []);
  const tmp = useMemo(
    () => ({
      a: new Vector3(),
      b: new Vector3(),
      c: new Vector3(),
      d: new Vector3(),
      out: new Vector3(1, 0, 0),
      q: new Quaternion(),
      q2: new Quaternion(),
      m: new Matrix4(),
      up: new Vector3(),
      right: new Vector3(),
    }),
    [],
  );

  // what the URL puts in your hand
  const target = useMemo(() => {
    if (chapter !== "shelf" || !item) return null;
    const ids = map.bySlug.get(item);
    if (!ids?.length) return null;
    return picked && ids.includes(picked) ? picked : ids[0]!;
  }, [chapter, item, picked, map]);

  useEffect(() => {
    useRoom.setState({ holding: target });
    invalidate();
  }, [target, invalidate]);

  // the direction things come off the shelf: from the case toward the room
  useEffect(() => {
    const cam = index?.cams.get("shelf");
    if (cam) tmp.out.copy(cam.position).sub(cam.target).setY(0).normalize();
  }, [index, tmp]);

  const begin = (id: string): Held | null => {
    const node = index?.items.get(id);
    if (!node || !index) return null;
    const { center, radius } = measure(node);
    const meshes: Held["meshes"] = [];
    node.traverse((child) => {
      const mesh = child as Mesh;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.getAttribute("normal")) {
        // baked meshes ship without normals (they're unlit); the studio light needs them
        const geometry = mesh.userData.ownGeometry ? mesh.geometry : (mesh.geometry.clone() as BufferGeometry);
        geometry.computeVertexNormals();
        mesh.geometry = geometry;
        mesh.userData.ownGeometry = true;
      }
      const room = mesh.material;
      const first = Array.isArray(room) ? room[0]! : room;
      meshes.push({ mesh, room, studio: studioMaterial(first, mesh.userData.sourceMaterial as MeshStandardMaterial | undefined, index.envMap) });
    });
    const state: Held = {
      id,
      node,
      rest: { position: node.position.clone(), quaternion: node.quaternion.clone(), scale: node.scale.clone() },
      center,
      radius,
      t: 0,
      yaw: 0,
      pitch: 0,
      vyaw: 0,
      vpitch: 0,
      meshes,
      lifted: false,
    };
    held.set(id, state);
    return state;
  };

  const lift = (h: Held, on: boolean) => {
    if (h.lifted === on) return;
    h.lifted = on;
    for (const entry of h.meshes) {
      if (on) {
        // pick up the current picture (a cover may have loaded since)
        const room = Array.isArray(entry.room) ? entry.room[0]! : entry.room;
        entry.studio.map = (room as MeshBasicMaterial).map ?? null;
        entry.studio.color.copy((room as MeshBasicMaterial).color);
        entry.studio.needsUpdate = true;
        entry.mesh.material = entry.studio;
      } else {
        entry.mesh.material = entry.room;
      }
    }
  };

  const finish = (h: Held) => {
    h.node.position.copy(h.rest.position);
    h.node.quaternion.copy(h.rest.quaternion);
    h.node.scale.copy(h.rest.scale);
    lift(h, false);
    for (const entry of h.meshes) entry.studio.dispose();
    held.delete(h.id);
  };

  // where the thing floats: the middle of the space the caption leaves, at arm's length
  const showcase = (h: Held, cam: Camera, width: number, height: number, out: { position: Vector3; quaternion: Quaternion }) => {
    const desktop = isDesktopWidth(width);
    const freeW = desktop ? width - captionInset(width) : width;
    const freeTop = LAYOUT.topInset;
    const freeBottom = desktop ? height : height * (1 - LAYOUT.captionPhoneRatio);
    const sx = freeW / 2;
    const sy = (freeTop + freeBottom) / 2;
    const diameter = desktop ? Math.min(freeW * 0.6, (freeBottom - freeTop) * 0.62) : Math.min(width * 0.74, (freeBottom - freeTop) * 0.78);
    const p = cam as PerspectiveCamera;
    const tanHalf = (diameter / height) * Math.tan(MathUtils.degToRad(p.fov) / 2);
    const distance = Math.max(p.near * 4, h.radius / tanHalf);
    const dir = tmp.a.set((sx / width) * 2 - 1, 1 - (sy / height) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    const pos = out.position.copy(cam.position).addScaledVector(dir, distance);
    // face → toward the camera, up → the camera's up
    const face = tmp.b.copy(dir).negate();
    tmp.up.setFromMatrixColumn(cam.matrixWorld, 1);
    const right = tmp.right.crossVectors(tmp.up, face).normalize();
    const up = tmp.c.crossVectors(face, right).normalize();
    tmp.m.makeBasis(face, up, tmp.d.crossVectors(face, up));
    out.quaternion.setFromRotationMatrix(tmp.m);
    // a three-quarter turn plus whatever you've dragged it to
    tmp.q.setFromAxisAngle(up, BASE_YAW + h.yaw);
    tmp.q2.setFromAxisAngle(right, -(BASE_PITCH + h.pitch));
    out.quaternion.premultiply(tmp.q2).premultiply(tmp.q);
    // the pivot is the empty's origin; put the item's middle on the spot
    pos.sub(tmp.d.copy(h.center).multiply(h.node.getWorldScale(tmp.c)).applyQuaternion(out.quaternion));
    return out;
  };

  // drag to turn; a click that isn't on it puts it back
  useEffect(() => {
    const canvas = gl.domElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const onDown = (e: PointerEvent) => {
      const id = useRoom.getState().holding;
      if (!id || e.button > 0) return;
      drag.active = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved = 0;
      drag.last = performance.now();
      drag.id = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      if (!drag.active || e.pointerId !== drag.id) return;
      const h = held.get(useRoom.getState().holding ?? "");
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      drag.x = e.clientX;
      drag.y = e.clientY;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      if (!h || drag.moved < 4) return;
      const now = performance.now();
      const dt = Math.max(1, now - drag.last) / 1000;
      drag.last = now;
      h.yaw += dx * 0.011;
      h.pitch = MathUtils.clamp(h.pitch + dy * 0.009, -1.2, 1.2);
      h.vyaw = (dx * 0.011) / dt;
      h.vpitch = (dy * 0.009) / dt;
      canvas.style.cursor = "grabbing";
      invalidate();
    };
    const onUp = (e: PointerEvent) => {
      if (!drag.active || e.pointerId !== drag.id) return;
      drag.active = false;
      if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
      canvas.style.cursor = "";
      const id = useRoom.getState().holding;
      const h = id ? held.get(id) : undefined;
      if (!h || drag.moved >= 6) return;
      // a click: on the thing, nothing; anywhere else, put it back (to its section)
      const rect = canvas.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.intersectObject(h.node, true).length) return;
      const back = document.querySelector<HTMLAnchorElement>(".cap-live [data-back]")?.getAttribute("href") ?? "/shelf";
      useRoom.getState().navigate(back);
    };
    canvas.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [gl, camera, held, drag, invalidate]);

  // the studio material's two variants (with a picture, without), compiled with the room up front
  // so the first thing you pick up doesn't stall on a shader compile
  useEffect(() => {
    if (!index) return;
    const geometry = new PlaneGeometry(0.001, 0.001);
    const picture = new DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
    picture.needsUpdate = true;
    const meshes = [picture, null].map((map) => {
      const mesh = new Mesh(geometry, new MeshStandardMaterial({ map, envMap: index.envMap, transparent: true }));
      mesh.frustumCulled = false;
      mesh.position.set(0, -50, 0);
      return mesh;
    });
    scene.add(...meshes);
    const done = () => {
      scene.remove(...meshes);
      for (const mesh of meshes) (mesh.material as MeshStandardMaterial).dispose();
      geometry.dispose();
      picture.dispose();
    };
    if (useRoom.getState().sceneReady) {
      // the room was already up (a new GLB in dev): nothing to warm
      done();
      return;
    }
    const unsubscribe = useRoom.subscribe((s) => {
      if (!s.sceneReady) return;
      unsubscribe();
      done();
    });
    return () => {
      unsubscribe();
      done();
    };
  }, [index, scene]);

  // a new GLB: whatever was in your hand goes back first
  useEffect(() => {
    return () => {
      for (const h of [...held.values()]) finish(h);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- finish only touches `held`
  }, [index, held]);

  const pose = useMemo(() => ({ position: new Vector3(), quaternion: new Quaternion() }), []);
  const restWorld = useMemo(() => ({ position: new Vector3(), quaternion: new Quaternion(), parentInv: new Matrix4(), parentQ: new Quaternion() }), []);

  useFrame(({ camera: cam, size }, rawDelta) => {
    if (!index) return;
    const delta = Math.min(rawDelta, 0.05);
    const { holding, reducedMotion, testMode } = useRoom.getState();
    if (holding && !held.has(holding)) begin(holding);
    let moving = false;
    for (const h of [...held.values()]) {
      const goal = h.id === holding ? 1 : 0;
      if (reducedMotion || testMode) h.t = goal;
      else h.t = MathUtils.clamp(h.t + Math.sign(goal - h.t) * (delta / FLY), 0, 1);
      if (h.t === 0 && goal === 0) {
        finish(h);
        moving = true;
        continue;
      }
      lift(h, true);
      // coast after a drag
      if (!drag.active && (Math.abs(h.vyaw) > 0.01 || Math.abs(h.vpitch) > 0.01)) {
        h.yaw += h.vyaw * delta;
        h.pitch = MathUtils.clamp(h.pitch + h.vpitch * delta, -1.2, 1.2);
        h.vyaw *= Math.exp(-delta * 4.5);
        h.vpitch *= Math.exp(-delta * 4.5);
        moving = true;
      }
      const parent = h.node.parent!;
      parent.updateWorldMatrix(true, false);
      restWorld.parentInv.copy(parent.matrixWorld).invert();
      parent.getWorldQuaternion(restWorld.parentQ);
      restWorld.position.copy(h.rest.position).applyMatrix4(parent.matrixWorld);
      restWorld.quaternion.copy(restWorld.parentQ).multiply(h.rest.quaternion);
      showcase(h, cam, size.width, size.height, pose);

      // off the shelf first (straight out toward the room), then across to you
      const e = easeInOut(h.t);
      const pull = Math.max(0.1, h.radius * 1.4);
      const p0 = restWorld.position;
      const p1 = tmp.a.copy(p0).addScaledVector(tmp.out, pull);
      const p3 = pose.position;
      const p2 = tmp.b.copy(p1).lerp(p3, 0.55);
      const u = 1 - e;
      const world = tmp.c
        .copy(p0)
        .multiplyScalar(u * u * u)
        .addScaledVector(p1, 3 * u * u * e)
        .addScaledVector(p2, 3 * u * e * e)
        .addScaledVector(p3, e * e * e);
      const q = tmp.q.copy(restWorld.quaternion).slerp(pose.quaternion, smooth(0.12, 1, e));
      h.node.position.copy(world.applyMatrix4(restWorld.parentInv));
      h.node.quaternion.copy(restWorld.parentQ).invert().multiply(q);
      if (h.t !== goal) moving = true;
    }
    if (moving) invalidate();
  });

  return null;
}
