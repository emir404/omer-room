"use client";

import type { Mesh } from "three";
import type { ObjectId } from "@/lib/scene-contract";

/**
 * DOM elements the scene writes to every frame (positions only — no React re-renders):
 * pins/labels, the selection box, and the host the OS/phone UI is portaled into.
 */
export const pinElements = new Map<ObjectId, HTMLElement>();
export const overlay: {
  selection: HTMLElement | null;
  screenHost: HTMLElement | null;
  /** Mesh of a hovered sub-target (a book spine, a globe pin). */
  subMesh: Mesh | null;
} = { selection: null, screenHost: null, subMesh: null };

/** Button for each object, so closing a panel can return keyboard focus to it. */
export function focusObjectButton(id: ObjectId) {
  pinElements.get(id)?.querySelector<HTMLButtonElement>("button")?.focus({ preventScroll: true });
}
