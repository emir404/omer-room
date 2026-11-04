"use client";

import { surfaces } from "@/components/room/registry";
import type { ChapterData } from "@/lib/content/chapters";

/**
 * The letter's original file, laid over the frame in the room once the camera is on it
 * (LetterProjector writes its box). Never resized or recompressed by the site: a plain <img> of
 * the file, so what you read is exactly the letter.
 */
export function LetterSurface({ image }: { image: NonNullable<ChapterData["letter"]["image"]> }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- the original file, 1:1 with the image Ömer provides
    <img
      className="letter-surface"
      src={image.src}
      alt={image.alt}
      width={image.width}
      height={image.height}
      data-shown="0"
      decoding="async"
      ref={(el) => {
        surfaces.letter = el;
      }}
    />
  );
}
