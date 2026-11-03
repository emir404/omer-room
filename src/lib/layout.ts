/**
 * Layout numbers shared by the camera (which frames objects in the space the UI leaves free)
 * and the CSS (src/app/globals.css uses the same values — keep them in sync).
 */
export const LAYOUT = {
  /** Below this width, panels become bottom sheets. */
  desktopMinWidth: 768,
  topBar: 56,
  panelMaxWidth: 480,
  panelWidthRatio: 0.42,
  /** Bottom sheet height (first snap) as a share of the viewport. */
  sheetRatio: 0.45,
} as const;

export function panelWidth(viewportWidth: number): number {
  return Math.min(LAYOUT.panelMaxWidth, Math.round(viewportWidth * LAYOUT.panelWidthRatio));
}

export const isDesktopWidth = (width: number) => width >= LAYOUT.desktopMinWidth;
