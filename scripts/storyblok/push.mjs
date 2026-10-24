// Pushes the local JSON of one URL group (plus every snippet/product/branch it references) to Storyblok.
// Pages keep their URL: the folder tree is the path (`/a/b/` = folder a/b with a start page), home = story `home`.
// Stories are matched by position (folder + slug) and updated in place; nothing is deleted.
// Usage: node scripts/storyblok/push.mjs --group=/lattenroste/ [--dry-run] [--publish]
//   --dry-run  plan only; works without a token (then assumes an empty space)
import { loadModel, mapi, readLocal, stableUid, FOLDERS } from './lib.mjs';
import { HOME_SLUG } from '../../src/lib/storyblok/convert.mjs';

const arg = (name) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split('=')[1];
const group = arg('group');
const dryRun = process.argv.includes('--dry-run');
const publish = process.argv.includes('--publish');
if (!group?.startsWith('/') || !group.endsWith('/')) {
  console.error('Usage: node scripts/storyblok/push.mjs --group=/lattenroste/ [--dry-run] [--publish]');
  process.exit(1);
}

const { convert } = await loadModel();
const offline = dryRun && !(process.env.STORYBLOK_SPACE_ID && process.env.STORYBLOK_MANAGEMENT_TOKEN);
const api = offline ? null : mapi();
if (offline) console.log('[dry run] no Storyblok credentials: planning against an empty space');

// --- Current space state (folders and stories without content) ---
const stories = offline ? [] : await api.all('/stories', 'stories');
// Start pages share their folder's full slug (`a/b/`), so they are tracked by folder id only.
const bySlug = new Map(stories.filter((s) => !s.is_startpage).map((s) => [s.full_slug.replace(/\/$/, ''), s]));
const startpages = new Map(stories.filter((s) => s.is_startpage).map((s) => [s.parent_id, s]));
let fakeId = 0;
const counts = { folders: 0, created: 0, updated: 0 };

async function ensureFolder(fullSlug, name) {
  if (!fullSlug) return { id: 0 };
  const found = bySlug.get(fullSlug);
  if (found) {
    if (!found.is_folder) throw new Error(`"${fullSlug}" exists as a story, expected a folder`);
    return found;
  }
  const parent = await ensureFolder(fullSlug.split('/').slice(0, -1).join('/'));
  const slug = fullSlug.split('/').pop();
  const story = { name: name ?? slug, slug, parent_id: parent.id, is_folder: true };
  console.log(`create folder ${fullSlug}`);
  counts.folders++;
  const created = dryRun ? { ...story, id: --fakeId, full_slug: fullSlug } : (await api.post('/stories', { story })).story;
  bySlug.set(fullSlug, created);
  return created;
}

/** Creates or updates a story; returns its uuid. */
async function upsert({ folder, slug, startpage = false, name, content, path }) {
  const parent = await ensureFolder(folder, startpage ? name : undefined);
  const fullSlug = [folder, slug].filter(Boolean).join('/');
  const current = startpage ? startpages.get(parent.id) : bySlug.get(fullSlug);
  if (current?.is_folder) throw new Error(`"${fullSlug}" is a folder, expected a story`);
  const story = { name, slug, parent_id: parent.id, is_startpage: startpage, content, ...(path && { path }) };
  console.log(`${current ? 'update' : 'create'} ${startpage ? `${folder}/ (start page)` : fullSlug}`);
  counts[current ? 'updated' : 'created']++;
  if (dryRun) return current?.uuid ?? `dry-run:${fullSlug}`;
  const body = { story, ...(publish && { publish: 1 }) };
  const saved = current ? (await api.put(`/stories/${current.id}`, { ...body, force_update: 1 })).story : (await api.post('/stories', body)).story;
  if (startpage) startpages.set(parent.id, saved);
  else bySlug.set(fullSlug, saved);
  return saved.uuid;
}

// --- What to push: the group's pages + everything they reference (transitively) ---
const local = {};
for (const c of ['pages', 'snippets', 'products', 'branches']) local[c] = new Map((await readLocal(c)).map((e) => [e.id, e.data]));
const pages = [...local.pages].filter(([, d]) => d.path.startsWith(group));
if (!pages.length) throw new Error(`No local pages under ${group}: run npm run import -- --group=${group} first`);

const refs = new Map(); // "collection/id" -> { collection, id }
const collect = (collection, data) =>
  convert.toContent(collection, data, {
    uid: () => '',
    ref: (c, id) => {
      if (!local[c]?.has(id)) throw new Error(`Reference to missing ${c}/${id}`);
      if (!refs.has(`${c}/${id}`)) {
        refs.set(`${c}/${id}`, { collection: c, id });
        collect(c, local[c].get(id));
      }
      return '';
    },
  });
for (const [, data] of pages) collect('pages', data);

const uuids = new Map(); // "collection/id" -> uuid
const ctx = (seed) => ({ uid: (p) => stableUid(`${seed}:${p}`), ref: (c, id) => uuids.get(`${c}/${id}`) ?? `dry-run:${c}/${id}` });

// Referenced data first, so their uuids exist. Data stories only reference other data stories one level deep
// (snippet bodies can reference products/branches), so push products/branches before snippets.
const order = { products: 0, branches: 1, snippets: 2 };
for (const { collection, id } of [...refs.values()].sort((a, b) => order[a.collection] - order[b.collection])) {
  const data = local[collection].get(id);
  const uuid = await upsert({
    folder: FOLDERS[collection],
    slug: id,
    name: data.name ?? id,
    content: convert.toContent(collection, data, ctx(`${collection}/${id}`)),
  });
  uuids.set(`${collection}/${id}`, uuid);
}

// Pages: a path that has child pages becomes a folder with a start page.
const allPaths = [...local.pages.values()].map((d) => d.path);
for (const [id, data] of pages.sort(([, a], [, b]) => a.path.length - b.path.length)) {
  const segments = data.path.split('/').filter(Boolean);
  const isFolder = allPaths.some((p) => p !== data.path && p.startsWith(data.path));
  const content = convert.toContent('pages', data, ctx(`pages/${id}`));
  if (data.path === '/') await upsert({ folder: '', slug: HOME_SLUG, name: data.title, content, path: '/' });
  else if (isFolder) await upsert({ folder: segments.join('/'), slug: segments.at(-1), startpage: true, name: data.title, content, path: data.path });
  else await upsert({ folder: segments.slice(0, -1).join('/'), slug: segments.at(-1), name: data.title, content, path: data.path });
}

console.log(
  `${dryRun ? '[dry run] ' : ''}${pages.length} pages + ${refs.size} referenced entries: ` +
    `${counts.folders} folders created, ${counts.created} stories created, ${counts.updated} updated${publish ? ', published' : ' (drafts)'}`,
);
