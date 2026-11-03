"use client";

import { useFrame } from "@react-three/fiber";
import { useRoom } from "@/lib/store";
import { useSceneIndex } from "../scene-index";

const DOWN = Math.PI / 2; // flag lies along the box, pointing at the wall
const UP = 0;

/** The mailbox flag pops up on hover (and stays up while you're reading the contact panel). */
export function Mailbox() {
  const index = useSceneIndex((s) => s.index);

  useFrame((state, rawDelta) => {
    const flag = index?.pivots.get("contact_flag");
    if (!flag) return;
    const { hovered, focus } = useRoom.getState();
    const goal = hovered === "contact" || focus === "contact" ? UP : DOWN;
    const diff = goal - flag.rotation.z;
    if (Math.abs(diff) < 0.001) {
      flag.rotation.z = goal;
      return;
    }
    flag.rotation.z += diff * (1 - Math.exp(-Math.min(rawDelta, 0.1) * 10));
    state.invalidate();
  });

  return null;
}
