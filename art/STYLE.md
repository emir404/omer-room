# Ömer's Room — art style

A cozy, soft-realistic stylized room seen as a cutaway diorama: real-world scale, chunky friendly
proportions, every hard edge bevelled, soft baked light. What's *on* things is real: the computer
and the phone run live, product-quality UIs, the window shows a photograph, the globe a real relief
map. Only the LED ticker on the desk is dot-matrix, because that's what LED tickers are.

## Palette (`art/blender/lib/mats.py`)

| Role | Material | Color |
|---|---|---|
| Upper walls | `plaster` | `#EFE7DA` warm off-white |
| Lower walls (wainscot + moldings) | `wainscot` | `#8FA38A` sage |
| Trim (rails, baseboards, casings, window) | `trim` | `#F6F1E7` |
| Diorama cut faces | `wall_cut` / `floor_edge` | `#4A3A30` / `#8C6440` |
| Floor | `floor_planks` (texture) | oak planks, 14 cm wide |
| Furniture | `walnut` / `walnut_dark` / `oak` | `#7A5034` / `#553624` / `#C99B69` |
| Accents | `terracotta` `mustard` `navy` `teal` `orange` | `#C4613D` `#D9A441` `#26395A` `#2F5E58` `#EE6A12` |
| Metals | `brass` `gold` `silver` `bronze` `steel` | baked as diffuse, sheen added at runtime |

Rules: one warm neutral base (plaster, oak, walnut); color comes from objects (kilim, curtains,
books, plants). Avoid pure white and pure black — `paper` and `ink` instead. New colors go in the
palette, not inline, unless they're one-off cover colors (`M("#7A2E2E")`).

## Shape language

- **Bevels everywhere** (`lib.geo.box/rrect/cyl` do it by default): furniture 5–8 mm, small props
  1–3 mm, keycaps and trim 0.5–2 mm. Smooth shading + weighted normals keep flat faces flat.
- **Turned shapes** (`lathe`) for anything round: pots, mugs, the trophy, the globe base, medals.
- **Real scale** in meters: desk top 0.77, chair seat 0.445, door 0.92 × 2.08, shelf boards 0.5 apart.
- **Lived-in, not cluttered**: every surface gets one or two small stories (sticky notes, a pen cup,
  a missed paper shot next to the bin). Leave negative space on the walls.
- **Brief objects read first**: shelf, computer, phone, globe, window, letter (crooked 3.5°),
  mailbox, ball + hoop. Decor must never out-shout them.

## Light (`art/blender/lib/lights.py`)

- Day: soft sky through the open sides + a low sun through the window (area light with a 9° spread)
  that throws the mullion shadows across the rug.
- Night (shader): the day bake cooled and dimmed, plus the desk lamp (warm), monitor (cool) and
  string lights (warm), each baked alone into one channel of the mask.
- Colour management: AgX in Blender and in three (`AgXToneMapping`), so the browser matches the
  preview renders.

## Lightmap budget

- Two atlases: `props` (everything on the floor/walls) and `room` (walls, floor, wainscot, rug).
- Desktop: props 2048 day + 1024 mask, room 1024 day + 512 mask. Mobile: half of each.
- Uniform texel density; small dense details (keycaps, fringe, leaves, net) get 30–55% density.
- Faces that touch another surface are culled before unwrapping (nobody sees a mug's bottom).
