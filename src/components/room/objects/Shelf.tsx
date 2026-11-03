"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { type BufferAttribute, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, SRGBColorSpace, type Texture, TextureLoader } from "three";
import type { SceneBinder, SceneBook } from "@/lib/content/scene-data";
import { assignSlots } from "@/lib/slots";
import { canvasTexture, ensureFonts, makeCanvas } from "@/lib/textures/canvas";
import { drawPhotoPlaceholder, PHOTO_H, PHOTO_W } from "@/lib/textures/screens";
import { coverColor, drawBinderAtlas, drawSpineAtlas } from "@/lib/textures/spines";
import { useSceneIndex } from "../scene-index";

/** Maps a slot's 0..1 UVs into its atlas cell (from a saved copy, so it's safe to re-run).
 *  getX/setXY handle quantized (normalized integer) UVs from the compressed GLB. */
function remapUV(mesh: Mesh, cell: { u0: number; v0: number; u1: number; v1: number }) {
  // identical slots (the binders' spines) share one geometry after compression (dedup): give each
  // slot its own copy before moving its UVs, or every binder would show the last one's label
  if (!mesh.userData.ownGeometry) {
    mesh.geometry = mesh.geometry.clone();
    mesh.userData.ownGeometry = true;
  }
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

type SlotMaterial = MeshStandardMaterial | MeshBasicMaterial;

function applyTexture(mesh: Mesh, texture: Texture) {
  const material = mesh.material as SlotMaterial;
  material.map = texture;
  material.color.set("#ffffff");
  material.needsUpdate = true;
}

/** The slot's own color as the art pass painted it (binders: navy, red, sage, mustard). */
function baseColor(mesh: Mesh): string {
  const material = mesh.material as SlotMaterial;
  mesh.userData.baseColor ??= `#${material.color.getHexString()}`;
  return mesh.userData.baseColor as string;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

/**
 * Content → shelf. The four binders are the shelf's chapters (labels from content/shelf.json, each
 * opens /shelf/<id>); the first featured book stands face-out with its real cover; the other books
 * fill the spines in `order` (a cover gives its spine its color); MUN photos fill the frames. All of
 * them become clickable once the camera is on the shelf (userData.sub, resolved in Room.tsx).
 */
export function Shelf({ books, binders, photos }: { books: SceneBook[]; binders: SceneBinder[]; photos: { src: string; alt: string }[] }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);

  useEffect(() => {
    if (!index) return;
    let cancelled = false;
    const disposables: Texture[] = [];
    const loader = new TextureLoader();

    // face-out: the first featured book with a cover
    const coverSlot = index.slots.cover[0];
    const featured = books.find((b) => b.featured && b.cover) ?? null;
    if (coverSlot) {
      coverSlot.userData.sub = featured ? { key: `book:${featured.slug}`, label: featured.title, href: featured.href } : undefined;
      if (featured?.cover) {
        const texture = loader.load(featured.cover, () => invalidate());
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
        texture.anisotropy = 8;
        applyTexture(coverSlot, texture);
        disposables.push(texture);
      }
    }

    // spines: everything else
    const spines = index.slots.book;
    const { assigned, overflow } = assignSlots(
      books.filter((b) => b !== featured),
      spines.length,
    );
    if (overflow.length && process.env.NODE_ENV !== "production") {
      console.warn(`[shelf] ${overflow.length} book(s) don't fit on the shelf and are listed in the panel only.`);
    }
    for (const [i, mesh] of spines.entries()) {
      const book = assigned[i];
      mesh.userData.sub = book ? { key: `book:${book.slug}`, label: book.title, href: book.href } : undefined;
    }

    // binders: the chapters
    const binderSlots = index.slots.binder;
    binderSlots.forEach((mesh, i) => {
      const binder = binders[i];
      mesh.userData.sub = binder ? { key: `binder:${binder.id}`, label: binder.title, href: binder.href } : undefined;
    });

    void (async () => {
      await ensureFonts();
      // real covers color their spines
      const colored = await Promise.all(
        assigned.map(async (book) => {
          if (!book?.cover) return book;
          const image = await loadImage(book.cover);
          if (!image) return book;
          const color = coverColor(image);
          const n = Number.parseInt(color.slice(1), 16);
          const lum = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
          return { ...book, color, text: lum > 0.6 ? "#1E1B16" : "#F4EEE3" };
        }),
      );
      if (cancelled) return;
      const atlas = drawSpineAtlas(colored);
      disposables.push(atlas.texture);
      spines.forEach((mesh, i) => {
        remapUV(mesh, atlas.cell(i));
        applyTexture(mesh, atlas.texture);
      });
      if (binderSlots.length) {
        const labels = drawBinderAtlas(binderSlots.map((mesh, i) => ({ label: binders[i]?.label ?? "", color: baseColor(mesh) })));
        disposables.push(labels.texture);
        binderSlots.forEach((mesh, i) => {
          remapUV(mesh, labels.cell(i));
          applyTexture(mesh, labels.texture);
        });
      }
      invalidate();
    })();

    index.slots.photo.forEach((mesh, i) => {
      const photo = photos[i];
      let texture: Texture;
      if (photo) {
        texture = loader.load(photo.src, () => invalidate());
        texture.flipY = false;
        texture.colorSpace = SRGBColorSpace;
      } else {
        const { canvas, ctx } = makeCanvas(PHOTO_W, PHOTO_H);
        drawPhotoPlaceholder(ctx, i);
        texture = canvasTexture(canvas, false);
      }
      applyTexture(mesh, texture);
      disposables.push(texture);
    });

    invalidate();
    return () => {
      cancelled = true;
      for (const texture of disposables) texture.dispose();
    };
  }, [index, books, binders, photos, invalidate]);

  return null;
}
