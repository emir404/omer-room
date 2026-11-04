"use client";

import { useSyncExternalStore } from "react";
import { useRoom } from "@/lib/store";

/**
 * Ticks once a minute, on the minute (and when the tab comes back), so the screens never re-render
 * in between: nothing on them moves at idle.
 */
function subscribe(onChange: () => void) {
  let timer = 0;
  const schedule = () => {
    timer = window.setTimeout(
      () => {
        onChange();
        schedule();
      },
      60_000 - (Date.now() % 60_000) + 50,
    );
  };
  const onVisible = () => {
    if (document.visibilityState === "visible") onChange();
  };
  schedule();
  document.addEventListener("visibilitychange", onVisible);
  return () => {
    window.clearTimeout(timer);
    document.removeEventListener("visibilitychange", onVisible);
  };
}

const pad = (n: number) => String(n).padStart(2, "0");
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export type ClockFormat = "phone" | "menubar" | "lockdate";

/**
 * "9:41" (the phone's status bar and lock screen), "Tue 3 Nov  09:41" (the desktop's menu bar) or
 * "Tuesday 3 November" (the lock screen's date). Tests freeze it at Tue 3 Nov 2026, 9:41.
 */
function read(format: ClockFormat) {
  const now = useRoom.getState().testMode ? new Date(2026, 10, 3, 9, 41) : new Date();
  const day = DAYS[now.getDay()]!;
  const month = MONTHS[now.getMonth()]!;
  if (format === "lockdate") return `${day} ${now.getDate()} ${month}`;
  if (format === "phone") return `${now.getHours()}:${pad(now.getMinutes())}`;
  return `${day.slice(0, 3)} ${now.getDate()} ${month.slice(0, 3)}  ${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

/** Empty on the server, so hydration never mismatches. */
export function useClock(format: ClockFormat) {
  return useSyncExternalStore(subscribe, () => read(format), () => "");
}

/** Live clock text for the screen UIs. */
export function Clock({ format = "phone", className }: { format?: ClockFormat; className?: string }) {
  return <span className={className ?? "clock"}>{useClock(format)}</span>;
}
