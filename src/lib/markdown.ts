import { Marked } from "marked";

const escapeAttr = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");

const md = new Marked({ gfm: true, async: false });

md.use({
  renderer: {
    link({ href, title, tokens }) {
      const text = this.parser.parseInline(tokens);
      const external = /^https?:\/\//.test(href);
      const titleAttr = title ? ` title="${escapeAttr(title)}"` : "";
      const externalAttrs = external ? ' target="_blank" rel="noopener noreferrer"' : "";
      return `<a href="${escapeAttr(href)}"${titleAttr}${externalAttrs}>${text}</a>`;
    },
  },
});

/** Markdown → HTML for content bodies. Content is first-party, so no sanitizer is needed. */
export function renderMarkdown(source: string): string {
  const html = md.parse(source.trim()) as string;
  // Make placeholders impossible to miss on the preview.
  return html.replace(/TODO\(Ömer\)/g, '<mark class="todo">TODO(Ömer)</mark>');
}
