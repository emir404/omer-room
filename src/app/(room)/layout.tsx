import type { ReactNode } from "react";
import { RoomShell } from "@/components/room/RoomShell";
import { getSceneData } from "@/lib/content/scene-data";

/**
 * The persistent room. Lives in a layout (not a template), so the 3D canvas never remounts
 * while visitors move between chapters; each page only supplies the chapter content.
 */
export default function RoomLayout({ children }: { children: ReactNode }) {
  return <RoomShell data={getSceneData()}>{children}</RoomShell>;
}
