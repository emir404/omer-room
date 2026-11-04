"use client";

import { useFrame } from "@react-three/fiber";
import { useMemo } from "react";
import { useRoom } from "@/lib/store";
import { useSceneIndex } from "../scene-index";

const DOWN = Math.PI / 2; // flag lies along the box, pointing at the wall
const UP = 0;
/** How far the door swings open (about the pivot's local Y), unless the art says (extras.open). */
const OPEN = 1.75;

/**
 * The mailbox: the flag pops up on hover, and when you come to it (/contact) the door swings open
 * too — the caption beside it is what's inside.
 */
export function Mailbox() {
  const index = useSceneIndex((s) => s.index);
  const state = useMemo(() => ({ open: 0 }), []);

  useFrame((frame, rawDelta) => {
    const flag = index?.pivots.get("contact_flag");
    const door = index?.pivots.get("contact_door");
    if (!flag && !door) return;
    const { hovered, focus, reducedMotion, testMode } = useRoom.getState();
    const delta = Math.min(rawDelta, 0.1);
    const instant = reducedMotion || testMode;
    let moving = false;
    if (flag) {
      const goal = hovered === "contact" || focus === "contact" ? UP : DOWN;
      const diff = goal - flag.rotation.z;
      if (Math.abs(diff) < 0.001 || instant) flag.rotation.z = goal;
      else {
        flag.rotation.z += diff * (1 - Math.exp(-delta * 10));
        moving = true;
      }
    }
    if (door) {
      const goal = focus === "contact" ? 1 : 0;
      const diff = goal - state.open;
      if (Math.abs(diff) < 0.001 || instant) state.open = goal;
      else {
        state.open += diff * (1 - Math.exp(-delta * (goal ? 4 : 7)));
        moving = true;
      }
      const angle = typeof door.userData.open === "number" ? door.userData.open : OPEN;
      door.rotation.y = angle * state.open;
    }
    if (moving) frame.invalidate();
  });

  return null;
}
