// SEO parity gate on the built site: for every imported page the heading hierarchy (levels, text, order) and the
// image alt texts of dist/ must equal the WordPress source. Run after `astro build`.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { contentOf } from './import/fetch.mjs';

const clean = (s) => (s ?? '').normalize('NFC').replace(/\u00ad/g, '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const headings = (root) => root.querySelectorAll('h1,h2,h3,h4,h5,h6').map((h) => `${h.tagName.toLowerCase()} ${clean(h.text)}`).filter((h) => h.length > 3);
const alts = (root) => [...new Set(root.querySelectorAll('img').map((i) => clean(i.getAttribute('alt'))).filter(Boolean))].sort();

const failures = [];
let pages = 0;
for (const f of await readdir('src/content/pages')) {
  const page = JSON.parse(await readFile(join('src/content/pages', f), 'utf8'));
  if (!page.source) continue;
  pages++;
  const raw = JSON.parse(await readFile(`reference/raw/pages/${page.source.id}.json`, 'utf8'));
  const source = parse(contentOf(raw));
  const out = parse(await readFile(join('dist', page.path, 'index.html'), 'utf8')).querySelector('main');
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
}

if (failures.length) {
  console.error(`Output parity FAILED:\n${failures.join('\n')}`);
  process.exit(1);
}
console.log(`Output parity OK: headings, image alt texts and in-page anchors of ${pages} imported pages match the source.`);
