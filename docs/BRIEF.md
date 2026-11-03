# Brief (consolidated)

> **Update (feedback round, Nov 2026):** no pixel art. The window shows a realistic view (a photo), the
> computer and phone run real, live UIs on their screens, the shelf's chapters are labeled binders with
> real book covers next to them, the letter is shown exactly as the image, and the only UI on the page
> is a 3D/Text switch. Where this brief says "pixel", read "real".

Sources: Ömer's written brief, his two voice notes (TR/EN), his CV (Common App activities), and Emir's
direction. This is the reference for what the site must do.

## Concept

A single interactive room. The visitor walks in and clicks objects; each object opens a chapter about Ömer.
Playful, self-aware surface; serious, evidence-heavy content underneath (real photos, screenshots, numbers).
Desktop first, but every object must be tappable on mobile. Audience: US admissions readers (Fall 2027) and
founders/investors.

**Look (decided with Emir):** basement.studio-level 3D — a hi-fi stylized room with soft baked lighting.
Pixel art lives in the screens: the computer OS, the phone UI, and the farm seen through the window.

## Objects

- **Bookshelf — academia.** Shelves of clickable spines: school work & projects, the National Olympiad,
  MUN and similar; a separate shelf of real books with Ömer's notes and takeaways.
- **Computer — professional work.** Slightly pixelated screen; clicking zooms in to a usable desktop
  ("ÖmerOS") with folders/windows: Arc Studio, e2vc, NextGen, other roles — each with a short story, key
  numbers, photos/screenshots.
- **Phone — social & side projects.** Home screen with app icons. Socials link out (X, Instagram,
  LinkedIn…). Project apps open a page: Bana Paradan Bahset / Talk to Me About Money (the economics
  brand + its growth, plus finance & investing interests and a way to reach him about money), Copilot.
- **Window — hometown.** A pixelated Kozan farm (greenery, animals). Clicking opens Kozan facts and an
  "I grew up on a farm" story with childhood photos. (Ties in the solar project on family farms.)
- **Globe (voice note 2).** Pins on places he's been; clicking shows insights and photos.
- **Basketball + hoop.** Click → bounce + sound. Easter egg if it goes in.
- **Framed letter — the viral OpenAI rejection.** A proper frame, slightly crooked. Hover: "you might know
  me from this". Click: the full letter, context, screenshots of the reaction.
- **Mailbox / door — contact.** Email, LinkedIn, booking link.

## Must-haves

Fast load · hover labels on every object · a text-only fallback/site map · an easy way for Ömer to update
content without touching code (→ plain files in `content/`, edited with Claude).

## Nice-to-haves

Day/night from the visitor's clock · subtle ambient sound toggle · a small "now" status line in the room.

## Reconciliations

- "Orc Studio" in the written brief = **Arc Studio** (CV, witharc.co).
- "Bana Paradan Bahset" and "Talk to me about money" = one brand → one phone app.

## Process

"Build the general skeleton, send me the repo, I'll edit it myself with Claude." Phase 1 is that skeleton;
the Blender art pass and polish follow (see `CLAUDE.md` → Status).
