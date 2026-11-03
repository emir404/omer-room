"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { type BufferAttribute, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, SRGBColorSpace, type Texture, TextureLoader } from "three";
import type { SceneBook } from "@/lib/content/scene-data";
import { assignSlots } from "@/lib/slots";
import { canvasTexture, ensureFonts, makeCanvas } from "@/lib/textures/canvas";
import { drawPhotoPlaceholder, PHOTO_H, PHOTO_W } from "@/lib/textures/screens";
import { drawSpineAtlas } from "@/lib/textures/spines";
import { useSceneIndex } from "../scene-index";

/** Maps a slot's 0..1 UVs into its atlas cell (from a saved copy, so it's safe to re-run).
 *  getX/setXY handle quantized (normalized integer) UVs from the compressed GLB. */
function remapUV(mesh: Mesh, cell: { u0: number; v0: number; u1: number; v1: number }) {
  const attr = mesh.geometry.getAttribute("uv") as BufferAttribute;
  let original = mesh.userData.uv0 as Float32Array | undefined;
  if (!original) {
    original = new Float32Array(attr.count * 2);
    for (let i = 0; i < attr.count; i++) {
      original[i * 2] = attr.getX(i);
      original[i * 2 + 1] = attr.getY(i);
    }
    mesh.userData.uv0 = original;
  }
  for (let i = 0; i < attr.count; i++) {
    attr.setXY(i, cell.u0 + original[i * 2]! * (cell.u1 - cell.u0), cell.v0 + original[i * 2 + 1]! * (cell.v1 - cell.v0));
  }
  attr.needsUpdate = true;
}

function applyTexture(mesh: Mesh, texture: Texture) {
  const material = mesh.material as MeshStandardMaterial | MeshBasicMaterial;
  material.map = texture;
  material.color.set("#ffffff");
  material.needsUpdate = true;
}

/**
 * Content → shelf. Books from content/books fill the baked spine slots in `order` (or a pinned
 * `slot`); MUN photos fill the photo frames. Spines become clickable once the camera is on the
 * shelf (userData.sub, resolved in Room.tsx).
 */
export function Shelf({ books, photos }: { books: SceneBook[]; photos: { src: string; alt: string }[] }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!index) return;
    let cancelled = false;
    let atlasTexture: Texture | null = null;
    const slots = index.slots.book;
    const { assigned, overflow } = assignSlots(books, slots.length);
    if (overflow.length && process.env.NODE_ENV !== "production") {
      console.warn(`[shelf] ${overflow.length} book(s) don't fit on the shelf and are listed in the panel only.`);
    }
    for (const [i, mesh] of slots.entries()) {
      const book = assigned[i];
      mesh.userData.sub = book ? { key: `book:${book.slug}`, label: book.title, href: book.href } : undefined;
    }
    // spine titles need the web fonts
    void ensureFonts().then(() => {
      if (cancelled) return;
      const atlas = drawSpineAtlas(assigned);
      atlasTexture = atlas.texture;
      slots.forEach((mesh, i) => {
        remapUV(mesh, atlas.cell(i));
        applyTexture(mesh, atlas.texture);
      });
      invalidate();
    });

    const loader = new TextureLoader();
    const photoTextures = index.slots.photo.map((mesh, i) => {
      const photo = photos[i];
      let texture: Texture;
      if (photo) {
        texture = loader.load(photo.src, () => invalidate());
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
      } else {
        const { canvas, ctx } = makeCanvas(PHOTO_W, PHOTO_H);
        drawPhotoPlaceholder(ctx, i);
        texture = canvasTexture(canvas, true);
      }
      applyTexture(mesh, texture);
      return texture;
    });

    invalidate();
    return () => {
      cancelled = true;
      atlasTexture?.dispose();
      for (const texture of photoTextures) texture.dispose();
    };
  }, [index, books, photos, invalidate]);

  return null;
}
