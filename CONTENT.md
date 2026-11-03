# Editing the room

Everything visitors read lives in `content/`. Edit the files, save, refresh `pnpm dev` — no code changes.
If something is wrong (a typo in a field name, a missing image), `pnpm content:check` tells you the exact
file and field. It also lists every `TODO` placeholder that's still waiting for real text.

Placeholders start with `TODO` and show up **highlighted in yellow** on the site, so nothing half-finished
slips through. Replace them, or delete the line if a field is optional.

## What controls what

| You want to change… | Edit |
|---|---|
| Name, tagline, the "now" line, email, cal.com link, socials | `content/site.json` |
| Hover labels ("the academic bit", "you might know me from this"…) | `content/objects.json` |
| The bookshelf intro and the four shelf titles | `content/shelf.json` |
| Shelf items (clubs, nonprofit, research, olympiad, MUN) | `content/shelf/*.md` — one file each |
| Books on the shelf + your notes | `content/books/*.md` — one file per book |
| Computer folders (Arc Studio, e2vc, NextGen…) | `content/computer/*.md` — one file per folder |
| Phone apps (Bana Paradan Bahset, Copilot…) | `content/phone/*.md` — socials come from `site.json` |
| Globe pins | `content/globe/*.md` — one file per place (`lat`/`lng` place the pin) |
| The window (Kozan, the farm, solar) | `content/window.md` |
| The framed letter | `content/letter.md` |
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

- **A book:** copy `content/books/placeholder-1.md` to `content/books/<book-slug>.md`. Fields: `title`
  (≤ 60 chars, it's printed on the spine), `author`, `order`, `takeaway` (one line), optional
  `readIn`, optional `spine.color` (hex like `#2F4A3A`), optional `slot` (1–12, pins it to a spine).
  The shelf has 12 spines; extra books still appear in the panel list.
- **A place:** copy `content/globe/istanbul.md`. Find `lat`/`lng` on any map (right-click → coordinates).
- **A computer folder or phone app:** copy an existing file; `icon` picks the pixel icon
  (computer: `studio`, `vc`, `rocket`, `folder`, `briefcase`, `doc`; phone: `money`, `copilot`, `star`,
  `mic`, `chart`, `link`).
- **Photos:** put them in `public/content/<chapter>/` (e.g. `public/content/window/kozan-1.jpg`) and list
  them under `images` / `photos` with an `alt` text. JPG or WebP, ~2000 px on the long side is plenty
  (the site resizes them). MUN photos go on `content/shelf/mundp.md`; they also appear in the photo
  frames on the shelf and on the rotating ring.
- **The letter:** save it as `public/content/letter/letter.jpg` and set
  `letter: { src: /content/letter/letter.jpg, alt: "…" }` in `content/letter.md`; it's then drawn inside
  the frame on the wall too.

## Still to fill (`pnpm content:check` keeps this list current)

Books + notes · places + insights + photos · MUN photos · farm/childhood photos · check the three Kozan
facts in `window.md` · the OpenAI letter, its context and reaction screenshots · social handles, email,
cal.com link · Copilot details · older startups/internships · Arc Studio / e2vc / NextGen screenshots ·
Bana Paradan Bahset growth screenshots · the last part of the "now" line.

## Please don't publish

Common App IDs (CAID/CEEB), anything from the CV's "household responsibilities" section, or other
application-only material.
