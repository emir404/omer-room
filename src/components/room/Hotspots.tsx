"use client";

import type { SceneObject } from "@/lib/content/scene-data";
import { playSfx } from "@/lib/sound";
import { setHovered, useRoom } from "@/lib/store";
import { overlay, pinElements } from "./registry";

/**
 * One DOM layer that is three things at once:
 *  - keyboard access: a tab-ordered button per object (focus = highlight + label, Enter = open)
 *  - touch pins: always-visible labels on phones, ≥44px targets
 *  - the hover selection box (corner brackets + label) for the pointer
 * Positions are written every frame by <Projector/>.
 */
export function Hotspots({ objects }: { objects: SceneObject[] }) {
  const hovered = useRoom((s) => s.hovered);
  const hoveredSub = useRoom((s) => s.hoveredSub);
  const focus = useRoom((s) => s.focus);
  const touch = useRoom((s) => s.touch);
  const ready = useRoom((s) => s.sceneReady);
  const labelOf = (id: string) => objects.find((o) => o.id === id)?.label ?? "";

  const activate = (object: SceneObject) => {
    const { navigate } = useRoom.getState();
    if (object.href) {
      playSfx("open");
      navigate(object.href);
    } else if (object.id === "hoop") {
      useRoom.setState((s) => ({ shotRequest: s.shotRequest + 1 }));
    }
  };

  const label = hoveredSub?.label ?? (hovered && hovered !== focus ? labelOf(hovered) : "");

  return (
    <div className="hotspots" data-focus={focus} data-touch={touch ? "1" : "0"} data-ready={ready ? "1" : "0"}>
      <nav aria-label="Things in the room">
        <ul>
          {objects.map((object) => (
            <li
              key={object.id}
              className="pin"
              data-id={object.id}
              data-active={hovered === object.id ? "1" : "0"}
              data-current={focus === object.id ? "1" : "0"}
              data-onscreen="0"
              ref={(el) => {
                if (el) pinElements.set(object.id, el);
                else pinElements.delete(object.id);
              }}
            >
              <button
                type="button"
                data-testid={`pin-${object.id}`}
                aria-label={`${object.label}: ${object.description}`}
                aria-current={focus === object.id ? "page" : undefined}
                onFocus={() => setHovered(object.id, "keyboard")}
                onBlur={() => setHovered(null, "keyboard")}
                onClick={() => activate(object)}
              >
                <span className="pin-dot" aria-hidden="true" />
                <span className="pin-label" aria-hidden="true">
                  {object.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div
        className="selection"
        aria-hidden="true"
        data-visible="0"
        ref={(el) => {
          overlay.selection = el;
        }}
      >
        <i className="corner tl" />
        <i className="corner tr" />
        <i className="corner bl" />
        <i className="corner br" />
        {label ? <span className="selection-label">{label}</span> : null}
      </div>
    </div>
  );
}
