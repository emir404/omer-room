import Link from "next/link";
import type { SceneObject } from "@/lib/content/scene-data";

/**
 * Navigation for the text layout (no WebGL, JS off, or ?text=1). Hidden by CSS in room mode.
 * Server-renderable so it works with JavaScript disabled.
 */
export function DocNav({ objects }: { objects: SceneObject[] }) {
  return (
    <nav className="docnav" aria-label="Chapters">
      <ul>
        {objects
          .filter((o) => o.href)
          .map((o) => (
            <li key={o.id}>
              <Link href={o.href!}>
                <span className="docnav-label">{o.label}</span>
                <span className="docnav-desc">{o.description}</span>
              </Link>
            </li>
          ))}
      </ul>
    </nav>
  );
}
