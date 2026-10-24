// Shared helpers for the Storyblok scripts: env, zod schemas (with plain-string references), local content, API clients.
import { createHash } from 'node:crypto';
import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'astro/zod';
import { makeSchemas } from '../../src/lib/schema.ts';
import { CONTENT_TYPES, FOLDERS, createConverter } from '../../src/lib/storyblok/convert.mjs';

export { CONTENT_TYPES, FOLDERS };

try {
  process.loadEnvFile('.env');
} catch {}

/** zod schemas with references as tagged strings (`reference:<collection>`), as the generator expects. */
export function loadSchemas() {
  const ref = (c) => z.string().describe(`reference:${c}`);
  return makeSchemas({ products: ref('products'), branches: ref('branches'), snippets: ref('snippets') });
}

export async function loadModel() {
  const model = JSON.parse(await readFile('storyblok/model.json', 'utf8'));
  return { model, convert: createConverter(model) };
}

/** Local entries of a collection as `{ id, data }` (same ids as the Astro loaders). */
export async function readLocal(collection) {
  if (collection === 'settings') {
    const all = JSON.parse(await readFile('src/content/settings.json', 'utf8'));
    return Object.entries(all).map(([id, data]) => ({ id, data }));
  }
  const dir = join('src/content', collection);
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort();
  return Promise.all(files.map(async (f) => ({ id: f.slice(0, -5), data: JSON.parse(await readFile(join(dir, f), 'utf8')) })));
}

/** Stable `_uid` (uuid format) from a seed, so re-pushing unchanged content produces identical stories. */
export function stableUid(seed) {
  const h = createHash('sha1').update(seed).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

export function requireEnv(...names) {
  const missing = names.filter((n) => !process.env[n]);
  if (missing.length) {
    console.error(`Missing ${missing.join(', ')} (set them in .env, see .env.example)`);
    process.exit(1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Management API client (EU region). Throttled; retries on 429. Never logs the token. */
export function mapi() {
  requireEnv('STORYBLOK_SPACE_ID', 'STORYBLOK_MANAGEMENT_TOKEN');
  const base = `https://mapi.storyblok.com/v1/spaces/${process.env.STORYBLOK_SPACE_ID}`;
  let last = 0;
  async function request(method, path, body) {
    for (let attempt = 0; ; attempt++) {
      const wait = last + 350 - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      const res = await fetch(base + path, {
        method,
        headers: { Authorization: process.env.STORYBLOK_MANAGEMENT_TOKEN, 'Content-Type': 'application/json' },
        body: body && JSON.stringify(body),
      });
      if (res.status === 429 && attempt < 5) {
        await sleep(1000 * 2 ** attempt);
        continue;
      }
      const text = await res.text();
      if (!res.ok) throw new Error(`${method} ${path}: ${res.status} ${text.slice(0, 500)}`);
      return { data: text ? JSON.parse(text) : {}, headers: res.headers };
    }
  }
  return {
    get: (p) => request('GET', p).then((r) => r.data),
    post: (p, b) => request('POST', p, b).then((r) => r.data),
    put: (p, b) => request('PUT', p, b).then((r) => r.data),
    /** All items of a paged list endpoint, e.g. `/stories` -> `stories`. */
    async all(path, key) {
      const items = [];
      for (let page = 1; ; page++) {
        const sep = path.includes('?') ? '&' : '?';
        const { data, headers } = await request('GET', `${path}${sep}per_page=100&page=${page}`);
        items.push(...data[key]);
        if (!data[key].length || items.length >= Number(headers.get('total') ?? items.length)) return items;
      }
    },
  };
}
