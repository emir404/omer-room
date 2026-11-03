"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import { Color, type DirectionalLight, MathUtils, type Mesh, PMREMGenerator, Vector3 } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { ASSETS } from "@/lib/assets";
import { useRoom } from "@/lib/store";
import { useSceneIndex } from "./scene-index";

/** Baked room: lightmaps light the static scene; these lights only touch what moves (globe, ball). */
const BAKED = ASSETS.lightmaps !== null;

const c = (hex: string) => new Color(hex);
const DAY = { sky: c("#FFF3E0"), ground: c("#B9A58A"), key: c("#FFE4BC") };
const NIGHT = { sky: c("#3B4C80"), ground: c("#1A1F2E"), key: c("#8EA2FF") };

/**
 * Realtime lights. With the baked room (art pass) only the moving things are lit this way — a sky
 * fill plus the window's sun/moon direction, tuned to sit with the lightmaps. Without lightmaps (the
 * Phase 1 blockout): hemisphere + a shadow-casting key + small night lights at the lamp, monitor and
 * string lights.
 */
export function Lights() {
  const nightness = useRoom((s) => s.nightness);
  const index = useSceneIndex((s) => s.index);
  const key = useRef<DirectionalLight>(null);
  const invalidate = useThree((s) => s.invalidate);
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);

  const lamp = useMemo(() => {
    const out = new Vector3(1.32, 1.15, -1.9);
    index?.root.traverse((node) => {
      if ((node as Mesh).isMesh && node.userData.glow === "lamp" && node.name.endsWith("__04")) node.getWorldPosition(out);
    });
    return out;
  }, [index]);
  const monitor = useMemo(() => {
    const screen = index?.screens.get("computer");
    return screen ? screen.getWorldPosition(new Vector3()).add(new Vector3(0, 0, 0.35)) : new Vector3(0.5, 1.17, -1.6);
  }, [index]);

  // a generated studio environment, so metals (medals, brass, the rim) have something to reflect
  useEffect(() => {
    const pmrem = new PMREMGenerator(gl);
    const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environment = environment;
    invalidate();
    return () => {
      scene.environment = null;
      environment.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, invalidate]);

  useEffect(() => {
    scene.environmentIntensity = MathUtils.lerp(0.45, 0.1, nightness);
    // the key light targets the room's center, not the origin
    if (key.current) {
      key.current.target.position.set(-0.2, 0.6, -0.6);
      key.current.target.updateMatrixWorld();
    }
    invalidate();
  }, [nightness, scene, invalidate]);

  const n = nightness;
  const lerpColor = (a: Color, b: Color) => a.clone().lerp(b, n);

  if (BAKED) {
    return (
      <>
        <hemisphereLight args={[lerpColor(DAY.sky, NIGHT.sky), lerpColor(DAY.ground, NIGHT.ground), MathUtils.lerp(1.15, 0.3, n)]} />
        {/* through the window: the sun by day, the moon by night */}
        <directionalLight position={[1.9, 3.45, -3.1]} color={lerpColor(DAY.key, NIGHT.key)} intensity={MathUtils.lerp(1.5, 0.2, n)} />
        <pointLight position={lamp} color="#FFB45E" intensity={MathUtils.lerp(0, 1.8, n)} distance={3.5} decay={2} />
      </>
    );
  }

  return (
    <>
      <hemisphereLight args={[lerpColor(DAY.sky, NIGHT.sky), lerpColor(DAY.ground, NIGHT.ground), MathUtils.lerp(1.0, 0.45, n)]} />
      {/* cool fill from the open side so the door + mailbox stay readable at night */}
      <directionalLight position={[-3, 4, 6]} color="#7D8FD6" intensity={MathUtils.lerp(0.2, 0.55, n)} />
      <directionalLight
        ref={key}
        position={[4.2, 6.5, 5.2]}
        color={lerpColor(DAY.key, NIGHT.key)}
        intensity={MathUtils.lerp(2.4, 0.35, n)}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-camera-near={1}
        shadow-camera-far={18}
      />
      {/* daylight spilling in through the window */}
      <directionalLight position={[0.5, 3.2, -6]} color="#DDEBFF" intensity={MathUtils.lerp(0.5, 0, n)} />
      <pointLight position={lamp} color="#FFB45E" intensity={MathUtils.lerp(0.15, 2.6, n)} distance={4.5} decay={2} />
      <pointLight position={monitor} color="#A8D8FF" intensity={MathUtils.lerp(0.05, 0.8, n)} distance={1.8} decay={2} />
      <pointLight position={[0, 2.55, -1.95]} color="#FFD27A" intensity={MathUtils.lerp(0, 1.3, n)} distance={4.5} decay={2} />
    </>
  );
}
