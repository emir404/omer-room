"use client";

import { useProgress } from "@react-three/drei";
import { Suspense, useEffect } from "react";
import type { SceneData } from "@/lib/content/scene-data";
import { useRoom } from "@/lib/store";
import { CameraRig } from "./CameraRig";
import { Lights } from "./Lights";
import { LiveTextures } from "./LiveTextures";
import { Globe } from "./objects/Globe";
import { Hoop } from "./objects/Hoop";
import { Mailbox } from "./objects/Mailbox";
import { Shelf } from "./objects/Shelf";
import { Projector } from "./Projector";
import { ReadySignal } from "./ReadySignal";
import { Room } from "./Room";

/** Mirrors three's loading manager into the store, so the DOM loader doesn't import three. */
function LoadProgress() {
  const progress = useProgress((s) => s.progress);
  useEffect(() => {
    useRoom.setState({ loadProgress: progress });
  }, [progress]);
  return null;
}

/** Everything inside the Canvas. Each object component waits for the indexed GLB. */
export function Scene({ data }: { data: SceneData }) {
  return (
    <>
      <LoadProgress />
      <Lights />
      <Suspense fallback={null}>
        <Room />
        <LiveTextures data={data} />
        <Shelf books={data.books} photos={data.photos} />
        <Globe places={data.places} />
        <Hoop hoop={data.hoop} />
        <Mailbox />
        <ReadySignal />
      </Suspense>
      <CameraRig />
      <Projector />
    </>
  );
}
