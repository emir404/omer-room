"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { parsePath } from "@/lib/routes";
import { useRoom } from "@/lib/store";

/**
 * URL → camera. The pathname is the source of truth for focus; clicks set focus immediately
 * (the camera starts moving before the route finishes loading), then push the URL, so
 * back/forward and deep links all just work.
 */
export function RouteSync() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    useRoom.setState({
      navigate: (href: string) => {
        if (/^https?:\/\//.test(href)) {
          window.open(href, "_blank", "noopener,noreferrer");
          return;
        }
        const next = parsePath(href);
        useRoom.setState({ focus: next.focus, chapter: next.chapter, item: next.item, hovered: null, hoverSource: null, hoveredSub: null });
        router.push(href, { scroll: false });
      },
    });
  }, [router]);

  useEffect(() => {
    const next = parsePath(pathname);
    useRoom.setState({ focus: next.focus, chapter: next.chapter, item: next.item, hoveredSub: null });
  }, [pathname]);

  return null;
}
