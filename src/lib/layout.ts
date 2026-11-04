/**
 * Layout numbers shared by the camera (which frames objects in the space the captions leave free)
 * and the CSS (src/components/caption/caption.css uses the same values — keep them in sync).
 */
export const LAYOUT = {
  /** Below this width, captions sit under the object instead of beside it. */
  desktopMinWidth: 768,
  /** Space kept clear at the top for the 3D/Text switch. */
  topInset: 56,
  /** The caption column on the right: clamp(340px, 30vw, 440px), 40px from the edge… */
  captionMin: 340,
  captionMax: 440,
  captionRatio: 0.3,
  captionGutter: 40,
  /** …and this much air between it and the object. */
  captionGap: 28,
  /** On phones the caption takes the bottom 52% of the screen. */
  captionPhoneRatio: 0.52,
} as const;

/** How much of the viewport's right side the caption takes (desktop). */
export function captionInset(viewportWidth: number): number {
  const width = Math.min(LAYOUT.captionMax, Math.max(LAYOUT.captionMin, viewportWidth * LAYOUT.captionRatio));
  return Math.round(width + LAYOUT.captionGutter + LAYOUT.captionGap);
}

export const isDesktopWidth = (width: number) => width >= LAYOUT.desktopMinWidth;
