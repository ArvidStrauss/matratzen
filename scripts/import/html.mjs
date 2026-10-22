// Inline HTML -> `[label](href)` / `**bold**` text, link rewriting and image URLs.
import { BASE, pathOf } from './fetch.mjs';

// Collapse source whitespace but keep non-breaking spaces and soft hyphens (verbatim text).
export const squash = (s) => s.replace(/[ \t\r\n\f]+/g, ' ');
const abs = (u) => (u.startsWith('//') ? 'https:' + u : u.startsWith('/') ? BASE + u : u);

const HOSTS = new Set(['gesunde-matratzen.de', 'www.gesunde-matratzen.de']);

/** Rewrites https://gesunde-matratzen.de/... to site-relative paths with a trailing slash; collects link statistics. */
export function makeLinks(index) {
  const known = new Set(index.map((p) => pathOf(p.link)));
  const bySlug = new Map();
  for (const p of known) {
    const slug = p.split('/').filter(Boolean).at(-1);
    if (slug) bySlug.set(slug, [...(bySlug.get(slug) ?? []), p]);
  }
  const stats = { internal: 0, files: 0, external: 0, resolvedBySlug: [], unknown: new Set() };

  function rewrite(raw) {
    const value = (raw ?? '').trim();
    if (!value) return undefined;
    if (/^(#|tel:|mailto:)/.test(value)) return value;
    let url;
    try {
      url = new URL(value, BASE);
    } catch {
      return undefined;
    }
    if (!/^https?:$/.test(url.protocol)) return undefined;
    if (!HOSTS.has(url.host)) {
      stats.external++;
      return url.href;
    }
    // Uploaded files (PDFs, images) stay on the live host until the media migration.
    if (url.pathname.startsWith('/wp-content/') || /\.[a-z0-9]{2,5}$/i.test(url.pathname)) {
      stats.files++;
      return BASE + url.pathname + url.search + url.hash;
    }
    let path = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
    if (!known.has(path)) {
      // WordPress redirects bare slugs to the page with that slug; resolve it the same way.
      const slug = path.split('/').filter(Boolean).at(-1);
      const candidates = bySlug.get(slug) ?? [];
      if (candidates.length === 1) {
        stats.resolvedBySlug.push(`${path} -> ${candidates[0]}`);
        path = candidates[0];
      } else {
        stats.unknown.add(path);
      }
    }
    stats.internal++;
    return path + url.search + url.hash;
  }
  return { rewrite, stats };
}

/** Real image URL of an <img> (the live site lazy-loads through data-* attributes). */
export function imgSrc(el) {
  for (const name of ['data-orig-src', 'data-lazy-src', 'data-src', 'src']) {
    const v = el.getAttribute(name);
    if (v && !v.startsWith('data:')) return abs(v.trim());
  }
  return undefined;
}

/**
 * Inline conversion of a node's children. Returns paragraphs split at <br>.
 * Only links and bold survive; other inline formatting is dropped (counted in `notes`).
 */
export function inlineParagraphs(node, rewrite, notes) {
  const paras = [''];
  const push = (s) => (paras[paras.length - 1] += s);

  const walk = (n) => {
    if (n.nodeType === 3) return push(squash(n.text));
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === 'br') return paras.push('');
    if (['script', 'style', 'noscript', 'img', 'svg'].includes(tag)) return;
    if (tag === 'a') {
      const href = rewrite(n.getAttribute('href'));
      const inner = inlineParagraphs(n, rewrite, notes).join(' ').trim();
      if (!inner) return;
      return push(href ? `[${inner}](${href})` : inner);
    }
    if (tag === 'strong' || tag === 'b') {
      const inner = inlineParagraphs(n, rewrite, notes).join(' ');
      return push(inner.trim() ? `${inner.match(/^\s*/)[0]}**${inner.trim()}**${inner.match(/\s*$/)[0]}` : inner);
    }
    if (tag === 'em' || tag === 'i') {
      if (n.classList.contains('fa') || !n.text.trim()) return;
      notes.dropped.add('em/i');
    }
    n.childNodes.forEach(walk);
  };
  node.childNodes.forEach(walk);
  return paras.map((p) => p.replace(/ +/g, ' ').trim()).filter(Boolean);
}

/** Plain text (no markup) of a node, whitespace-collapsed. */
export const plainText = (node) => squash(node.text).trim();
