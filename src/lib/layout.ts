/**
 * Layout numbers shared by the camera (which frames objects in the space the UI leaves free)
 * and the CSS (src/app/globals.css uses the same values — keep them in sync).
 */
export const LAYOUT = {
  /** Below this width, panels become bottom sheets. */
  desktopMinWidth: 768,
  /** Space kept clear at the top for the 3D/Text switch. */
  topInset: 56,
  /** The right-hand sheet: min(440px, 36vw), 12px from the edges. */
  panelMaxWidth: 440,
  panelWidthRatio: 0.36,
  panelGap: 12,
  /** Bottom sheet height (first snap) as a share of the viewport. */
  sheetRatio: 0.46,
} as const;

export function panelWidth(viewportWidth: number): number {
  return Math.min(LAYOUT.panelMaxWidth, Math.round(viewportWidth * LAYOUT.panelWidthRatio)) + LAYOUT.panelGap * 2;
}

export const isDesktopWidth = (width: number) => width >= LAYOUT.desktopMinWidth;
