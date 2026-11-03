"use client";

import { useSyncExternalStore } from "react";
import { useRoom } from "@/lib/store";

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 10_000);
  return () => window.clearInterval(timer);
}

const pad = (n: number) => String(n).padStart(2, "0");
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "22:31" (phone) or "Tue 3 Nov 22:31" (the desktop's menu bar). Tests freeze it at 9:41. */
function read(format: "phone" | "menubar") {
  const now = useRoom.getState().testMode ? new Date(2026, 10, 3, 9, 41) : new Date();
  const time = `${format === "phone" ? now.getHours() : pad(now.getHours())}:${pad(now.getMinutes())}`;
  return format === "phone" ? time : `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]}  ${time}`;
}

export function useClock(format: "phone" | "menubar") {
  return useSyncExternalStore(subscribe, () => read(format), () => "");
}

/** Live clock for the screen UIs. Empty on the server, so hydration never mismatches. */
export function Clock({ format = "phone" }: { format?: "phone" | "menubar" }) {
  return <span className="clock">{useClock(format)}</span>;
}
