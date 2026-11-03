# Ömer's Room

Ömer Öztok's personal site: one interactive 3D room. Every object opens a chapter (bookshelf → academics,
via four labeled binders + real books, computer → work, phone → socials & side projects, window → Kozan,
framed letter → the OpenAI story, globe → places, mailbox → contact, ball → easter egg). The only UI on the
page is a 3D/Text switch; `/text` is the whole site on one page. Next.js App Router + React Three Fiber;
content lives in plain files under `content/`.

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
pnpm covers           # real book covers from Open Library (books with an `isbn`)
pnpm art              # Blender art pipeline: sources → views → textures → room → bake → export → assets
pnpm art preview -- day room 128   # Cycles renders from the site's cameras → art/previews/
pnpm assets           # art/out → public/3d (meshopt GLB + KTX2 lightmaps) + src/lib/assets.manifest.json
pnpm blockout         # regenerate public/3d/blockout.glb (the Phase 1 stand-in, not loaded by the site)
```

Append `?test=1` to any URL for deterministic rendering (DPR 1, no animations, frozen clock),
`?time=day|night` to force lighting, `?text=1` for the text layout (or just open `/text`).

## Map

- `content/` — all words, numbers and image references (validated by `src/lib/content/schemas.ts`).
- `public/content/<chapter>/` — photos and screenshots referenced from content.
- `src/app/(room)/` — the room layout (persistent 3D canvas + the text view for no-WebGL) + one route per
  chapter; pages are server components that render chapter content. `src/app/(text)/text` — the text
  version (no 3D bundle); `/map` redirects there.
- `src/components/room/` — everything 3D: `RoomCanvas` (lazy chunk), `Room` (GLB binding + pointer),
  `CameraRig` (route → camera), `Projector` (pins/hover label), `ScreenProjector` (maps the live screen UIs
  onto the monitor/phone), `LiveTextures` (screen cut-outs, window view, ticker, letter), `objects/*`.
- `src/components/panels/` — `PanelHost` (right-hand sheet / bottom sheet) + the UI blocks (`ui.tsx`).
- `src/components/screens/` — the live screens: `ScreenLayer` (DOM behind the canvas, docks when the
  camera arrives), `OmerOS` (the desktop: a "Work" app window), `PhoneUI` (contact card + apps).
- `src/components/text/TextView` — the whole site on one page (grouped rows that open to the story).
- `src/components/kit/` — the vendored stageshow kit (MIT): tokens, `Window`, `Phone`, `Row`, `Avatar`.
  `src/components/ui/Row` is a server-safe copy of its Row. UI follows `.agents/skills/stageshow`.
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
- Screens are live DOM, always: `ScreenLayer` sits *behind* the canvas, the screen meshes are drawn as
  holes (alpha 0, depth-tested, so things in front still cover them), and `ScreenProjector` maps each UI
  onto its screen with a CSS homography; once the camera rests on it, it docks (pixel-aligned box + CSS
  zoom, clicks pass through the canvas). Design sizes: desktop 16:10 sized to the docked rect (960–1440
  wide), phone 402×874 pt. Keep the screen meshes' aspect in `art/blender/layout.py` in sync.
- UI: one family (Geist), one accent (`--ss-accent`), the kit's greys and shadows, real brand marks only
  (`public/brands`), no invented logos or glyph-in-a-square icons. Hover labels are small dark pills.
- Accessibility is a requirement: every object has a tab-ordered button; `/map` and the no-WebGL layout must
  always show all content. Run the e2e suite after changing navigation or panels.
- Never publish: Common App IDs (CAID/CEEB), the CV's "household responsibilities" section, or the raw
  voice notes (`*.m4a` are git-ignored).

## Status

- Phase 1 (this skeleton): done — routes, content, panels, ÖmerOS, phone, blockout room, day/night, pins,
  keyboard + touch, fallbacks, tests.
- Phase 2 (art pass): done — scripted Blender room (~45 props), light-only day bake + lamp/monitor/string
  light masks (RGBM KTX2, two atlases, desktop/mobile tiers), unlit baked shader with day/night blend.
- Phase 2.5 (feedback round): done — live desktop + phone UIs on the screens (stageshow kit), slim 16:10
  monitor, iPhone-shaped phone, photo view out of the window (parallax, night grade), Natural Earth
  globe (varnish, pins, drag to spin), labeled chapter binders + real book covers, letter shown 1:1,
  3D/Text switch as the only UI, `/text` rebuilt as grouped rows. The phone is clickable again (the
  smallest click proxy wins).
- Phase 3: polish — walk-in intro, loader dissolve, sound ambience, ball physics, inspectables, OG images.
