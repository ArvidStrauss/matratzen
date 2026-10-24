// Extracts the SEO data of a page from its Yoast <head> fragment. Rendered by src/layouts/Layout.astro.
import { parse } from 'node-html-parser';

export function parseYoast(html, fallbackTitle) {
  const root = parse(html ?? '');
  const meta = {};
  for (const m of root.querySelectorAll('meta[property], meta[name^="twitter:"]')) {
    meta[m.getAttribute('property') ?? m.getAttribute('name')] = m.getAttribute('content');
  }
  let schema;
  const ld = root.querySelector('script.yoast-schema-graph');
  if (ld) schema = JSON.parse(ld.text);
  return {
    title: root.querySelector('title')?.text.trim() || fallbackTitle,
    description: root.querySelector('meta[name="description"]')?.getAttribute('content'),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    robots: root.querySelector('meta[name="robots"]')?.getAttribute('content'),
    meta,
    schema,
  };
}

// Yoast keeps the URL of a trashed parent page (`/produkte__trashed/…`, a 404) in canonical, og:url and JSON-LD of some
// pages. Replace it everywhere with the real page URL (docs/requirements-questions.md Q7). Returns the original URL or undefined.
export function fixTrashedCanonical(seo, pageUrl) {
  const from = seo.canonical;
  if (!from || from === pageUrl || !/__trashed\//.test(new URL(from).pathname)) return undefined;
  Object.assign(seo, JSON.parse(JSON.stringify(seo).replaceAll(from, pageUrl)));
  return from;
}
