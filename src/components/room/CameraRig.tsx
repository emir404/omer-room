"use client";

import { CameraControls, CameraControlsImpl } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import { MathUtils, type PerspectiveCamera, Quaternion, Vector3 } from "three";
import { isDesktopWidth, LAYOUT, panelWidth } from "@/lib/layout";
import { CHAPTERS, isChapterId } from "@/lib/routes";
import type { FocusId, ScreenId } from "@/lib/scene-contract";
import { useRoom } from "@/lib/store";
import { type SceneIndex, useSceneIndex } from "./scene-index";

const { ACTION } = CameraControlsImpl;

interface Pose {
  position: Vector3;
  target: Vector3;
  offset: { x: number; y: number };
}

/**
 * Where the camera goes for a focus. Presets in the GLB (cam__<id> → cam__<id>__target) give the
 * direction; the distance is computed so the object fits the part of the viewport the UI leaves
 * free (right panel on desktop, bottom sheet on mobile), then a focal offset re-centers it there.
 * Screens are framed head-on so their DOM UI can sit exactly on top.
 */
function computePose(focus: FocusId, index: SceneIndex, camera: PerspectiveCamera, width: number, height: number): Pose {
  const chapter = focus !== "room" && isChapterId(focus) ? CHAPTERS[focus] : null;
  const portrait = width < height;
  // on phones the computer opens as a sheet (its screen is too small to read), like a panel
  const sheet = chapter?.kind === "panel" || (focus === "computer" && !isDesktopWidth(width));
  const insets = { top: chapter?.kind === "screen" && !sheet ? 0 : LAYOUT.topInset, right: 0, bottom: 0 };
  if (sheet) {
    if (isDesktopWidth(width)) insets.right = panelWidth(width);
    else insets.bottom = Math.round(height * LAYOUT.sheetRatio);
  }

  const vFov = MathUtils.degToRad(camera.fov);
  const hFov = 2 * Math.atan(Math.tan(vFov / 2) * (width / height));
  const usableV = 2 * Math.atan((Math.tan(vFov / 2) * (height - insets.top - insets.bottom)) / height);
  const usableH = 2 * Math.atan((Math.tan(hFov / 2) * (width - insets.right)) / width);
  const fit = (radius: number) => radius / Math.sin(Math.min(usableV, usableH) / 2);

  let target: Vector3;
  let direction: Vector3;
  let distance: number;

  const screen = chapter?.kind === "screen" && !sheet ? index.screens.get(focus as ScreenId) : undefined;
  if (screen) {
    // fit the screen's rectangle (not its bounding sphere) so the UI on it is big enough to read
    screen.geometry.computeBoundingBox();
    const size = screen.geometry.boundingBox!.getSize(new Vector3()).multiply(screen.getWorldScale(new Vector3()));
    const fill = focus === "computer" ? 0.84 : 0.86;
    target = screen.getWorldPosition(new Vector3());
    direction = new Vector3(0, 0, 1).applyQuaternion(screen.getWorldQuaternion(new Quaternion())).normalize();
    distance = Math.max(size.y / 2 / Math.tan(usableV / 2), size.x / 2 / Math.tan(usableH / 2)) / fill;
  } else {
    const preset = index.cams.get(focus) ?? index.cams.get("room")!;
    target = preset.target.clone();
    direction = preset.position.clone().sub(preset.target).normalize();
    if (focus === "room") {
      // portrait: frame the whole room around its bounds; landscape: the preset's composition
      if (portrait) target = index.roomSphere.center.clone().setY(1.1);
      distance = fit(index.roomSphere.radius * (portrait ? 0.82 : 0.74));
    } else {
      distance = fit((index.spheres.get(focus)?.radius ?? 0.5) * 1.12);
    }
  }

  const position = target.clone().addScaledVector(direction, distance);
  const worldPerPx = (2 * distance * Math.tan(vFov / 2)) / height;
  // camera-controls applies focal offset in screen space with y pointing down:
  // +x moves the view right (object shifts left), +y moves it down (object shifts up).
  return {
    position,
    target,
    offset: { x: (insets.right / 2) * worldPerPx, y: ((insets.bottom - insets.top) / 2) * worldPerPx },
  };
}

