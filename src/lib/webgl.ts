/**
 * Runs inline in <head> before first paint: decides between the 3D room and the text layout,
 * so there's no flash and no 3D download for visitors who can't render it.
 *   html[data-mode="room"] → JS on + WebGL2 works
 *   html[data-mode="doc"]  → no WebGL2, or `?text=1`
 *   (no attribute)         → JS off → CSS shows the text layout
 */
export const MODE_SCRIPT = `(function(){var d=document.documentElement;try{var q=new URLSearchParams(location.search);if(q.get('text')==='1'){d.dataset.mode='doc';return;}var c=document.createElement('canvas');var gl=c.getContext('webgl2');d.dataset.mode=gl?'room':'doc';if(gl){var l=gl.getExtension('WEBGL_lose_context');if(l)l.loseContext();}}catch(e){d.dataset.mode='doc';}})();`;

export function initialMode(): "room" | "doc" {
  if (typeof document === "undefined") return "doc";
  return document.documentElement.dataset.mode === "room" ? "room" : "doc";
}

export function setDocumentMode(mode: "room" | "doc") {
  document.documentElement.dataset.mode = mode;
}
