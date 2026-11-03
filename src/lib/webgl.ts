/**
 * Runs inline in <head> before first paint: decides between the 3D room and the text layout,
 * so there's no flash and no 3D download for visitors who can't render it.
 *   html[data-mode="room"] → JS on + WebGL2 works
 *   html[data-mode="doc"]  → no WebGL2, `?text=1`, or the /text page
 *   (no attribute)         → JS off → CSS shows the text layout
 *   html[data-webgl="0"]   → this browser can't show the room at all (the 3D switch is disabled)
 */
export const MODE_SCRIPT = `(function(){var d=document.documentElement;try{var c=document.createElement('canvas');var gl=c.getContext('webgl2');d.dataset.webgl=gl?'1':'0';if(gl){var l=gl.getExtension('WEBGL_lose_context');if(l)l.loseContext();}var q=new URLSearchParams(location.search);var t=location.pathname==='/text'||location.pathname==='/text/';d.dataset.mode=gl&&!t&&q.get('text')!=='1'?'room':'doc';}catch(e){d.dataset.mode='doc';d.dataset.webgl='0';}})();`;

export function initialMode(): "room" | "doc" {
  if (typeof document === "undefined") return "doc";
  return document.documentElement.dataset.mode === "room" ? "room" : "doc";
}

export function setDocumentMode(mode: "room" | "doc") {
  document.documentElement.dataset.mode = mode;
}

/** The text page: doc mode while it's open (client navigation doesn't re-run MODE_SCRIPT). */
export function enterTextPage(): () => void {
  const d = document.documentElement;
  d.dataset.mode = "doc";
  return () => {
    d.dataset.mode = d.dataset.webgl === "0" ? "doc" : "room";
  };
}
