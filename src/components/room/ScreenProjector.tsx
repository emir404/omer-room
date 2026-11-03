"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { type BufferAttribute, type Camera, Matrix3, type Mesh, Vector3 } from "three";
import { SCREEN_IDS } from "@/lib/scene-contract";
import { scene, screenSlots } from "./registry";
import { useSceneIndex } from "./scene-index";

/**
 * Maps the live screen UIs (DOM, see ScreenLayer) onto the monitor and the phone, every frame.
 *
 * The canvas sits above the DOM and draws each screen mesh as a hole (alpha 0, depth-tested), so
 * the UI shows through exactly where the screen is visible and anything in front of it still covers
 * it. While the room is in view the UI gets a CSS perspective transform (a homography from its
 * W×H box to the screen's four projected corners); once the camera rests on a screen it is docked:
 * a pixel-aligned box with CSS zoom, so text is crisp and clicks land.
 */

/** Screen corners in local space, from the UVs: P = O + u·A + v·B fitted over every vertex. glTF UVs
 *  have v pointing down, so (0,0) is the picture's top-left. Returns TL, TR, BR, BL. */
function uvCorners(mesh: Mesh): Vector3[] {
  const pos = mesh.geometry.getAttribute("position") as BufferAttribute;
  const uv = mesh.geometry.getAttribute("uv") as BufferAttribute;
  let n = 0, su = 0, sv = 0, suu = 0, suv = 0, svv = 0;
  const sp = new Vector3(), sup = new Vector3(), svp = new Vector3(), p = new Vector3();
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    p.fromBufferAttribute(pos, i);
    n++;
    su += u;
    sv += v;
    suu += u * u;
    suv += u * v;
    svv += v * v;
    sp.add(p);
    sup.addScaledVector(p, u);
    svp.addScaledVector(p, v);
  }
  const inv = new Matrix3().set(n, su, sv, su, suu, suv, sv, suv, svv).invert().elements; // column-major
  const solve = (k: "x" | "y" | "z") => {
    const r = [sp[k], sup[k], svp[k]] as const;
    return [0, 1, 2].map((row) => inv[row]! * r[0] + inv[row + 3]! * r[1] + inv[row + 6]! * r[2]) as [number, number, number];
  };
  const [ox, ax, bx] = solve("x");
  const [oy, ay, by] = solve("y");
  const [oz, az, bz] = solve("z");
  const O = new Vector3(ox, oy, oz);
  const A = new Vector3(ax, ay, az);
  const B = new Vector3(bx, by, bz);
  return [O.clone(), O.clone().add(A), O.clone().add(A).add(B), O.clone().add(B)];
}

/** Unit square → quad (Heckbert): X = (a·u + b·v + c) / (g·u + h·v + 1), same for Y with d, e, f. */
function homography(q: { x: number; y: number }[]) {
  const [p0, p1, p2, p3] = q as [{ x: number; y: number }, { x: number; y: number }, { x: number; y: number }, { x: number; y: number }];
  const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
  const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
  let g = 0, h = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(den) < 1e-12) return null;
    g = (dx3 * dy2 - dx2 * dy3) / den;
    h = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return {
    a: p1.x - p0.x + g * p1.x,
    b: p3.x - p0.x + h * p3.x,
    c: p0.x,
    d: p1.y - p0.y + g * p1.y,
    e: p3.y - p0.y + h * p3.y,
    f: p0.y,
    g,
    h,
  };
}

const f = (n: number) => (Math.abs(n) < 1e-12 ? "0" : n.toPrecision(9));

export function ScreenProjector() {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);
  const corners = useMemo(() => new Map<string, Vector3[]>(), []);
  const tmp = useMemo(() => ({ v: new Vector3(), view: new Vector3(), last: new Map<string, string>() }), []);

  useEffect(() => {
    scene.invalidate = () => invalidate();
    return () => {
      scene.invalidate = () => {};
    };
  }, [invalidate]);

  useEffect(() => {
    corners.clear();
    tmp.last.clear();
    if (!index) return;
    for (const id of SCREEN_IDS) {
      const mesh = index.screens.get(id);
      if (mesh) corners.set(id, uvCorners(mesh));
    }
    invalidate();
  }, [index, corners, tmp, invalidate]);

  const project = (local: Vector3, mesh: Mesh, camera: Camera, width: number, height: number) => {
    const world = tmp.v.copy(local).applyMatrix4(mesh.matrixWorld);
    const view = tmp.view.copy(world).applyMatrix4(camera.matrixWorldInverse);
    if (view.z > -0.01) return null; // behind (or at) the camera
    world.project(camera);
    return { x: (world.x * 0.5 + 0.5) * width, y: (-world.y * 0.5 + 0.5) * height };
  };

  useFrame(({ camera, size }) => {
    if (!index) return;
    for (const id of SCREEN_IDS) {
      const slot = screenSlots.get(id);
      const mesh = index.screens.get(id);
      const local = corners.get(id);
      if (!slot || !mesh || !local) continue;
      const quad = local.map((c) => project(c, mesh, camera, size.width, size.height));
      let css: string;
      if (quad.some((q) => q === null)) {
        css = "hidden";
      } else if (slot.docked) {
        const xs = quad.map((q) => q!.x);
        const ys = quad.map((q) => q!.y);
        const x = Math.round(Math.min(...xs));
        const y = Math.round(Math.min(...ys));
        const w = Math.round(Math.max(...xs)) - x;
        const zoom = w / slot.width;
        css = `docked|${x}|${y}|${w}|${Math.round(slot.height * zoom)}|${zoom.toFixed(4)}`;
      } else {
        const H = homography(quad as { x: number; y: number }[]);
        if (!H) {
          css = "hidden";
        } else {
          const { width: W, height: Hh } = slot;
          css = `3d|matrix3d(${f(H.a / W)}, ${f(H.d / W)}, 0, ${f(H.g / W)}, ${f(H.b / Hh)}, ${f(H.e / Hh)}, 0, ${f(H.h / Hh)}, 0, 0, 1, 0, ${f(H.c)}, ${f(H.f)}, 0, 1)`;
        }
      }
      const key = `${css}|${slot.width}|${slot.height}`;
      if (tmp.last.get(id) === key) continue;
      tmp.last.set(id, key);
      const { el, inner } = slot;
      if (css === "hidden") {
        el.style.visibility = "hidden";
        continue;
      }
      el.style.visibility = "visible";
      if (css.startsWith("docked|")) {
        const [, x, y, w, h, zoom] = css.split("|");
        el.style.transform = `translate(${x}px, ${y}px)`;
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
        inner.style.zoom = zoom!;
      } else {
        el.style.transform = css.slice(3);
        el.style.width = `${slot.width}px`;
        el.style.height = `${slot.height}px`;
        inner.style.zoom = "1";
      }
    }
  });

  return null;
}
