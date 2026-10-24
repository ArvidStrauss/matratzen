// Re-runnable WordPress importer: node scripts/import.mjs [--group=/lattenroste/] [--offline]
// Fetches a URL group via the WP REST API into reference/raw/pages/, converts the rendered WPBakery HTML into blocks
// and writes src/content/pages/*.json + src/content/snippets/*.json. Prints the fallback share per page.
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { INDEX_FILE, contentOf, fetchGroup, loadCached, pathOf } from './import/fetch.mjs';
import { makeLinks, plainText } from './import/html.mjs';
import { createParser } from './import/elements.mjs';
import { createConverter } from './import/blocks.mjs';
import { fixTrashedCanonical, parseYoast } from './import/seo.mjs';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? true]));
const group = args.group ?? '/lattenroste/';
const PAGES_DIR = 'src/content/pages';
const SNIPPETS_DIR = 'src/content/snippets';

const DEFAULTS = { lead: false, ordered: false, tone: 'plain', reverse: false, imageFit: 'cover', headingLevel: 'h2', style: 'primary', open: false, isVideo: false };
const EMPTY_OK = new Set(['bullets', 'outro', 'ctas', 'text', 'images', 'head', 'intro', 'seals']);

/** Drops values the schema fills in by default, so the JSON stays readable. */
function prune(v) {
  if (Array.isArray(v)) return v.map(prune);
  if (v && typeof v === 'object') {
    const out = {};
    for (const [k, x] of Object.entries(v)) {
      if (x === undefined || (k in DEFAULTS && x === DEFAULTS[k]) || (EMPTY_OK.has(k) && Array.isArray(x) && !x.length)) continue;
      out[k] = prune(x);
    }
    return out;
  }
  return v;
}

