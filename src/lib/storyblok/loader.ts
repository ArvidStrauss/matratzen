// Content source switch. CONTENT_SOURCE=local (default): JSON in src/content only.
// CONTENT_SOURCE=storyblok: Storyblok stories, converted back to the JSON model and validated by the same zod schemas;
// local JSON fills everything not in Storyblok yet (pages by path, data entries by id), so URL groups move over one by one.
import type { Loader } from 'astro/loaders';
import model from '../../../storyblok/model.json';
import { fetchStories } from './cdn.mjs';
import { collectionOf, createConverter, entryId } from './convert.mjs';

try {
  process.loadEnvFile('.env');
} catch {}

type Collection = 'pages' | 'snippets' | 'products' | 'branches' | 'settings';
type Story = { uuid: string; slug: string; full_slug: string; is_startpage: boolean; content: { component: string } };

export const storyblokEnabled = process.env.CONTENT_SOURCE === 'storyblok';
/** `draft` for the preview (needs the preview token), `published` otherwise. */
export const storyblokVersion = process.env.STORYBLOK_VERSION === 'draft' ? 'draft' : 'published';

const convert = createConverter(model);

export function withStoryblok(collection: Collection, local: Loader): Loader {
  if (!storyblokEnabled) return local;
  return {
    name: `storyblok-${collection}`,
    async load(context) {
      const token = process.env.STORYBLOK_TOKEN;
      if (!token) throw new Error('CONTENT_SOURCE=storyblok needs STORYBLOK_TOKEN (see .env.example)');
      await local.load(context);
      const stories: Story[] = await fetchStories({ token, version: storyblokVersion });
      const byUuid = new Map(stories.map((s) => [s.uuid, s]));
      const ctx = {
        refId(c: Collection, uuid: string) {
          const story = byUuid.get(uuid);
          if (!story) throw new Error(`Storyblok reference ${uuid} (${c}) not found in ${storyblokVersion} stories`);
          return entryId(c, story);
        },
      };
      let count = 0;
      for (const story of stories) {
        if (collectionOf(story) !== collection) continue;
        const id = entryId(collection, story);
        const raw = convert.fromStory(collection, story, ctx) as Record<string, unknown> & { path?: string };
        if (collection === 'pages') {
          for (const [localId, entry] of context.store.entries()) if ((entry.data as { path?: string }).path === raw.path) context.store.delete(localId);
        }
        const data = await context.parseData({ id, data: raw });
        context.store.set({ id, data, digest: context.generateDigest(raw) });
        count++;
      }
      context.logger.info(`${count} from Storyblok (${storyblokVersion}), ${context.store.keys().length - count} local`);
    },
  };
}
