import type { ReactNode } from "react";
import { RoomShell } from "@/components/room/RoomShell";
import { TextView } from "@/components/text/TextView";
import { getChapterData } from "@/lib/content/chapters";
import { getSceneData } from "@/lib/content/scene-data";

/**
 * The persistent room. Lives in a layout (not a template), so the 3D canvas never remounts
 * while visitors move between chapters; the captions follow the URL (src/components/caption).
 * The text view is rendered here too: it's what browsers without WebGL (or JavaScript) see.
 */
export default function RoomLayout({ children }: { children: ReactNode }) {
  return (
    <RoomShell data={getSceneData()} chapters={getChapterData()} text={<TextView />}>
      {children}
    </RoomShell>
  );
}
