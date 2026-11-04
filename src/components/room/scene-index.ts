"use client";

import { Box3, type CubeTexture, type Material, type Mesh, type Object3D, Sphere, Vector3 } from "three";
import { create } from "zustand";
import {
  type AnchorId,
  type DisplayId,
  type FocusId,
  type NodeExtras,
  type ObjectId,
  type PivotId,
  parseNodeName,
  type ScreenId,
  type SectionId,
  SLOT_KINDS,
  type SlotKind,
} from "@/lib/scene-contract";
import type { LightmapBinding } from "./RoomMaterial";

/**
 * The room GLB, indexed by contract name. Built once after load; everything in the scene
 * (camera, pins, screens, slots) looks nodes up here instead of hard-coding geometry.
 */
export interface SceneIndex {
  root: Object3D;
  /** A small studio cube map for reflections (metals, the globe's varnish); set by Room. */
  envMap: CubeTexture | null;
  objects: Map<ObjectId, Object3D>;
  hits: Map<ObjectId, Mesh>;
  labels: Map<ObjectId, Object3D>;
  cams: Map<FocusId, { position: Vector3; target: Vector3 }>;
  screens: Map<ScreenId, Mesh>;
  displays: Map<DisplayId, Mesh>;
  slots: Record<SlotKind, Mesh[]>;
  pivots: Map<PivotId, Object3D>;
  anchors: Map<AnchorId, Object3D>;
  /** Things on the shelf you can pick up, by item id (book_03, medal_gold…): the item__ empty, or
   *  for a GLB from before items existed, the slot mesh itself (books, binders). */
  items: Map<string, Object3D>;
  /** Any mesh inside an item → that item's id. */
  itemOf: Map<Object3D, string>;
  /** The shelf's sections: where each opening is and how big (anchor__section_<id>, extras w × h). */
  sections: Map<SectionId, { anchor: Object3D; w: number; h: number }>;
  /** World bounds of each object's visible meshes (camera fit). */
  spheres: Map<ObjectId, Sphere>;
  roomSphere: Sphere;
  /** Any node → the object it belongs to (pointer resolution). */
  ownerOf: Map<Object3D, ObjectId>;
  /** Room materials per object (highlight) and all of them (day/night). */
  objectMaterials: Map<ObjectId, Material[]>;
  materials: Material[];
  /** Baked lighting per bake set (empty for the blockout). */
  lightmaps: Map<string, LightmapBinding>;
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
    envMap: null,
    slots: { book: [], cover: [], photo: [], binder: [], label: [], page: [] },
    pivots: new Map(),
    anchors: new Map(),
    items: new Map(),
    itemOf: new Map(),
    sections: new Map(),
    spheres: new Map(),
    roomSphere: new Sphere(),
    ownerOf: new Map(),
    objectMaterials: new Map(),
    materials: [],
    lightmaps: new Map(),
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
        if ((SLOT_KINDS as readonly string[]).includes(id)) index.slots[id as SlotKind].push(node as Mesh);
        break;
      case "pivot":
        index.pivots.set(id as PivotId, node);
        break;
      case "anchor":
        index.anchors.set(id as AnchorId, node);
        if (id.startsWith("section_")) {
          const extras = node.userData as NodeExtras;
          index.sections.set(id.slice(8) as SectionId, { anchor: node, w: extras.w ?? 0.8, h: extras.h ?? 0.4 });
        }
        break;
      case "item":
        if (rest.length === 0) index.items.set(id, node);
        break;
      default:
        break;
    }
  });
  for (const list of Object.values(index.slots)) list.sort((a, b) => a.name.localeCompare(b.name));

  // a GLB from before items existed: its book and binder slots are the things you pick up
  if (index.items.size === 0) {
    for (const mesh of index.slots.book) index.items.set(`book_${mesh.name.slice(-2)}`, mesh);
    for (const mesh of index.slots.binder) index.items.set(`binder_${mesh.name.slice(-2)}`, mesh);
  }
  for (const [id, item] of index.items) item.traverse((child) => index.itemOf.set(child, id));

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

  // the shell: every mesh under a decor__floor* / decor__wall* node (single- or multi-primitive)
  const roomBox = new Box3();
  root.traverse((child) => {
    if (!child.name.startsWith("decor__floor") && !child.name.startsWith("decor__wall")) return;
    child.traverse((part) => {
      const mesh = part as Mesh;
      if (mesh.isMesh) roomBox.union(meshBox(mesh));
    });
  });
  roomBox.getBoundingSphere(index.roomSphere);
  return index;
}

export const useSceneIndex = create<{ index: SceneIndex | null }>(() => ({ index: null }));
