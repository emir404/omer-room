"use client";

import { Box3, type Mesh, type MeshStandardMaterial, type Object3D, Sphere, Vector3 } from "three";
import { create } from "zustand";
import {
  type AnchorId,
  type DisplayId,
  type FocusId,
  type ObjectId,
  type PivotId,
  parseNodeName,
  type ScreenId,
} from "@/lib/scene-contract";

/**
 * The room GLB, indexed by contract name. Built once after load; everything in the scene
 * (camera, pins, screens, slots) looks nodes up here instead of hard-coding geometry.
 */
export interface SceneIndex {
  root: Object3D;
  objects: Map<ObjectId, Object3D>;
  hits: Map<ObjectId, Mesh>;
  labels: Map<ObjectId, Object3D>;
  cams: Map<FocusId, { position: Vector3; target: Vector3 }>;
  screens: Map<ScreenId, Mesh>;
  displays: Map<DisplayId, Mesh>;
  slots: { book: Mesh[]; photo: Mesh[] };
  pivots: Map<PivotId, Object3D>;
  anchors: Map<AnchorId, Object3D>;
  /** World bounds of each object's visible meshes (camera fit). */
  spheres: Map<ObjectId, Sphere>;
  roomSphere: Sphere;
  /** Any node → the object it belongs to (pointer resolution). */
  ownerOf: Map<Object3D, ObjectId>;
  /** Room materials per object (highlight) and all of them (day/night). */
  objectMaterials: Map<ObjectId, MeshStandardMaterial[]>;
  materials: MeshStandardMaterial[];
}

export function buildSceneIndex(root: Object3D): SceneIndex {
  root.updateMatrixWorld(true);
  const index: SceneIndex = {
    root,
    objects: new Map(),
    hits: new Map(),
    labels: new Map(),
    cams: new Map(),
    screens: new Map(),
    displays: new Map(),
    slots: { book: [], photo: [] },
    pivots: new Map(),
    anchors: new Map(),
    spheres: new Map(),
    roomSphere: new Sphere(),
    ownerOf: new Map(),
    objectMaterials: new Map(),
    materials: [],
  };

  root.traverse((node) => {
    const parsed = parseNodeName(node.name);
    if (!parsed) return;
    const { kind, id, rest } = parsed;
    switch (kind) {
      case "obj":
        index.objects.set(id as ObjectId, node);
        break;
      case "hit":
        index.hits.set(id as ObjectId, node as Mesh);
        break;
      case "label":
        index.labels.set(id as ObjectId, node);
        break;
      case "cam": {
        const entry = index.cams.get(id as FocusId) ?? { position: new Vector3(), target: new Vector3() };
        node.getWorldPosition(rest[0] === "target" ? entry.target : entry.position);
        index.cams.set(id as FocusId, entry);
        break;
      }
      case "screen":
        index.screens.set(id as ScreenId, node as Mesh);
        break;
      case "display":
        index.displays.set(id as DisplayId, node as Mesh);
        break;
      case "slot":
        if (id === "book") index.slots.book.push(node as Mesh);
        if (id === "photo") index.slots.photo.push(node as Mesh);
        break;
      case "pivot":
        index.pivots.set(id as PivotId, node);
        break;
      case "anchor":
        index.anchors.set(id as AnchorId, node);
        break;
      default:
        break;
    }
  });
  index.slots.book.sort((a, b) => a.name.localeCompare(b.name));
  index.slots.photo.sort((a, b) => a.name.localeCompare(b.name));

  const meshBox = (mesh: Mesh) => {
    mesh.geometry.computeBoundingBox();
    return mesh.geometry.boundingBox!.clone().applyMatrix4(mesh.matrixWorld);
  };

  for (const [id, obj] of index.objects) {
    const box = new Box3();
    obj.traverse((child) => {
      index.ownerOf.set(child, id);
      const mesh = child as Mesh;
      if (mesh.isMesh && !child.name.startsWith("hit__")) box.union(meshBox(mesh));
    });
    index.spheres.set(id, box.getBoundingSphere(new Sphere()));
  }

  const roomBox = new Box3();
  root.traverse((child) => {
    const mesh = child as Mesh;
    if (mesh.isMesh && (child.name.startsWith("decor__floor") || child.name.startsWith("decor__wall"))) roomBox.union(meshBox(mesh));
  });
  roomBox.getBoundingSphere(index.roomSphere);
  return index;
}

export const useSceneIndex = create<{ index: SceneIndex | null }>(() => ({ index: null }));
