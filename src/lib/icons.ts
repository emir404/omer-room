/** App icon colors + glyphs, shared by the canvas idle screens and the DOM screen UIs. */
export const ICONS: Record<string, { color: string; glyph: string }> = {
  studio: { color: "#E2552B", glyph: "A" },
  vc: { color: "#2F6F8F", glyph: "e2" },
  rocket: { color: "#7A4FA0", glyph: "▲" },
  folder: { color: "#D9B26A", glyph: "…" },
  briefcase: { color: "#6B4A33", glyph: "▤" },
  doc: { color: "#EDE6D8", glyph: "≡" },
  money: { color: "#3E8E5A", glyph: "₺" },
  copilot: { color: "#5B6CE0", glyph: "✦" },
  star: { color: "#E2A72B", glyph: "★" },
  mic: { color: "#C8462F", glyph: "●" },
  chart: { color: "#2F6F8F", glyph: "↗" },
  link: { color: "#6E7A86", glyph: "↗" },
  x: { color: "#111111", glyph: "X" },
  instagram: { color: "#D6336C", glyph: "◎" },
  linkedin: { color: "#0A66C2", glyph: "in" },
  youtube: { color: "#E02D2D", glyph: "▶" },
  tiktok: { color: "#111111", glyph: "♪" },
  github: { color: "#24292F", glyph: "<>" },
};

export const iconOf = (name: string) => ICONS[name] ?? ICONS.link!;
