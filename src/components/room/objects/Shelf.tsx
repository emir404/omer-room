"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import { type BufferAttribute, type Mesh, type MeshBasicMaterial, type MeshStandardMaterial, type Object3D, SRGBColorSpace, type Texture, TextureLoader } from "three";
import type { SceneBook, SceneShelf } from "@/lib/content/scene-data";
import { detectTier } from "@/lib/quality";
import { useRoom } from "@/lib/store";
import { canvasTexture, ensureFonts, makeCanvas } from "@/lib/textures/canvas";
import { CERT_H, CERT_W, drawCertificate, drawPlateAtlas, drawTitlePage, PAGE_H, PAGE_W } from "@/lib/textures/paper";
import { drawPhotoPlaceholder, PHOTO_H, PHOTO_W } from "@/lib/textures/screens";
import { drawBinderAtlas, drawSpineAtlas } from "@/lib/textures/spines";
import { useSceneIndex } from "../scene-index";
import { buildShelfMap, useShelfMap } from "../shelf-map";

/** Maps a slot's 0..1 UVs into its atlas cell (from a saved copy, so it's safe to re-run).
 *  getX/setXY handle quantized (normalized integer) UVs from the compressed GLB. */
function remapUV(mesh: Mesh, cell: { u0: number; v0: number; u1: number; v1: number }) {
  // identical slots share one geometry after compression (dedup): give each its own copy first
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

/** The slot's own color as the art pass painted it (the binders' plastic). */
function baseColor(mesh: Mesh): string {
  const material = mesh.material as SlotMaterial;
  mesh.userData.baseColor ??= `#${material.color.getHexString()}`;
  return mesh.userData.baseColor as string;
}

/** Every mesh of an item answers the pointer the same way: what it is, where it leads. */
function tagItem(node: Object3D, sub: { key: string; label: string; href: string } | undefined) {
  node.traverse((child) => {
    if ((child as Mesh).isMesh) child.userData.sub = sub;
  });
}

const loader = new TextureLoader();
function coverTexture(src: string, onLoad: () => void): Texture {
  const texture = loader.load(src, onLoad);
  texture.flipY = false;
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * Content → the shelf. Books fill the book items (spines drawn from title and color, the real
 * cover on the front board); school items get labeled binders; section plates are engraved with
 * the section names; the research paper's title page and the certificate are printed; MUN photos
 * fill the frames. Every item becomes a target once the camera is on the shelf (userData.sub,
 * resolved in Room.tsx), and shelf-map.ts says what each one opens.
 */
export function Shelf({ books, shelf, photos }: { books: SceneBook[]; shelf: SceneShelf; photos: { src: string; alt: string }[] }) {
  const index = useSceneIndex((s) => s.index);
  const invalidate = useThree((s) => s.invalidate);
  const focus = useRoom((s) => s.focus);
  const map = useMemo(() => (index ? buildShelfMap(index, shelf, books) : null), [index, shelf, books]);

  useEffect(() => {
    if (map) useShelfMap.setState({ map });
  }, [map]);

  // targets, labels and what's left empty
  useEffect(() => {
    if (!index || !map) return;
    for (const [id, node] of index.items) {
      const entry = map.byItem.get(id);
      tagItem(node, entry ? { key: `item:${id}`, label: entry.label, href: entry.href } : undefined);
      // an empty book spot or binder isn't on the shelf at all
      if (map.books.has(id)) node.visible = Boolean(map.books.get(id));
      // a spine-out book's front cover is pressed against its neighbor: don't draw it until it's
      // in your hand (the Inspector shows it) — 21 fewer draw calls
      if (map.books.has(id) && !node.userData.faceout) {
        node.traverse((child) => {
          if (child.name.startsWith("slot__cover__")) child.visible = false;
        });
      }
      if (map.binders.has(id)) node.visible = Boolean(map.binders.get(id));
    }
    for (const plate of index.slots.label) {
      const section = shelf.sections.find((s) => s.id === plate.userData.section);
      plate.userData.sub = section ? { key: `section:${section.id}`, label: section.title, href: section.href } : undefined;
    }
    invalidate();
  }, [index, map, shelf, invalidate]);

  // printed things: spines, binder labels, plates, the title page, photos
  useEffect(() => {
    if (!index || !map) return;
    let cancelled = false;
    const disposables: Texture[] = [];

    void (async () => {
      await ensureFonts();
      if (cancelled) return;

      // spines, in slot order; the book on each spine's item (or none)
      const spines = index.slots.book;
      const bookOf = (mesh: Mesh) => {
        const id = index.itemOf.get(mesh) ?? `book_${mesh.name.slice(-2)}`;
        return map.books.get(id) ?? null;
      };
      if (spines.length) {
        const atlas = drawSpineAtlas(spines.map(bookOf));
        disposables.push(atlas.texture);
        spines.forEach((mesh, i) => {
          remapUV(mesh, atlas.cell(i));
          applyTexture(mesh, atlas.texture);
        });
      }

      const binderSlots = index.slots.binder;
      if (binderSlots.length) {
        const labelOf = (mesh: Mesh) => {
          const id = index.itemOf.get(mesh) ?? `binder_${mesh.name.slice(-2)}`;
          return map.binders.get(id)?.spine ?? "";
        };
        const labels = drawBinderAtlas(binderSlots.map((mesh) => ({ label: labelOf(mesh), color: baseColor(mesh) })));
        disposables.push(labels.texture);
        binderSlots.forEach((mesh, i) => {
          remapUV(mesh, labels.cell(i));
          applyTexture(mesh, labels.texture);
        });
      }

      const plates = index.slots.label;
      if (plates.length) {
        const nameOf = (mesh: Mesh) => shelf.sections.find((s) => s.id === mesh.userData.section)?.label ?? "";
        const atlas = drawPlateAtlas(plates.map(nameOf));
        disposables.push(atlas.texture);
        plates.forEach((mesh, i) => {
          remapUV(mesh, atlas.cell(i));
          applyTexture(mesh, atlas.texture);
        });
      }

      // the bound paper's title page: the shelf item the paper prop belongs to says what's on it
      const paperItem = shelf.items.find((i) => i.slug === map.byItem.get("paper_research")?.slug) ?? shelf.items.find((i) => i.paper);
      for (const page of index.slots.page) {
        const { canvas, ctx } = makeCanvas(PAGE_W, PAGE_H);
        ctx.imageSmoothingEnabled = true;
        drawTitlePage(ctx, {
          title: paperItem?.paper?.title ?? paperItem?.title ?? "",
          byline: "Ömer Öztok",
          note: paperItem?.paper?.note ?? "",
          date: "Working draft",
        });
        const texture = canvasTexture(canvas, false);
        texture.anisotropy = 8;
        disposables.push(texture);
        applyTexture(page, texture);
      }
      invalidate();
    })();

    // photos: MUN frames get the conference photos; the certificate its own picture
    index.slots.photo.forEach((mesh, i) => {
      const isCertificate = index.itemOf.get(mesh) === "certificate";
      const photo = isCertificate ? undefined : photos[i];
      let texture: Texture;
      if (photo) {
        texture = coverTexture(photo.src, () => invalidate());
      } else if (isCertificate) {
        const { canvas, ctx } = makeCanvas(CERT_W, CERT_H);
        ctx.imageSmoothingEnabled = true;
        drawCertificate(ctx, "My LGS Buddy");
        texture = canvasTexture(canvas, false);
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
  }, [index, map, shelf, photos, invalidate]);

  // real covers on the front boards: face-out books right away, the rest once you're at the shelf
  // (they only show when a book is in your hand)
  const atShelf = focus === "shelf";
  const holding = useRoom((s) => s.holding);
  useEffect(() => {
    if (!index || !map) return;
    const tier = detectTier();
    const queue: { mesh: Mesh; src: string; first: boolean }[] = [];
    for (const mesh of index.slots.cover) {
      const id = index.itemOf.get(mesh);
      const book = id ? map.books.get(id) : null;
      if (!book?.cover) continue;
      const faceout = Boolean(index.items.get(id!)?.userData.faceout);
      if (!faceout && !atShelf) continue;
      const src = book.cover[tier];
      // covers stay loaded for the visit (coming back to the shelf shouldn't reload them)
      if (mesh.userData.coverSrc === src) continue;
      queue.push({ mesh, src, first: id === holding });
    }
    // the one in your hand first; the rest one at a time, so their uploads never land in one frame
    queue.sort((a, b) => Number(b.first) - Number(a.first));
    let timer = 0;
    const next = () => {
      const job = queue.shift();
      if (!job) return;
      job.mesh.userData.coverSrc = job.src;
      applyTexture(job.mesh, coverTexture(job.src, () => invalidate()));
      timer = window.setTimeout(next, 90);
    };
    next();
    return () => window.clearTimeout(timer);
  }, [index, map, atShelf, holding, invalidate]);

  return null;
}
