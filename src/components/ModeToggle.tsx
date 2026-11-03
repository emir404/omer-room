"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { parsePath } from "@/lib/routes";

/** Sections of the text view, per room chapter (so switching keeps your place). */
const TEXT_ANCHOR: Record<string, string> = {
  shelf: "school",
  computer: "work",
  phone: "side-quests",
  globe: "places",
  window: "kozan",
  letter: "letter",
  contact: "contact",
};

const subscribe = () => () => {};
/** WebGL2 is decided before first paint (src/lib/webgl.ts); "0" = this browser can't show the room. */
const webglOk = () => document.documentElement.dataset.webgl !== "0";

/**
 * The one control on the page: switch between the 3D room and the text version. Plain links, so
 * it works without JavaScript; a segmented control so it always says which one you're on.
 */
export function ModeToggle({ current }: { current: "room" | "text" }) {
  const pathname = usePathname();
  const canRoom = useSyncExternalStore(subscribe, webglOk, () => true);
  const { chapter } = parsePath(pathname);
  const textHref = chapter && TEXT_ANCHOR[chapter] ? `/text#${TEXT_ANCHOR[chapter]}` : "/text";
  const roomIsCurrent = current === "room" && canRoom;

  return (
    <nav className="mode" aria-label="View" data-current={roomIsCurrent ? "room" : "text"}>
      <span className="mode-thumb" aria-hidden="true" />
      {canRoom ? (
        <Link href="/" className="mode-option" aria-current={roomIsCurrent ? "page" : undefined} prefetch={false}>
          3D
        </Link>
      ) : (
        <span className="mode-option" aria-disabled="true" title="This browser can't show the 3D room">
          3D
        </span>
      )}
      <Link href={current === "text" ? "/text" : textHref} className="mode-option" aria-current={roomIsCurrent ? undefined : "page"} prefetch={false}>
        Text
      </Link>
    </nav>
  );
}
