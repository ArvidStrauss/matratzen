// Sanitiser for the fallback rich-text block: keeps a small allow-list of tags and attributes, nothing else.
import { imgSrc, squash } from './html.mjs';

const ALLOWED = new Set(['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'a', 'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'img', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'blockquote', 'hr', 'details', 'summary', 'figure', 'figcaption']);
// Dropped together with their content. Anything lost here is counted in the import report.
const DROPPED = new Set(['script', 'style', 'noscript', 'iframe', 'object', 'embed', 'form', 'video', 'audio', 'svg', 'button', 'input', 'select', 'textarea']);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function sanitize(nodes, rewrite, report) {
  const walk = (n) => {
    if (n.nodeType === 3) return esc(squash(n.text));
    if (n.nodeType !== 1) return '';
    const tag = n.tagName.toLowerCase();
    if (DROPPED.has(tag)) {
      if (tag !== 'script' && tag !== 'style' && tag !== 'noscript') report.dropped.push(tag);
      return '';
    }
    const inner = n.childNodes.map(walk).join('');
    if (!ALLOWED.has(tag)) return inner;
    if (tag === 'br' || tag === 'hr') return `<${tag}>`;
    if (tag === 'img') {
      const src = imgSrc(n);
      return src ? `<img src="${esc(src)}" alt="${esc(n.getAttribute('alt') ?? '')}" loading="lazy">` : '';
    }
    if (tag === 'a') {
      const href = rewrite(n.getAttribute('href'));
      const name = n.getAttribute('name') || n.getAttribute('id');
      if (!href && !name) return inner;
      return `<a${href ? ` href="${esc(href)}"` : ''}${name ? ` id="${esc(name)}"` : ''}>${inner}</a>`;
    }
    return `<${tag}>${inner}</${tag}>`;
  };
  return nodes.map(walk).join('').trim();
}