export function CameraRig() {
  const ref = useRef<CameraControlsImpl>(null);
  const index = useSceneIndex((s) => s.index);
  const focus = useRoom((s) => s.focus);
  const touch = useRoom((s) => s.touch);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const invalidate = useThree((s) => s.invalidate);
  const first = useRef(true);
  const base = useRef<Pose["offset"]>({ x: 0, y: 0 });

  // input: no free orbit; a small swipe on touch overview (set after each move)
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.smoothTime = 0.55;
    c.draggingSmoothTime = 0.12;
    c.restThreshold = 0.003;
    c.mouseButtons.left = ACTION.NONE;
    c.mouseButtons.middle = ACTION.NONE;
    c.mouseButtons.right = ACTION.NONE;
    c.mouseButtons.wheel = ACTION.NONE;
    c.touches.one = ACTION.NONE;
    c.touches.two = ACTION.NONE;
    c.touches.three = ACTION.NONE;
    const rest = () => useRoom.setState({ cameraAtRest: true });
    const moving = () => useRoom.setState({ cameraAtRest: false });
    c.addEventListener("rest", rest);
    c.addEventListener("transitionstart", moving);
    return () => {
      c.removeEventListener("rest", rest);
      c.removeEventListener("transitionstart", moving);
    };
  }, []);

  // focus / viewport change → move
  useEffect(() => {
    const c = ref.current;
    if (!c || !index) return;
    const { reducedMotion, testMode } = useRoom.getState();
    const pose = computePose(focus, index, camera, width, height);
    const animate = !first.current && !reducedMotion && !testMode;
    first.current = false;
    base.current = pose.offset;

    c.minAzimuthAngle = Number.NEGATIVE_INFINITY;
    c.maxAzimuthAngle = Number.POSITIVE_INFINITY;
    c.minPolarAngle = 0;
    c.maxPolarAngle = Math.PI;
    c.touches.one = ACTION.NONE;
    useRoom.setState({ cameraAtRest: false });

    let cancelled = false;
    void Promise.all([
      c.setLookAt(pose.position.x, pose.position.y, pose.position.z, pose.target.x, pose.target.y, pose.target.z, animate),
      c.setFocalOffset(pose.offset.x, pose.offset.y, 0, animate),
    ]).then(() => {
      if (cancelled) return;
      if (focus === "room" && touch) {
        // portrait/touch overview: allow a small look-around swipe
        c.minAzimuthAngle = c.azimuthAngle - MathUtils.degToRad(25);
        c.maxAzimuthAngle = c.azimuthAngle + MathUtils.degToRad(25);
        c.minPolarAngle = c.polarAngle - MathUtils.degToRad(6);
        c.maxPolarAngle = c.polarAngle + MathUtils.degToRad(6);
        c.touches.one = ACTION.TOUCH_ROTATE;
      }
      if (!animate) useRoom.setState({ cameraAtRest: true });
    });
    invalidate();
    return () => {
      cancelled = true;
    };
  }, [focus, index, width, height, touch, camera, invalidate]);

  // desktop overview: gentle pointer parallax
  useEffect(() => {
    if (touch || focus !== "room") return;
    const { reducedMotion, testMode } = useRoom.getState();
    if (reducedMotion || testMode) return;
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const c = ref.current;
        if (!c) return;
        const px = (e.clientX / window.innerWidth) * 2 - 1;
        const py = (e.clientY / window.innerHeight) * 2 - 1;
        void c.setFocalOffset(base.current.x + px * 0.12, base.current.y + py * 0.07, 0, true);
      });
    };
    window.addEventListener("pointermove", onMove);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
    };
  }, [focus, touch]);

  return <CameraControls ref={ref} makeDefault />;
}
