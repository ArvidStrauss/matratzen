// Fetches the raw rendered HTML + WP REST JSON of the prototype pages into reference/raw/.
import { mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const BASE = 'https://gesunde-matratzen.de';
export const PAGES = {
  home: { path: '/', wp: 'include=9' },
  'silwa-classic-matratzen': { path: '/silwa-classic-matratzen/', wp: 'slug=silwa-classic-matratzen' },
  'filiale-hamburg': { path: '/filialen/filiale-hamburg/', wp: 'slug=filiale-hamburg' },
};

const headers = { 'User-Agent': 'Mozilla/5.0 (relaunch-capture)' };

async function main() {
  await mkdir('reference/raw', { recursive: true });
  for (const [key, { path, wp }] of Object.entries(PAGES)) {
    const html = await (await fetch(BASE + path, { headers })).text();
    await writeFile(`reference/raw/${key}.html`, html, 'utf8');
    const res = await fetch(`${BASE}/wp-json/wp/v2/pages?${wp}`, { headers });
    await writeFile(`reference/raw/${key}.wp.json`, await res.text(), 'utf8');
    console.log(`captured ${key}`);
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
