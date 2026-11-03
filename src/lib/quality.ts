/** Device tiers: picks texture sizes, DPR range and effects. */
export type Tier = "desktop" | "mobile";

export function isTouchDevice(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function detectTier(): Tier {
  if (typeof window === "undefined") return "desktop";
  return isTouchDevice() || window.innerWidth < 768 ? "mobile" : "desktop";
}

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

/** [min, max] device pixel ratio. PerformanceMonitor moves within this range. */
export function dprRange(tier: Tier): [number, number] {
  const native = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1;
  const max = tier === "mobile" || isIOS() ? 1.5 : 2;
  return [1, Math.min(native, max)];
}

export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
