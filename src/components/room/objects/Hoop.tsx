"use client";

import { useFrame } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { CanvasTexture, type Mesh, Mesh as ThreeMesh, MeshBasicMaterial, type Object3D, PlaneGeometry, Vector3 } from "three";
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
/** A soft round contact shadow (the ball moves, so its shadow can't be baked). */
function blobShadow() {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(0,0,0,0.85)");
  g.addColorStop(0.45, "rgba(0,0,0,0.42)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const material = new MeshBasicMaterial({ map: new CanvasTexture(canvas), transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new ThreeMesh(new PlaneGeometry(1, 1), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.renderOrder = 2;
  mesh.name = "runtime_ball_shadow";
  return mesh;
}

const ballMesh = (pivot: Object3D) => pivot.children.find((c) => (c as Mesh).isMesh && !c.name.startsWith("hit__"));

export function Hoop({ hoop }: { hoop: { swish: string; miss: string[] } }) {
  const index = useSceneIndex((s) => s.index);
  const shotRequest = useRoom((s) => s.shotRequest);
  const shot = useRef<Shot | null>(null);
  const rest = useRef<Vector3 | null>(null);
  const shadow = useRef<ThreeMesh | null>(null);
  const floorY = useRef(0);

  useEffect(() => {
    const ball = index?.pivots.get("hoop_ball");
    if (ball && !rest.current) rest.current = ball.position.clone();
  }, [index]);

  // contact shadow under the ball (in the ball's parent space; the floor is world y = 0)
  useEffect(() => {
    const ball = index?.pivots.get("hoop_ball");
    if (!index || !ball?.parent || index.lightmaps.size === 0) return;
    const blob = blobShadow();
    floorY.current = ball.parent.worldToLocal(new Vector3(0, 0, 0)).y + 0.013;
    ball.parent.add(blob);
    shadow.current = blob;
    placeShadow(ball, blob, floorY.current);
    return () => {
      ball.parent?.remove(blob);
      blob.geometry.dispose();
      (blob.material as MeshBasicMaterial).map?.dispose();
      (blob.material as MeshBasicMaterial).dispose();
      shadow.current = null;
    };
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
    const spinTarget = ballMesh(ball);
    if (spinTarget) spinTarget.rotation.x -= travel / 0.12;
    if (shadow.current) placeShadow(ball, shadow.current, floorY.current);

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

function placeShadow(ball: Object3D, blob: ThreeMesh, floorY: number) {
  const height = Math.max(0, ball.position.y - 0.12 - (floorY - 0.013));
  const k = Math.min(1, height / 1.6);
  blob.position.set(ball.position.x, floorY, ball.position.z);
  blob.scale.setScalar(0.3 * (1 + k * 0.9));
  (blob.material as MeshBasicMaterial).opacity = 0.75 * (1 - k * 0.85);
}
