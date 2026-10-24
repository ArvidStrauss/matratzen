// SEO parity gate on the built site: for every imported page the <head> (title, meta, canonical, JSON-LD), the heading
// hierarchy (levels, text, order) and the image alt texts of dist/ must equal the WordPress source. Run after `astro build`.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { contentOf } from './import/fetch.mjs';

const clean = (s) => (s ?? '').normalize('NFC').replace(/\u00ad/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const headings = (root) => root.querySelectorAll('h1,h2,h3,h4,h5,h6').map((h) => `${h.tagName.toLowerCase()} ${clean(h.text)}`).filter((h) => h.length > 3);
const alts = (root) => [...new Set(root.querySelectorAll('img').map((i) => clean(i.getAttribute('alt'))).filter(Boolean))].sort();

// SEO head as a flat map: title, canonical, every meta name/property, JSON-LD (parsed).
function head(root) {
  const out = { title: clean(root.querySelector('title')?.text), canonical: root.querySelector('link[rel="canonical"]')?.getAttribute('href') };
  for (const m of root.querySelectorAll('meta[name], meta[property]')) out[`meta ${m.getAttribute('property') ?? m.getAttribute('name')}`] = clean(m.getAttribute('content'));
  const ld = root.querySelector('script[type="application/ld+json"]');
  if (ld) out.jsonLd = JSON.stringify(JSON.parse(ld.text));
  delete out['meta viewport'];
  return out;
}
const indexable = process.env.INDEXABLE === 'true';

const htmlFiles = (await readdir('dist', { recursive: true })).map((f) => f.replace(/\\/g, '/')).filter((f) => f.endsWith('.html'));
const built = new Set(htmlFiles.filter((f) => f.endsWith('index.html')).map((f) => `/${f.slice(0, -'index.html'.length)}`));
const wpPages = new Set(JSON.parse(await readFile('reference/raw/page-index.json', 'utf8')).map((p) => new URL(p.link).pathname));
const notYetImported = new Map();

const failures = [];
let pages = 0;
for (const f of await readdir('src/content/pages')) {
  const page = JSON.parse(await readFile(join('src/content/pages', f), 'utf8'));
  if (!page.source) continue;
  pages++;
  const raw = JSON.parse(await readFile(`reference/raw/pages/${page.source.id}.json`, 'utf8'));
  const source = parse(contentOf(raw));
  const html = parse(await readFile(join('dist', page.path, 'index.html'), 'utf8'));
  const out = html.querySelector('main');

  // Head = Yoast head, except: robots stays noindex until the production build; trashed-parent canonicals are fixed.
  let yoast = raw.yoast_head ?? '';
  const yoastCanonical = parse(yoast).querySelector('link[rel="canonical"]')?.getAttribute('href');
  if (yoastCanonical?.includes('__trashed/')) yoast = yoast.replaceAll(yoastCanonical, raw.link);
  const [sHead, oHead] = [head(parse(yoast)), head(html.querySelector('head'))];
  if (!indexable) sHead['meta robots'] = 'noindex, nofollow';
  for (const key of new Set([...Object.keys(sHead), ...Object.keys(oHead)])) {
    if (sHead[key] !== oHead[key]) failures.push(`${page.path} head ${key}: source "${String(sHead[key]).slice(0, 120)}", output "${String(oHead[key]).slice(0, 120)}"`);
  }

  const [sh, oh] = [headings(source), headings(out)];
  if (sh.join('\n') !== oh.join('\n')) {
    const missing = sh.filter((h) => !oh.includes(h));
    const extra = oh.filter((h) => !sh.includes(h));
    failures.push(`${page.path} headings differ (source ${sh.length}, output ${oh.length}); missing: ${missing.join(' | ') || '-'}; extra: ${extra.join(' | ') || '-'}`);
  }
  if (oh.filter((h) => h.startsWith('h1 ')).length !== 1) failures.push(`${page.path} must have exactly one h1`);
  const [sa, oa] = [alts(source), alts(out)];
  const lostAlts = sa.filter((a) => !oa.includes(a));
  if (lostAlts.length) failures.push(`${page.path} image alt texts missing in output: ${lostAlts.slice(0, 5).join(' | ')}`);
  const anchors = new Set(out.querySelectorAll('[id]').map((n) => n.getAttribute('id')));
  const dead = out.querySelectorAll('a[href^="#"]').map((a) => a.getAttribute('href').slice(1)).filter((id) => id && !anchors.has(id));
  if (dead.length) failures.push(`${page.path} in-page links without target: #${[...new Set(dead)].join(', #')}`);

  // Internal links must hit a built page; a WordPress page that is not imported yet is reported, anything else fails.
  for (const a of out.querySelectorAll('a[href^="/"]')) {
    const target = a.getAttribute('href').split('#')[0];
    if (built.has(target)) continue;
    if (wpPages.has(target)) (notYetImported.get(target) ?? notYetImported.set(target, new Set()).get(target)).add(page.path);
    else failures.push(`${page.path} links to ${target}, which is neither built nor a WordPress page`);
  }
}

// Every built page (incl. hand-written pages and variants) stays out of the index until the production build.
if (!indexable) {
  for (const f of htmlFiles) {
    const robots = parse(await readFile(join('dist', f), 'utf8')).querySelector('meta[name="robots"]')?.getAttribute('content');
    if (!robots?.startsWith('noindex')) failures.push(`dist/${f} must be noindex (robots: ${robots ?? 'missing'})`);
  }
}

if (failures.length) {
  console.error(`Output parity FAILED:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Output parity OK: SEO head, headings, image alt texts, in-page anchors and internal links of ${pages} imported pages match the source.`);
if (notYetImported.size) {
  console.log(`Internal links to WordPress pages not imported yet (${notYetImported.size}; 404 on the preview until imported):`);
  for (const [target, from] of [...notYetImported].sort((a, b) => b[1].size - a[1].size)) console.log(`  ${target} (from ${from.size} page${from.size > 1 ? 's' : ''})`);
}
