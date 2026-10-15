// Content parity gate: every text and price in src/content must exist verbatim in the captured source HTML.
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

const clean = (s) => (s ?? '').normalize('NFC').replace(/\u00ad/g, '').replace(/[\u00a0\u202f]/g, ' ').replace(/\s+/g, ' ').trim();
const mdToText = (s) => s.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1');

// Structural keys: identifiers, URLs and layout options, not visible copy.
const SKIP_KEYS = new Set(['href', 'src', 'video', 'poster', 'mapsHref', 'component', 'path', 'imageFit', 'tone', 'headingLevel', 'prefix', 'products', 'branches', 'branch', 'columns', 'order', 'reverse', 'isVideo', 'tour360']);
const PRICE_KEYS = new Set(['price', 'priceFrom', 'priceRegular', 'from', 'regular']);

async function corpus() {
  const parts = [];
  for (const f of (await readdir('reference/raw')).filter((f) => f.endsWith('.html'))) {
    const doc = parse(await readFile(join('reference/raw', f), 'utf8'));
    doc.querySelectorAll('script, style, noscript').forEach((n) => n.remove());
    parts.push(clean(doc.text));
    doc.querySelectorAll('[alt]').forEach((n) => parts.push(clean(n.getAttribute('alt'))));
  }
  return parts.join('\n');
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

const text = await corpus();
const failures = [];
let checked = 0;

for (const file of await contentFiles('src/content')) {
  const data = JSON.parse(await readFile(file, 'utf8'));
  for (const { path, value } of walk(data)) {
    const key = path.at(-1);
    if (typeof value === 'number' && PRICE_KEYS.has(key)) {
      checked++;
      if (!priceCandidates(value).some((c) => text.includes(c))) failures.push(`${file} ${path.join('.')}: price ${value} not found in source`);
    } else if (typeof value === 'string' && value.trim()) {
      checked++;
      const needle = clean(mdToText(value));
      if (!text.includes(needle)) failures.push(`${file} ${path.join('.')}: "${needle.slice(0, 90)}" not found in source`);
    }
  }
}

if (failures.length) {
  console.error(`Content parity FAILED (${failures.length} of ${checked}):\n` + failures.join('\n'));
  process.exit(1);
}
console.log(`Content parity OK: ${checked} texts and prices match the captured source.`);
