// Fetches pages of one URL group via the WP REST API (incl. yoast_head) into reference/raw/pages/<id>.json.
import { mkdir, readdir, readFile, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { parse } from 'node-html-parser';

export const BASE = 'https://gesunde-matratzen.de';
export const RAW_DIR = 'reference/raw/pages';
const headers = { 'User-Agent': 'Mozilla/5.0 (relaunch-import)' };
const FIELDS = 'id,link,slug,parent,modified,status,title,content,yoast_head';

async function getJson(url, retries = 3) {
  for (let i = 0; ; i++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return { json: await res.json(), pages: Number(res.headers.get('x-wp-totalpages') ?? 1) };
    } catch (e) {
      if (i >= retries) throw e;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

export const pathOf = (link) => new URL(link).pathname;
export const INDEX_FILE = 'reference/raw/page-index.json';

/** Downloads every page whose path starts with `group` and returns the cached raw pages. */
export async function fetchGroup(group) {
  await mkdir(RAW_DIR, { recursive: true });
  const index = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const { json, pages } = await getJson(`${BASE}/wp-json/wp/v2/pages?per_page=100&page=${page}&_fields=id,link`);
    total = pages;
    index.push(...json);
  }
  await writeFile(INDEX_FILE, JSON.stringify(index.map(({ id, link }) => ({ id, link })), null, 1) + '\n', 'utf8');
  const ids = index.filter((p) => pathOf(p.link).startsWith(group)).map((p) => p.id);
  if (!ids.length) throw new Error(`no pages found below ${group}`);

  // Drop stale cache entries of this group so removed pages disappear on re-import.
  for (const raw of await loadCached(group)) await rm(join(RAW_DIR, `${raw.id}.json`));

  for (let i = 0; i < ids.length; i += 50) {
    const batch = ids.slice(i, i + 50);
    const { json } = await getJson(`${BASE}/wp-json/wp/v2/pages?include=${batch.join(',')}&per_page=100&_fields=${FIELDS}`);
    for (const p of json) {
      // A few pages come back from the REST API as unparsed [vc_row] shortcodes; their rendered front-end HTML is used instead.
      if (/\[\/?vc_row/.test(p.content.rendered)) p.liveContent = await fetchLiveContent(p.link);
      await writeFile(join(RAW_DIR, `${p.id}.json`), JSON.stringify(p, null, 2) + '\n', 'utf8');
    }
  }
  return loadCached(group);
}

/** Page content of the rendered front-end page, without the site-wide reviews widget. */
async function fetchLiveContent(link) {
  const res = await fetch(link, { headers });
  if (!res.ok) throw new Error(`${res.status} ${link}`);
  const content = parse(await res.text()).querySelector('.post-content');
  if (!content) throw new Error(`no .post-content in ${link}`);
  return content.childNodes
    .filter((n) => !(n.nodeType === 1 && (n.classList.contains('rplg') || n.classList.contains('cp-load-after-post'))))
    .map((n) => n.toString())
    .join('');
}

export const contentOf = (raw) => raw.liveContent ?? raw.content.rendered;

export async function loadCached(group) {
  const out = [];
  for (const f of (await readdir(RAW_DIR).catch(() => [])).filter((f) => f.endsWith('.json'))) {
    const raw = JSON.parse(await readFile(join(RAW_DIR, f), 'utf8'));
    if (pathOf(raw.link).startsWith(group)) out.push(raw);
  }
  return out.sort((a, b) => a.link.localeCompare(b.link));
}
