"use client";

import type { Mesh } from "three";
import type { ObjectId, ScreenId } from "@/lib/scene-contract";

/**
 * DOM elements the scene writes to every frame (positions only — no React re-renders):
 * pins/labels, the hover selection, and the live screen UIs mapped onto the monitor and phone.
 */
export const pinElements = new Map<ObjectId, HTMLElement>();
export const overlay: {
  selection: HTMLElement | null;
  /** Mesh of a hovered sub-target (a book spine, a binder, a globe pin). */
  subMesh: Mesh | null;
} = { selection: null, subMesh: null };

/**
 * A live screen UI (ScreenLayer) laid out at `width` × `height` CSS px. The scene maps it onto its
 * screen mesh every frame (ScreenProjector): a perspective transform while the room is in view,
 * and a flat, pixel-aligned box (crisp text, real clicks) once the camera rests on it (`docked`).
 */
export interface ScreenSlot {
  el: HTMLElement;
  inner: HTMLElement;
  width: number;
  height: number;
  docked: boolean;
}
export const screenSlots = new Map<ScreenId, ScreenSlot>();

/** Set by the scene: asks for a frame (the canvas renders on demand). */
export const scene: { invalidate: () => void } = { invalidate: () => {} };

/** Button for each object, so closing a panel can return keyboard focus to it. */
export function focusObjectButton(id: ObjectId) {
  pinElements.get(id)?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
}
