// Offline round trip: every entry in src/content -> Storyblok content -> JSON must parse (zod) to the same data.
// Also fails if storyblok/model.json is out of date. No network, no token.
// Usage: node scripts/storyblok/check.mjs
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { loadSchemas, loadModel, readLocal, stableUid, CONTENT_TYPES } from './lib.mjs';

execFileSync(process.execPath, ['scripts/storyblok/generate.mjs', '--check'], { stdio: 'inherit' });

const { collections } = loadSchemas();
const { convert } = await loadModel();
// Fake references: uuid = "<collection>:<id>", as the push script would resolve them to real story uuids.
const toCtx = (seed) => ({ ref: (c, id) => `${c}:${id}`, uid: (p) => stableUid(`${seed}:${p}`) });
const fromCtx = { refId: (c, uuid) => uuid.slice(c.length + 1) };

let failures = 0;
let count = 0;
for (const collection of Object.keys(CONTENT_TYPES)) {
  for (const { id, data } of await readLocal(collection)) {
    count++;
    const expected = collections[collection].parse(data);
    // JSON round trip = what the API stores and returns.
    const content = JSON.parse(JSON.stringify(convert.toContent(collection, data, toCtx(id))));
    const story = { slug: id, full_slug: collection === 'pages' ? (data.path === '/' ? 'home' : data.path.slice(1)) : id, content };
    const actual = collections[collection].parse(convert.fromStory(collection, story, fromCtx));
    if (!isDeepStrictEqual(actual, expected)) {
      failures++;
      console.error(`✗ ${collection}/${id}: round trip differs`);
      console.error(firstDiff(expected, actual));
    }
  }
}

function firstDiff(a, b, path = '') {
  if (isDeepStrictEqual(a, b)) return null;
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
      const d = firstDiff(a[k], b[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  return `  at ${path || '(root)'}: expected ${JSON.stringify(a)?.slice(0, 200)}, got ${JSON.stringify(b)?.slice(0, 200)}`;
}

console.log(`${count - failures}/${count} entries survive the Storyblok round trip`);
process.exit(failures ? 1 : 0);
