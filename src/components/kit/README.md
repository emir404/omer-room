# Stageshow kit (vendored)

A trimmed copy of the stageshow kit (`.agents/skills/stageshow/kit`, MIT, see `LICENSE`): the parts the
site uses as real UI rather than illustration.

- `tokens.css` — the kit's tokens on `:root` (lifted from its `stage.css`; the site's own look overrides
  them in `src/app/globals.css`).
- `window.tsx` — macOS window chrome (the desktop's "Work" app). `phone.tsx` — iPhone screen geometry,
  status bar, island; patched with a `home` prop so a `bare` screen keeps its home indicator.
- `parts/Row`, `parts/Avatar`, `parts/Icon`, `controls/Segmented`, `controls/Badge` — small parts.

Kept as upstream wrote it (lint skips this folder). For server components use `src/components/ui/Row`,
the same markup without the kit's client context.
