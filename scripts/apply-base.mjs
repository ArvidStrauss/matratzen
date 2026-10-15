// Prefixes site-absolute links (href="/...") in dist/ with BASE_PATH. Astro already prefixes its own assets.
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const base = (process.env.BASE_PATH ?? '/').replace(/\/+$/, '');
if (!base) {
  console.log('BASE_PATH not set, nothing to do.');
  process.exit(0);
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(p);
    else if (entry.name.endsWith('.html')) yield p;
  }
}

const pattern = new RegExp(`href="/(?!/|${base.slice(1)}/)`, 'g');
let files = 0;
let links = 0;
for await (const file of htmlFiles('dist')) {
  const html = await readFile(file, 'utf8');
  const out = html.replace(pattern, () => {
    links++;
    return `href="${base}/`;
  });
  if (out !== html) {
    await writeFile(file, out, 'utf8');
    files++;
  }
}
console.log(`Prefixed ${links} links with ${base} in ${files} files.`);
