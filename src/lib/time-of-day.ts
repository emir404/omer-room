/**
 * Day/night follows the visitor's own clock. `nightness` is 0 at full day and 1 at full night,
 * with ramps at dawn and dusk so the room never snaps.
 */
export type TimeOverride = "auto" | "day" | "night";

const HOUR = 60;
// minutes since midnight
const DAWN_START = 5 * HOUR + 30;
const DAWN_END = 7 * HOUR;
const DUSK_START = 18 * HOUR;
const DUSK_END = 20 * HOUR;

const smooth = (t: number) => t * t * (3 - 2 * t);

export function nightnessAt(date: Date): number {
  const m = date.getHours() * HOUR + date.getMinutes();
  if (m >= DAWN_END && m <= DUSK_START) return 0;
  if (m >= DUSK_END || m <= DAWN_START) return 1;
  if (m < DAWN_END) return 1 - smooth((m - DAWN_START) / (DAWN_END - DAWN_START));
  return smooth((m - DUSK_START) / (DUSK_END - DUSK_START));
}

export function resolveNightness(override: TimeOverride, date: Date = new Date()): number {
  if (override === "day") return 0;
  if (override === "night") return 1;
  return nightnessAt(date);
}

/** `?time=day|night` (tests, sharing a night screenshot) wins over the stored preference. */
export function overrideFromSearch(search: string): TimeOverride | null {
  const value = new URLSearchParams(search).get("time");
  return value === "day" || value === "night" ? value : null;
}

const STORAGE_KEY = "omer-room:time";

export function readStoredOverride(): TimeOverride {
  try {
    const value = window.localStorage.getItem(STORAGE_KEY);
    return value === "day" || value === "night" ? value : "auto";
  } catch {
    return "auto";
  }
}

export function storeOverride(value: TimeOverride): void {
  try {
    if (value === "auto") window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // private mode / blocked storage: the toggle still works for this visit
  }
}
