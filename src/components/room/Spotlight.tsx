"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { BufferGeometry, Color, Float32BufferAttribute, type Material, MathUtils, Mesh, type Object3D, ShaderMaterial } from "three";
import { CHAPTERS, isChapterId } from "@/lib/routes";
import { useRoom } from "@/lib/store";
import { useSceneIndex } from "./scene-index";

/**
 * Lights down, one thing lit. When a chapter opens (anything with a caption: the shelf, the globe,
 * the window, the letter, the mailbox), the room dims and the object stays bright, so the caption
 * beside it has the dark to sit on. When something is in your hand, only it stays lit.
 *
 * How: a full-screen dark quad drawn after the room (transparent pass, renderOrder 900, no depth),
 * then the lit object drawn again on top (renderOrder 1000, depth-tested against the room, so things
 * in front of it still cover it). The live screens are DOM holes in the canvas; the quad dims them too.
 */

const DIM = { day: 0.66, night: 0.58 };
const COLOR = { day: new Color("#140f0a"), night: new Color("#05070e") };

function makeQuad() {
  const geometry = new BufferGeometry();
  // one triangle over the whole screen, in clip space
  geometry.setAttribute("position", new Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const material = new ShaderMaterial({
    uniforms: { uColor: { value: new Color() }, uAlpha: { value: 0 } },
    vertexShader: "void main() { gl_Position = vec4(position.xy, 0.0, 1.0); }",
    fragmentShader: "uniform vec3 uColor; uniform float uAlpha; void main() { gl_FragColor = vec4(uColor, uAlpha); }",
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const quad = new Mesh(geometry, material);
  quad.frustumCulled = false;
  quad.renderOrder = 900;
  quad.name = "runtime_spotlight";
  quad.raycast = () => {};
  return quad;
}

interface Lit {
  mesh: Mesh;
  renderOrder: number;
  transparent: boolean;
  material: Material;
}

export function Spotlight() {
  const index = useSceneIndex((s) => s.index);
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  const quad = useMemo(() => makeQuad(), []);
  const lit = useMemo(() => new Map<Mesh, Lit>(), []);
  const state = useMemo(() => ({ alpha: 0, root: null as Object3D | null, keep: new Set<Mesh>() }), []);

  useEffect(() => {
    scene.add(quad);
    return () => {
      scene.remove(quad);
      quad.geometry.dispose();
      (quad.material as ShaderMaterial).dispose();
    };
  }, [scene, quad]);

  const restore = (entry: Lit) => {
    entry.mesh.renderOrder = entry.renderOrder;
    entry.material.transparent = entry.transparent;
  };

  useFrame((_, rawDelta) => {
    if (!index) return;
    const { focus, holding, nightness, reducedMotion, testMode } = useRoom.getState();
    const chapter = focus !== "room" && isChapterId(focus) ? CHAPTERS[focus] : null;
    const on = chapter?.kind === "caption";
    const night = nightness > 0.5;
    const goal = on ? MathUtils.lerp(DIM.day, DIM.night, nightness) : 0;
    const material = quad.material as ShaderMaterial;
    material.uniforms.uColor!.value.copy(night ? COLOR.night : COLOR.day);
    const delta = Math.min(rawDelta, 0.05);
    state.alpha = reducedMotion || testMode ? goal : MathUtils.damp(state.alpha, goal, 6, delta);
    if (Math.abs(state.alpha - goal) < 0.002) state.alpha = goal;
    material.uniforms.uAlpha!.value = state.alpha;
    // visible (at zero) until the room is ready, so its shader compiles with the rest up front
    // instead of stalling the first chapter you open
    quad.visible = state.alpha > 0.001 || !useRoom.getState().sceneReady;

    // what stays lit: the thing in your hand, else the chapter's object
    const root = (state.alpha > 0.001 && (holding ? index.items.get(holding) : on ? index.objects.get(focus as never) : undefined)) || null;
    if (root !== state.root) {
      state.root = root;
      state.keep = new Set();
      root?.traverse((child) => {
        const mesh = child as Mesh;
        if (mesh.isMesh && !mesh.name.startsWith("hit__")) state.keep.add(mesh);
      });
    }
    const keep = state.keep;
    for (const [mesh, entry] of lit) {
      // a material swapped under us (picked up / put down): the old one gets its state back
      if (!keep.has(mesh) || entry.material !== mesh.material) {
        restore(entry);
        lit.delete(mesh);
      }
    }
    for (const mesh of keep) {
      if (lit.has(mesh) || Array.isArray(mesh.material)) continue;
      const material = mesh.material as Material;
      lit.set(mesh, { mesh, renderOrder: mesh.renderOrder, transparent: material.transparent, material });
      mesh.renderOrder = 1000;
      material.transparent = true;
    }
    if (state.alpha !== goal) invalidate();
  });

  return null;
}
