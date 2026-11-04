# Art pass — Blender, fully scripted, $0

The room is built, lit and baked by Python scripts run in Blender headless (no GUI, no plugin, no
paid assets; textures are generated from code). Two inputs come from outside, both free to use: the
view out of the window is a CC0 Poly Haven panorama ("Dry Orchard Meadow", Alexander Scholten), and the
globe's map is Natural Earth's public-domain relief raster. `pnpm art sources` downloads them to
`art/src` (git-ignored). Behavior binds to node names (`src/lib/scene-contract.ts`); the site learns which files to
load from `src/lib/assets.manifest.json`. Look first: `art/STYLE.md`.

## Setup

- Blender 5.2 LTS (`brew install --cask blender`) — `BLENDER=/path/to/Blender` overrides the
  default `/Applications/Blender.app/Contents/MacOS/Blender`
- `basisu` for KTX2 (`brew install basis_universal`)
- Cycles bakes on the Mac's GPU (Metal); the first run compiles kernels (~2 min, once)

## Run it

```bash
pnpm art                 # everything: sources → views → textures → room → bake → export → assets
pnpm art views           # the window photo + globe map → art/out/views (art/blender/views.py)
pnpm art room            # rebuild art/out/room.blend after editing a prop
pnpm art preview -- day room,computer,shelf 128   # Cycles renders from the site's cameras → art/previews/
pnpm art preview -- day sec_school,sec_olympiad,sec_mun,sec_books 64   # the shelf's sections, from their anchors
pnpm art bake -- 128 2048 1024                    # quick bake (samples, props px, room px)
pnpm art bake            # final quality (384 spp)
pnpm art export && pnpm assets
pnpm scene:check && pnpm budget:check
```

Single prop under studio light: `Blender -b --factory-startup -P art/blender/preview_prop.py -- shelf 64`.
Shelf items as you'd hold them (straight on, 3/4, back): `… preview_prop.py -- shelf 64 item=medal_gold,book_06`.

## Files (`art/blender/`)

| File | What |
|---|---|
| `layout.py` | where everything stands + the site's camera presets (Blender coords, Z up) |
| `lib/core.py` | scene reset, groups + tags, modifiers, transforms |
| `lib/geo.py` | primitives with the house look: `box`, `rrect`, `cyl`, `lathe`, `loft`, `frame`, `tube`, `text`, `three_sphere` |
| `lib/mats.py` | the palette as Principled materials (exported as glTF materials) |
| `lib/plants.py` | leaves (heart, lance, monstera with slits) and vines |
| `lib/lights.py` | day / night light rigs (previews and bakes share them) |
| `props/*.py` | one module per area: shell, window, desk, computer, desk_objects, shelf, walldecor, door, floor, extras |
| `lib/shelf_kit.py` | the library's builders: books (cover shell + cover plane + pages), binders, medals in relief, ribbons, frames, stands |
| `textures.py` | procedural albedo textures (floor, kilim, ball, posters, cork) |
| `views.py` | the window view (a pinhole crop of the panorama: yaw, pitch, fov at the top of the file) and the globe map (relief + graticule, 4096×2048) |
| `og_image.py` | the social preview still; uses `scripts/capture-screens.ts` shots of the live screens |
| `build_room.py` | runs every prop, merges meshes per object + material, names them by the contract, adds hits/labels/cams, culls hidden faces, unwraps UV1 |
| `bake.py` / `encode.py` | Cycles light-only bakes → denoise → RGBM / sRGB PNGs per device tier |
| `export.py` | `art/out/room.glb` |
| `../../scripts/build-assets.ts` | GLB → meshopt + WebP; lightmap PNGs → KTX2 (UASTC + zstd); views → per-tier WebP; writes the manifest |

`art/out/` is generated (git-ignored). `public/3d/` and `src/lib/assets.manifest.json` are committed.

## Tags → contract names

Props tag objects (`own`, `contract`, `pivot`, `item`, `bake`, `glow`, `dynamic`, `shadow`, `lm`)
instead of naming them. `own="shelf"` → merged into `part__shelf__NN` under `obj__shelf`;
`own="decor:lamp"` → `decor__lamp[__NN]`; `contract="slot__book__03"` keeps that exact name and its
transform (slots, screens, displays, hits, pivots, labels, anchors). `bake="none"` = not lightmapped
(emissive or moving); `dynamic=True` = realtime-lit at runtime (globe, ball); `lm=0.3` = lightmap
density for that mesh.

**Items** (`with lib.core.item("medal_gold", frame, "olympiad"):`) are the shelf things you can pick
up. Their meshes merge per material under an empty `item__<id>` at the item's middle, oriented by
`frame` (+X out of the face you'd show someone, +Z up), named `item__<id>__NN`; their slot planes
keep their names under it. Model them closed on every side: items are never contact-culled, and
nothing is culled for touching them (lifting one shows what it stood on). Their hidden faces (a
book's boards between its neighbors, every bottom) get 15% lightmap density instead. Extras that
reach the glTF: `section`/`faceout` on items, `section` on `slot__label__NN`, `w`/`h` on
`anchor__section_<id>`, `open` on `pivot__contact_door`. Items keep their normals in the GLB
(`scripts/build-assets.ts`): they're realtime-lit in your hand.

## Lighting at runtime (`src/components/room/RoomMaterial.ts`)

```
day   = RGBM(day) · scale.day                      rgb · a² · 16 · scale
night = lum(day) · nightTint + Σ mask.i · scale.mask[i] · color.i      (R lamp, G monitor, B string)
color = albedo × mix(day, night, nightness) · exposure  (+ glow, hover highlight, metal sheen)
```

Light-only bakes keep albedo swappable: book spines, photos and the letter are drawn at runtime and
still sit in the baked light. Metals bake as diffuse and get a cube-map sheen scaled by local light.

## Content the art reads

- `content/letter.md` → the framed letter's proportions (`layout.letter_aspect()` reads the image's
  size), so the frame fits the real letter 1:1. Re-run `pnpm art` after adding or replacing it.
- The screens: `layout.SCREEN` (16:10) and `layout.PHONE_SCREEN` (iPhone, 402 × 874 pt) match the live
  DOM UIs' design sizes — change both together.
- Slots: `slot__book__NN` (each book's cover shell: the spine spans UV 0..1, the boards sit on the
  corner texel), `slot__cover__NN` (the same book's front cover), `slot__binder__NN` (the school
  binders' spine labels), `slot__photo__01..04` (MUN frames, the certificate), `slot__page__01` (the
  research paper's title page), `slot__label__01..04` (the section plates). Their front faces span
  UV 0..1 and carry `aspect`; the site paints them. Books are numbered in reading order (top to
  bottom, left to right; a stack top to bottom).

## Changing things

- Move or restyle a prop: edit its `props/*.py`, `pnpm art room`, `pnpm art preview`, then bake.
- New prop: add a module, list it in `build_room.MODULES`, tag it (`own=...`).
- Moving a clickable object: update `layout.py` (and `CAMS` if its chapter framing changes).
- Never rename contract nodes by hand; `pnpm scene:check` will tell you what's missing.