const json = (v) => JSON.stringify(prune(v), null, 2) + '\n';
const fileName = (path) => (path === '/' ? 'home' : path.replace(/^\/|\/$/g, '').replace(/\//g, '--')) + '.json';

async function readJsonDir(dir) {
  const out = [];
  for (const f of (await readdir(dir).catch(() => [])).filter((f) => f.endsWith('.json'))) out.push({ file: join(dir, f), data: JSON.parse(await readFile(join(dir, f), 'utf8')) });
  return out;
}

// Every source text node must show up in the output (pages + the snippets they use).
const clean = (s) => s.normalize('NFC').replace(/\u00ad/g, '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
function outputText(value, acc = []) {
  if (typeof value === 'string') acc.push(value.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"'));
  else if (Array.isArray(value)) value.forEach((v) => outputText(v, acc));
  else if (value && typeof value === 'object') Object.values(value).forEach((v) => outputText(v, acc));
  return acc;
}
function missingText(root, text) {
  const hay = clean(text);
  const out = [];
  const skip = (n) => n.closest?.('script, style, noscript, .price, .price-detailseite, .offer, .price-del, .price-detailseite-del');
  const visit = (n) => {
    if (n.nodeType === 3) {
      const t = clean(n.text);
      if (t.length >= 3 && !skip(n.parentNode) && !hay.includes(t)) out.push(t);
    } else n.childNodes?.forEach(visit);
  };
  visit(root);
  return out;
}

async function main() {
  const raws = args.offline ? await loadCached(group) : await fetchGroup(group);
  if (!raws.length) throw new Error(`no cached pages for ${group}; run without --offline`);
  const index = JSON.parse(await readFile(INDEX_FILE, 'utf8'));
  const links = makeLinks(index);
  const notes = { dropped: new Set() };
  const parser = createParser({ rewrite: links.rewrite, notes });

  await mkdir(PAGES_DIR, { recursive: true });
  await mkdir(SNIPPETS_DIR, { recursive: true });

  // Snippets of earlier imports stay; this group's page ids are removed first and re-added while converting.
  const groupIds = new Set(raws.map((r) => r.id));
  const byKey = new Map();
  const names = new Set();
  const oldSnippets = await readJsonDir(SNIPPETS_DIR);
  for (const { data } of oldSnippets) {
    const entry = { name: data.name, body: data.body, sources: new Set(data.sources.filter((id) => !groupIds.has(id))), fallbackChars: 0, patterns: new Map(), keep: true };
    byKey.set(JSON.stringify(data.body), entry);
    if (entry.sources.size) names.add(data.name);
  }
  const snippets = {
    byKey,
    uniqueName(base) {
      let name = base;
      for (let n = 2; names.has(name); n++) name = `${base}-${n}`;
      names.add(name);
      return name;
    },
  };
  const converter = createConverter({ rewrite: links.rewrite, parser, snippets });

  for (const { file, data } of await readJsonDir(PAGES_DIR)) if (data.source && pathOf(data.source.link).startsWith(group)) await rm(file);

  const rows = [];
  const canonicalMismatch = [];
  const canonicalFixed = [];
  const pageOutputs = [];
  for (const raw of raws) {
    const root = parse(contentOf(raw));
    const { body, stats } = converter.convert(root, raw.id);
    const path = pathOf(raw.link);
    const title = plainText(parse(`<p>${raw.title.rendered}</p>`));
    const seo = parseYoast(raw.yoast_head, title);
    const trashed = fixTrashedCanonical(seo, raw.link);
    if (trashed) canonicalFixed.push(`${path} (was ${trashed})`);
    const page = { path, title: seo.title, source: { id: raw.id, link: raw.link, modified: raw.modified }, seo, body };
    if (seo.canonical && pathOf(seo.canonical) !== path) canonicalMismatch.push(`${path} -> ${seo.canonical}`);
    await writeFile(join(PAGES_DIR, fileName(path)), json(page), 'utf8');
    pageOutputs.push({ raw, root, body });
    rows.push({ path, ...stats });
  }

  for (const { file, data } of oldSnippets) if (!byKey.get(JSON.stringify(data.body))?.sources.size) await rm(file);
  const written = [];
  for (const entry of byKey.values()) {
    if (!entry.sources.size) continue;
    await writeFile(join(SNIPPETS_DIR, `${entry.name}.json`), json({ name: entry.name, sources: [...entry.sources].sort((a, b) => a - b), body: entry.body }), 'utf8');
    written.push(entry);
  }

  // Report
  const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) : '0.0').padStart(5) + ' %';
  console.log(`\nImported ${rows.length} pages below ${group}, ${written.length} shared snippets.\n`);
  console.log('page'.padEnd(78), 'text chars'.padStart(10), 'fallback'.padStart(9), 'share'.padStart(8), ' reasons');
  let total = 0;
  let fb = 0;
  for (const r of rows) {
    total += r.totalChars;
    fb += r.fallbackChars;
    console.log(r.path.padEnd(78), String(r.totalChars).padStart(10), String(r.fallbackChars).padStart(9), pct(r.fallbackChars, r.totalChars).padStart(8), ' ', [...r.reasons].map(([k, v]) => `${k} x${v}`).join(', '));
  }
  console.log('-'.repeat(120));
  console.log('TOTAL'.padEnd(78), String(total).padStart(10), String(fb).padStart(9), pct(fb, total).padStart(8));

  const patterns = new Map();
  for (const r of rows) for (const [k, v] of r.patterns) patterns.set(k, (patterns.get(k) ?? 0) + v);
  console.log('\nPatterns (block count across pages):', [...patterns].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', '));
  console.log('Snippets:', written.map((s) => `${s.name} (${s.sources.size} pages)`).join(', ') || '-');
  console.log('Inline formatting dropped:', [...notes.dropped].join(', ') || '-');
  if (canonicalFixed.length) console.log(`Yoast canonical of a trashed parent page replaced by the page URL (${canonicalFixed.length}):\n  ${canonicalFixed.join('\n  ')}`);
  if (canonicalMismatch.length) console.log(`Yoast canonical differs from the page URL (${canonicalMismatch.length}):\n  ${canonicalMismatch.join('\n  ')}`);
  const dropped = rows.flatMap((r) => r.dropped.map((d) => `${r.path}: <${d}>`));
  if (dropped.length) console.log('Dropped fallback elements:', dropped.join('; '));

  console.log(`\nLinks: ${links.stats.internal} internal (site-relative), ${links.stats.files} uploads kept on the live host, ${links.stats.external} external.`);
  if (links.stats.resolvedBySlug.length) console.log(`Resolved bare slugs like WordPress (${new Set(links.stats.resolvedBySlug).size}):\n  ${[...new Set(links.stats.resolvedBySlug)].join('\n  ')}`);
  if (links.stats.unknown.size) console.log(`Internal links to paths missing in the WordPress page index (${links.stats.unknown.size}):\n  ${[...links.stats.unknown].join('\n  ')}`);

  const snippetText = (names) => written.filter((s) => names.has(s.name));
  let missing = 0;
  let genericChars = 0;
  for (const { raw, root, body } of pageOutputs) {
    const used = new Set(JSON.stringify(body).match(/"snippet":"([^"]+)"/g)?.map((m) => m.slice(11, -1)));
    const nested = snippetText(used).flatMap((s) => JSON.stringify(s.body).match(/"snippet":"([^"]+)"/g) ?? []);
    const all = new Set([...used, ...nested.map((m) => m.slice(11, -1))]);
    const blocks = [...body, ...snippetText(all).flatMap((s) => s.body)];
    genericChars += outputText(blocks.filter((b) => b.component === 'content')).join('').length;
    const lost = missingText(root, outputText(blocks).join('\n'));
    missing += lost.length;
    if (lost.length) console.log(`\nSource text missing in output (${pathOf(raw.link)}): ${lost.slice(0, 8).map((t) => `"${t.slice(0, 60)}"`).join(', ')}${lost.length > 8 ? ` ... +${lost.length - 8}` : ''}`);
  }
  console.log(`\nGeneric text flow (content blocks, structured but no dedicated template): ~${pct(genericChars, total).trim()} of the text.`);
  console.log(`Completeness: ${missing} source text nodes missing in the output.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
