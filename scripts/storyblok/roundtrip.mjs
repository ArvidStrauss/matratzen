// Acceptance gate after a push: every story in Storyblok, converted back, must equal its local JSON (after zod parsing).
// Reads via the Content Delivery API (STORYBLOK_TOKEN; STORYBLOK_VERSION=draft needs the preview token).
// Usage: node scripts/storyblok/roundtrip.mjs
import { isDeepStrictEqual } from 'node:util';
import { loadSchemas, loadModel, readLocal, requireEnv, CONTENT_TYPES } from './lib.mjs';
import { collectionOf, entryId } from '../../src/lib/storyblok/convert.mjs';
import { fetchStories } from '../../src/lib/storyblok/cdn.mjs';

requireEnv('STORYBLOK_TOKEN');
const version = process.env.STORYBLOK_VERSION === 'draft' ? 'draft' : 'published';
const { collections } = loadSchemas();
const { convert } = await loadModel();
const stories = await fetchStories({ token: process.env.STORYBLOK_TOKEN, version });
const byUuid = new Map(stories.map((s) => [s.uuid, s]));
const ctx = {
  refId(c, uuid) {
    const s = byUuid.get(uuid);
    if (!s) throw new Error(`reference ${uuid} (${c}) not found`);
    return entryId(c, s);
  },
};

const local = {};
for (const c of Object.keys(CONTENT_TYPES)) {
  local[c] = new Map((await readLocal(c)).map(({ id, data }) => [c === 'pages' ? data.path : id, data]));
}

let ok = 0;
const problems = [];
for (const story of stories) {
  const c = collectionOf(story);
  if (!c) continue;
  const label = `${c}/${story.full_slug}`;
  try {
    const data = convert.fromStory(c, story, ctx);
    const original = local[c].get(c === 'pages' ? data.path : entryId(c, story));
    if (!original) {
      problems.push(`${label}: no local JSON (created in Storyblok?)`);
      continue;
    }
    if (isDeepStrictEqual(collections[c].parse(data), collections[c].parse(original))) ok++;
    else problems.push(`${label}: differs from local JSON`);
  } catch (e) {
    problems.push(`${label}: ${e.message}`);
  }
}
for (const p of problems) console.error(`✗ ${p}`);
console.log(`${ok}/${ok + problems.length} Storyblok stories (${version}) equal the local JSON`);
process.exit(problems.length ? 1 : 0);
