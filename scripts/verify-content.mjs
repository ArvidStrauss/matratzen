// Content parity gate: every text and price in src/content must exist verbatim in the captured source HTML.
// Hand-written prototype content is checked against reference/raw/*.html; imported pages (with `source`) and their
// snippets are checked against the WordPress content of their own source page (reference/raw/pages/<id>.json).
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { contentOf } from './import/fetch.mjs';
import { fixTrashedCanonical, parseYoast } from './import/seo.mjs';

const clean = (s) => (s ?? '').normalize('NFC').replace(/\u00ad/g, '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
const mdToText = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

// Structural keys: identifiers, URLs and layout options, not visible copy.
const SKIP_KEYS = new Set(['href', 'src', 'video', 'poster', 'mapsHref', 'component', 'path', 'imageFit', 'tone', 'headingLevel', 'prefix', 'products', 'branches', 'branch', 'order', 'reverse', 'isVideo', 'tour360', 'type', 'level', 'ordered', 'lead', 'open', 'id', 'style', 'titleTag', 'snippet', 'reason', 'rating', 'visibility', 'start']);
const PRICE_KEYS = new Set(['price', 'priceFrom', 'priceRegular', 'from', 'regular']);

function textOf(html, brAsSpace = true) {
  const doc = parse(brAsSpace ? html.replace(/<br\s*\/?>/gi, ' ') : html);
  doc.querySelectorAll('script, style, noscript').forEach((n) => n.remove());
  const parts = [clean(doc.text)];
  doc.querySelectorAll('[alt]').forEach((n) => parts.push(clean(n.getAttribute('alt'))));
  return parts.join('\n');
}

async function corpus() {
  const parts = [];
  for (const f of (await readdir('reference/raw')).filter((f) => f.endsWith('.html'))) parts.push(textOf(await readFile(join('reference/raw', f), 'utf8'), false));
  return parts.join('\n');
}

const pageSources = new Map();
async function pageSource(id) {
  if (!pageSources.has(id)) {
    const raw = JSON.parse(await readFile(join('reference/raw/pages', `${id}.json`), 'utf8'));
    pageSources.set(id, { raw, text: textOf(contentOf(raw)) });
  }
  return pageSources.get(id);
}

function priceCandidates(n) {
  const de = (v, d) => v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d });
  const int = de(n, 0);
  const plain = String(Math.trunc(n));
  return [de(n, 2), `${plain},00`, `${int},-`, `${plain},-`, `${int} €`, `${plain} €`, `${int},- €`];
}

function* walk(value, path = []) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) yield* walk(value[i], [...path, i]);
  } else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (SKIP_KEYS.has(k) || k.endsWith('Href')) continue;
      yield* walk(v, [...path, k]);
    }
  } else {
    yield { path, value };
  }
}

async function contentFiles(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await contentFiles(p)));
    else if (entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const OWN_HOST = /^https?:\/\/(www\.)?gesunde-matratzen\.de\/(?!wp-content\/)/;

/** Texts and prices of one JSON value, checked against `text`; also flags unrewritten internal links. */
function check(file, value, text, { label = '', links = false } = {}) {
  for (const { path, value: v } of walk(value)) {
    const key = path.at(-1);
    const where = `${file} ${label}${path.join('.')}`;
    if (typeof v === 'number' && PRICE_KEYS.has(key)) {
      checked++;
      if (!priceCandidates(v).some((c) => text.includes(c))) failures.push(`${where}: price ${v} not found in source`);
    } else if (typeof v === 'string' && v.trim()) {
      const texts = key === 'html' ? parse(v).querySelectorAll('*').flatMap((n) => n.childNodes.filter((c) => c.nodeType === 3).map((c) => c.text)) : [mdToText(v)];
      for (const t of texts) {
        const needle = clean(t);
        if (!needle) continue;
        checked++;
        if (!text.includes(needle)) failures.push(`${where}: "${needle.slice(0, 90)}" not found in source`);
      }
    }
  }
  if (!links) return;
  const raw = JSON.stringify(value);
  for (const m of raw.matchAll(/(?:\]\(|href\\?":\s*\\?"|href=\\")(https?:\/\/[^)"\\\s]+)/g)) {
    if (OWN_HOST.test(m[1])) failures.push(`${file} ${label}internal link not rewritten: ${m[1]}`);
  }
}

const text = await corpus();
const failures = [];
let checked = 0;
let importedPages = 0;

for (const file of await contentFiles('src/content')) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  const rel = file.replace(/\\/g, '/');
  if (rel.startsWith('src/content/pages/') && data.source) {
    importedPages++;
    const { raw, text: pageText } = await pageSource(data.source.id);
    check(file, data.body, pageText, { links: true });
    const yoast = parseYoast(raw.yoast_head, clean(parse(`<p>${raw.title.rendered}</p>`).text));
    fixTrashedCanonical(yoast, raw.link);
    const expected = JSON.stringify(yoast);
    if (JSON.stringify(data.seo) !== expected) failures.push(`${file} seo: differs from yoast_head of source page ${data.source.id}`);
    if (data.title !== data.seo.title) failures.push(`${file} title: differs from seo.title`);
    if (new URL(raw.link).pathname !== data.path) failures.push(`${file} path: ${data.path} differs from source ${raw.link}`);
  } else if (rel.startsWith('src/content/snippets/') && Array.isArray(data.sources)) {
    const texts = [];
    for (const id of data.sources) texts.push((await pageSource(id)).text);
    check(file, data.body, texts.join('\n'), { links: true });
  } else {
    check(file, data, text);
  }
}

if (failures.length) {
  console.error(`Content parity FAILED (${failures.length} of ${checked}):\n` + failures.slice(0, 60).join('\n') + (failures.length > 60 ? `\n... +${failures.length - 60} more` : ''));
  process.exit(1);
}
console.log(`Content parity OK: ${checked} texts and prices match the captured source (${importedPages} imported pages verified against their own WordPress content).`);
