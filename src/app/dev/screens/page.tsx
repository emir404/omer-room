import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSceneData } from "@/lib/content/scene-data";
import { Harness } from "./Harness";

export const metadata: Metadata = { title: "Screens (dev)", robots: { index: false, follow: false } };

type Props = { searchParams: Promise<Record<string, string | string[] | undefined>> };

/**
 * Dev only: the computer's and the phone's live UIs standalone, at their design sizes, without the
 * room or WebGL, for quick screenshots under `pnpm dev` (http://localhost:3000/dev/screens).
 *   ?frame=os-1440        only that frame (ids are listed on the page)
 *   ?os=e2vc              the desktop's role       ?osc=e2vc   the compact role page
 *   ?app=copilot          the phone's app page     ?time=night the night wallpaper
 *   ?test=1               the frozen 9:41 clock and no transitions, as the e2e shots use
 *   ?switch=1             outline where the site's 3D/Text switch floats over compact frames
 * Links inside a frame change the frame instead of leaving the page.
 */
export default async function ScreensDevPage({ searchParams }: Props) {
  if (process.env.NODE_ENV === "production") notFound();
  const params = await searchParams;
  const one = (key: string) => (typeof params[key] === "string" ? (params[key] as string) : undefined);
  return <Harness data={getSceneData()} frame={one("frame")} os={one("os")} osc={one("osc")} app={one("app")} showSwitch={one("switch") === "1"} />;
}
