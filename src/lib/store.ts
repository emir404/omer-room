"use client";

import { create } from "zustand";
import type { ChapterId, RouteState } from "./routes";
import type { FocusId, ObjectId } from "./scene-contract";
import type { TimeOverride } from "./time-of-day";

/**
 * Shared state between the DOM layer (panels, pins, screens) and the R3F scene.
 * zustand works across both React roots, so either side can read/write.
 */

/** "pending" until the client decides; "room" = 3D; "doc" = text fallback (no WebGL / context lost). */
export type RoomMode = "pending" | "room" | "doc";

export interface RoomState extends RouteState {
  mode: RoomMode;
  loadProgress: number;
  sceneReady: boolean;
  /** Object under the pointer or keyboard focus (drives highlight + label). */
  hovered: ObjectId | null;
  hoverSource: "pointer" | "keyboard" | null;
  /** A hovered thing inside the focused object (a book spine, a globe pin). */
  hoveredSub: { key: string; label: string } | null;
  /** Incremented to throw the basketball. */
  shotRequest: number;
  cameraAtRest: boolean;
  /** The app the desktop shows when you're not at the computer (the last one opened). */
  lastComputerApp: string | null;
  timeOverride: TimeOverride;
  nightness: number;
  sound: boolean;
  touch: boolean;
  reducedMotion: boolean;
  testMode: boolean;
  toast: { id: number; text: string } | null;
  /** Router bridge: set by RouteSync so the scene can navigate without Next's context. */
  navigate: (href: string) => void;
}

export const useRoom = create<RoomState>(() => ({
  mode: "pending",
  loadProgress: 0,
  sceneReady: false,
  focus: "room" as FocusId,
  chapter: null as ChapterId | null,
  item: null,
  hovered: null,
  hoverSource: null,
  hoveredSub: null,
  shotRequest: 0,
  cameraAtRest: false,
  lastComputerApp: null,
  timeOverride: "auto",
  nightness: 0,
  sound: false,
  touch: false,
  reducedMotion: false,
  testMode: false,
  toast: null,
  navigate: () => {},
}));

let toastId = 0;
export function showToast(text: string) {
  useRoom.setState({ toast: { id: ++toastId, text } });
}

export function setHovered(id: ObjectId | null, source: RoomState["hoverSource"]) {
  const state = useRoom.getState();
  // Keyboard focus wins until it moves; pointer-out shouldn't clear a keyboard highlight.
  if (id === null && source !== state.hoverSource) return;
  useRoom.setState({ hovered: id, hoverSource: id === null ? null : source });
}
