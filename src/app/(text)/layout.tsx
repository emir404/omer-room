import type { ReactNode } from "react";
import { DocMode } from "@/components/text/DocMode";

/** Text-only pages: no room, no 3D bundle. */
export default function TextLayout({ children }: { children: ReactNode }) {
  return (
    <div className="text-root">
      <DocMode />
      {children}
    </div>
  );
}
