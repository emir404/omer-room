"use client";

import { useSyncExternalStore } from "react";

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 10_000);
  return () => window.clearInterval(timer);
}

const read = () => {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
};

/** Live HH:MM for the screen UIs. Empty on the server, so hydration never mismatches. */
export function Clock() {
  const time = useSyncExternalStore(subscribe, read, () => "");
  return <span className="clock">{time}</span>;
}
