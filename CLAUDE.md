# Ömer's Room

Ömer Öztok's personal site: one interactive 3D room. Every object opens a chapter (bookshelf → academics,
computer → work, phone → socials & side projects, window → Kozan, framed letter → the OpenAI story, globe →
places, mailbox → contact, ball → easter egg). Next.js App Router + React Three Fiber; content lives in plain
files under `content/`.

**Editing content? Read `CONTENT.md` first.** Most changes are text/JSON edits there — no code.

## Commands

```bash
pnpm dev              # http://localhost:3000
pnpm content:check    # validate content/ + list remaining TODO placeholders
pnpm check            # typecheck, lint, content, scene contract, asset budget, unit tests
pnpm build && pnpm start -p 3100
pnpm test             # Playwright e2e (needs `pnpm build` first; starts the server itself)
pnpm shots            # screenshots of every chapter → test-results/shots/ (server on :3100)
PW_GPU=1 pnpm shots   # same, rendered on the Mac's GPU (Metal) instead of SwiftShader
pnpm art              # Blender art pipeline: textures → room → bake → export → assets (art/README.md)
pnpm art preview -- day room 128   # Cycles renders from the site's cameras → art/previews/
pnpm assets           # art/out → public/3d (meshopt GLB + KTX2 lightmaps) + src/lib/assets.manifest.json
pnpm blockout         # regenerate public/3d/blockout.glb (the Phase 1 stand-in, not loaded by the site)
```

Append `?test=1` to any URL for deterministic rendering (DPR 1, no animations, frozen clock),
`?time=day|night` to force lighting, `?text=1` for the text layout.

## Map

- `content/` — all words, numbers and image references (validated by `src/lib/content/schemas.ts`).
- `public/content/<chapter>/` — photos and screenshots referenced from content.
- `src/app/(room)/` — the room layout (persistent 3D canvas) + one route per chapter; pages are server
  components that render chapter content. `src/app/(text)/map` — text-only version (no 3D bundle).
- `src/components/room/` — everything 3D: `RoomCanvas` (lazy chunk), `Room` (GLB binding + pointer),
  `CameraRig` (route → camera), `Projector` (pins/labels/screen rects), `LiveTextures`, `objects/*`.
- `src/components/panels/` — `PanelHost` (places content: panel / bottom sheet / on a screen) + UI blocks.
- `src/components/screens/` — ÖmerOS (computer) and the phone UI (plain links, server-rendered).
- `src/lib/` — `scene-contract.ts` (GLB naming), `routes.ts`, `store.ts` (zustand, shared by DOM + 3D),
  `assets.ts` + `assets.manifest.json` (which GLB/lightmaps to load; generated), `layout.ts` (numbers
  shared by camera + CSS), `textures/*` (canvas art).
- `scripts/` — content/scene/budget checks, `build-assets.ts`, `art.mjs` (runs Blender), blockout, screenshots.
- `art/` — the Blender art pipeline: `art/blender/` scripts, `STYLE.md`, `README.md`. `art/out/` is generated.

## Rules

- **Versions are pinned on purpose.** `next` (exact) bundles its own React canary; upgrade next, react,
  three, @react-three/fiber, drei together and re-run `pnpm test`. Never install R3F 10 / drei 11 alphas
  (WebGPU-first). three must stay < 0.188 while @react-three/postprocessing is in use.
- **Keep three.js out of the DOM layer.** Anything importing `three`/`@react-three/*` belongs under
  `src/components/room/` and is reached only through the lazy `RoomCanvas` chunk. The budget test fails if
  critical-path JS grows past 160 KB gzipped.
- **The scene contract** (`src/lib/scene-contract.ts`) is the seam between code and art: GLB nodes are named
  `<kind>__<id>[__NN]` (`obj__shelf`, `hit__shelf`, `cam__shelf` + `cam__shelf__target`, `label__shelf`,
  `screen__computer`, `slot__book__01`…). Behavior binds by name. `pnpm scene:check` validates a GLB.
- Room meshes get materials from `createRoomMaterial()` only. Runtime textures use `flipY = false` (glTF UVs).
  Static meshes are lit by baked lightmaps (UV1, `userData.bake` → set); only moving things (globe, ball)
  use realtime lights. Changing art = edit `art/blender/`, re-run `pnpm art`, commit `public/3d` + the manifest.
- Camera framing reads `LAYOUT` (`src/lib/layout.ts`); keep it in sync with the CSS numbers in `globals.css`.
- Screens: the OS/phone DOM is positioned over the projected screen rect after the camera rests (no CSS3D,
  no `<Html transform>`). Their design sizes (640×480, 360×744) must match `SCREEN_DESIGN_WIDTH`.
- Accessibility is a requirement: every object has a tab-ordered button; `/map` and the no-WebGL layout must
  always show all content. Run the e2e suite after changing navigation or panels.
- Never publish: Common App IDs (CAID/CEEB), the CV's "household responsibilities" section, or the raw
  voice notes (`*.m4a` are git-ignored).

## Status

- Phase 1 (this skeleton): done — routes, content, panels, ÖmerOS, phone, blockout room, day/night, pins,
  keyboard + touch, fallbacks, tests.
- Phase 2 (art pass): done — scripted Blender room (~45 props), light-only day bake + lamp/monitor/string
  light masks (RGBM KTX2, two atlases, desktop/mobile tiers), unlit baked shader with day/night blend.
- Phase 3: polish — walk-in intro, loader dissolve, sound ambience, ball physics, inspectables, OG images.
