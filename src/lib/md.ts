const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const SAFE_HREF = /^(\/|https?:\/\/|tel:|mailto:|#)/;

/** Renders inline markdown (`[label](href)`, `**bold**`) to safe HTML. Everything else is escaped. */
export function inlineMd(source: string): string {
  return escapeHtml(source)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label: string, href: string) =>
      SAFE_HREF.test(href) ? `<a href="${href}">${label}</a>` : label,
    );
}

/** Plain text of inline markdown, used for parity checks. */
export function mdToText(source: string): string {
  return source.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');
}
