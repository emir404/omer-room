# Editing the room

Everything visitors read lives in `content/`. Edit the files, save, refresh `pnpm dev` — no code changes.
If something is wrong (a typo in a field name, a missing image), `pnpm content:check` tells you the exact
file and field. It also lists every `TODO` placeholder that's still waiting for real text.

Placeholders start with `TODO` and show up on the site as **amber "To add" notes**, so nothing
half-finished slips through. Replace them, or delete the line if a field is optional.

The site has two views of the same content, switched by the one control in the top-left corner:
the 3D room, and the text version (`/text`: everything on one page, one row per item).

## What controls what

| You want to change… | Edit |
|---|---|
| Name, tagline, the "now" line (the LED ticker on the desk), email, cal.com link, socials | `content/site.json` |
| Hover labels ("the academic bit", "you might know me from this"…) | `content/objects.json` |
| The four binders on the shelf (the word on each spine, its title and blurb) | `content/shelf.json` |
| What's in a binder (clubs, nonprofit, research, olympiad, MUN) | `content/shelf/*.md` — one file each |
| Books on the shelf + your notes (with their real covers) | `content/books/*.md` — one file per book |
| The computer: the "Work" app on the desktop (Arc Studio, e2vc, NextGen…) | `content/computer/*.md` — one file per role |
| The phone: your contact card + side quests (Bana Paradan Bahset, Copilot…) | `content/phone/*.md` — socials come from `site.json` |
| Globe pins | `content/globe/*.md` — one file per place (`lat`/`lng` place the pin) |
| The window (Kozan, the farm, solar) and the view out of it | `content/window.md` |
| The framed letter (the image is shown exactly as it is) | `content/letter.md` |
| The mailbox panel | `content/contact.md` |
| What the basketball says when you score | `content/site.json` → `hoop` |

The file name becomes the URL: `content/computer/arc-studio.md` → `/computer/arc-studio`.

## Markdown files

Each `.md` file has settings at the top (between the `---` lines) and the story below:

```md
---
title: Arc Studio
role: Co-Founder & CEO
period: Grades 11–12
order: 1                 # lower comes first
summary: One sentence that sells it.
metrics:
  - value: $40K+/mo
    label: revenue run-rate
images:
  - src: /content/computer/arc-dashboard.jpg
    alt: What's in the picture (for screen readers)
    caption: Optional caption
links:
  - label: witharc.co
    url: https://witharc.co
---

The story goes here. **Markdown** works: paragraphs, lists, links, `## headings`.
```

Set `draft: true` to hide something without deleting it. Files starting with `_` are ignored.

## Adding things

- **A book:** copy `content/books/zero-to-one.md` to `content/books/<book-slug>.md`. Fields: `title`
  (≤ 60 chars, it's printed on the spine), `author`, `order`, `takeaway` (one line), optional `isbn`,
  `readIn`, `spine.color` (hex like `#2F4A3A`), `slot` (1–12, pins it to a spine), `featured: true`.
  **Real covers:** add the `isbn` and run `pnpm covers` (it downloads the cover from Open Library to
  `public/content/books/<book-slug>.jpg`), or drop a JPG there yourself. A cover also colors the book's
  spine. The first `featured` book stands face-out on the shelf with its cover showing; the rest fill
  the 12 spines (extra books still appear in the Books list).
- **A binder's contents:** an item in `content/shelf/*.md` with `shelf: school | olympiad | mun` shows up
  in that binder (`/shelf/school`, …). The four binders and their spine labels are in `content/shelf.json`.
- **A place:** copy `content/globe/istanbul.md`. Find `lat`/`lng` on any map (right-click → coordinates).
- **A role on the computer or an app on the phone:** copy an existing file. The computer's sidebar lists
  every file in `content/computer/` in `order`; the first metric is the big number. Phone apps open as
  pages on the phone. (`icon` is still required by the schema but no longer drawn.)
- **Photos:** put them in `public/content/<chapter>/` (e.g. `public/content/window/kozan-1.jpg`) and list
  them under `images` / `photos` with an `alt` text. JPG or WebP, ~2000 px on the long side is plenty
  (the site resizes them). MUN photos go on `content/shelf/mundp.md`; they also fill the three photo
  frames on the shelf.
- **The letter:** save it as `public/content/letter/letter.png` (or .jpg) and set
  `letter: { src: /content/letter/letter.png, alt: "…" }` in `content/letter.md`. The chapter shows the
  original file, untouched and full resolution (with an "Open full size" link); the frame on the wall
  shows it too. Run `pnpm art` once afterwards so the frame is rebuilt to the letter's exact
  proportions (until then it's fitted inside the frame, never stretched).
- **Your own view out of the window:** a landscape photo from the farm works best. Save it as
  `public/content/window/view.jpg` and add to `content/window.md`:
  `view: { src: /content/window/view.jpg, fov: 70, horizon: 0.5 }` — `fov` is the photo's horizontal
  field of view (a phone's main camera ≈ 70°, ultra-wide ≈ 105°), `horizon` where the horizon sits from
  the top (0) to the bottom (1). Without it, the window shows a CC0 orchard photo.

## Still to fill (`pnpm content:check` keeps this list current)

Books + notes · places + insights + photos · MUN photos · farm/childhood photos · check the three Kozan
facts in `window.md` · the OpenAI letter, its context and reaction screenshots · social handles, email,
cal.com link · Copilot details · older startups/internships · Arc Studio / e2vc / NextGen screenshots ·
Bana Paradan Bahset growth screenshots · the last part of the "now" line.

## Please don't publish

Common App IDs (CAID/CEEB), anything from the CV's "household responsibilities" section, or other
application-only material.
