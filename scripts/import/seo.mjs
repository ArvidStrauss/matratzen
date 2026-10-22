// Extracts the SEO data of a page from its Yoast <head> fragment (kept for the SEO-parity step; pages stay noindex).
import { parse } from 'node-html-parser';

export function parseYoast(html, fallbackTitle) {
  const root = parse(html ?? '');
  const meta = (attr, key) => root.querySelector(`meta[${attr}="${key}"]`)?.getAttribute('content');
  const openGraph = {};
  for (const m of root.querySelectorAll('meta[property^="og:"]')) openGraph[m.getAttribute('property').slice(3)] = m.getAttribute('content');
  let schema;
  const ld = root.querySelector('script.yoast-schema-graph');
  if (ld) schema = JSON.parse(ld.text);
  return {
    title: root.querySelector('title')?.text.trim() || fallbackTitle,
    description: meta('name', 'description'),
    canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href'),
    robots: meta('name', 'robots'),
    openGraph,
    schema,
  };
}
