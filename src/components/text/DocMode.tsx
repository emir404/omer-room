"use client";

import { useEffect } from "react";
import { enterTextPage } from "@/lib/webgl";

/** Keeps html[data-mode="doc"] while the text page is open, and hands the room back after. */
export function DocMode() {
  useEffect(() => enterTextPage(), []);
  return null;
}
