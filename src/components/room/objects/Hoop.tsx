"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { Vector3 } from "three";
import { playSfx, type Sfx } from "@/lib/sound";
import { showToast, useRoom } from "@/lib/store";
import { useSceneIndex } from "../scene-index";

interface Segment {
  to: Vector3;
  duration: number;
  /** Peak height of the arc above the straight line. */
  arc: number;
  ease?: boolean;
  onEnd?: { sfx?: Sfx; toast?: string };
}

interface Shot {
  from: Vector3;
  segments: Segment[];
  i: number;
  t: number;
  segmentStart: Vector3;
}

/**
 * The basketball. Click → a scripted shot at the wall hoop: sometimes a swish (easter egg line
 * from content/site.json), mostly not. Phase 3 swaps the script for a tiny custom physics solver.
 */
export function Hoop({ hoop }: { hoop: { swish: string; miss: string[] } }) {
  const index = useSceneIndex((s) => s.index);
  const shotRequest = useRoom((s) => s.shotRequest);
  const shot = useRef<Shot | null>(null);
  const rest = useRef<Vector3 | null>(null);

  useEffect(() => {
    const ball = index?.pivots.get("hoop_ball");
    if (ball && !rest.current) rest.current = ball.position.clone();
  }, [index]);

  useEffect(() => {
    if (!shotRequest || !index || shot.current) return;
    const ball = index.pivots.get("hoop_ball");
    const rim = index.anchors.get("hoop_rim");
    if (!ball || !rim || !rest.current) return;
    const start = rest.current.clone();
    const r = ball.parent!.worldToLocal(rim.getWorldPosition(new Vector3()));
    const floor = start.y;
    const swish = Math.random() < 0.38;
    const miss = hoop.miss[Math.floor(Math.random() * hoop.miss.length)] ?? "Miss.";
    const v = (x: number, y: number, z: number) => new Vector3(x, y, z);

    const segments: Segment[] = swish
      ? [
          { to: v(r.x, r.y + 0.06, r.z), duration: 0.85, arc: 0.75 },
          { to: v(r.x, r.y - 0.3, r.z), duration: 0.18, arc: 0, onEnd: { sfx: "swish", toast: hoop.swish } },
          { to: v(r.x, floor, r.z + 0.18), duration: 0.36, arc: 0, onEnd: { sfx: "bounce" } },
          { to: v(r.x + 0.1, floor, r.z + 0.5), duration: 0.42, arc: 0.3, onEnd: { sfx: "bounce" } },
          { to: v(r.x + 0.18, floor, r.z + 0.75), duration: 0.28, arc: 0.1, onEnd: { sfx: "bounce" } },
          { to: start, duration: 1.3, arc: 0, ease: true },
        ]
      : [
          { to: v(r.x + 0.03, r.y + 0.02, r.z + 0.13), duration: 0.85, arc: 0.75, onEnd: { sfx: "rim", toast: miss } },
          { to: v(r.x + 0.32, r.y - 0.9, r.z + 0.7), duration: 0.42, arc: 0.25 },
          { to: v(r.x + 0.48, floor, r.z + 1.0), duration: 0.3, arc: 0, onEnd: { sfx: "bounce" } },
          { to: v(r.x + 0.62, floor, r.z + 1.25), duration: 0.34, arc: 0.18, onEnd: { sfx: "bounce" } },
          { to: start, duration: 1.3, arc: 0, ease: true },
        ];
    shot.current = { from: start, segments, i: 0, t: 0, segmentStart: start.clone() };
  }, [shotRequest, index, hoop]);

  useFrame((state, rawDelta) => {
    const s = shot.current;
    const ball = index?.pivots.get("hoop_ball");
    if (!s || !ball) return;
    const delta = Math.min(rawDelta, 1 / 30);
    const seg = s.segments[s.i]!;
    s.t += delta;
    let k = Math.min(1, s.t / seg.duration);
    if (seg.ease) k = k * k * (3 - 2 * k);
    const prev = ball.position.clone();
    ball.position.lerpVectors(s.segmentStart, seg.to, k);
    ball.position.y += seg.arc * 4 * k * (1 - k);
    // spin with travel
    const travel = ball.position.distanceTo(prev);
    const spinTarget = ball.children[0];
    if (spinTarget) spinTarget.rotation.x -= travel / 0.12;

    if (k >= 1) {
      if (seg.onEnd?.sfx) playSfx(seg.onEnd.sfx);
      if (seg.onEnd?.toast) showToast(seg.onEnd.toast);
      s.i++;
      s.t = 0;
      s.segmentStart = seg.to.clone();
      if (s.i >= s.segments.length) shot.current = null;
    }
    state.invalidate();
  });

  return null;
}
