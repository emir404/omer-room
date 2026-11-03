import type { ReactNode } from "react";

/** Text-only pages: no room, no 3D bundle. */
export default function TextLayout({ children }: { children: ReactNode }) {
  return <div className="text-root">{children}</div>;
}
