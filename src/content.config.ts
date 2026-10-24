// Astro collections. The zod model lives in src/lib/schema.ts (shared with the Storyblok scripts).
import { defineCollection, reference, z } from 'astro:content';
import { file, glob } from 'astro/loaders';
import { makeSchemas } from './lib/schema';
import { withStoryblok } from './lib/storyblok/loader';

export type { NavItem } from './lib/schema';

const { collections: schemas, parts } = makeSchemas({
  products: reference('products'),
  branches: reference('branches'),
  snippets: reference('snippets'),
});

export type Block = z.infer<typeof parts.blocks>;
export type Seo = z.infer<typeof parts.seo>;

// CONTENT_SOURCE=storyblok reads from Storyblok, local JSON fills the gaps (src/lib/storyblok/loader.ts).
const json = (dir: string) => glob({ pattern: '*.json', base: `src/content/${dir}` });
const settings = defineCollection({ loader: withStoryblok('settings', file('src/content/settings.json')), schema: schemas.settings });
const branches = defineCollection({ loader: withStoryblok('branches', json('branches')), schema: schemas.branches });
const products = defineCollection({ loader: withStoryblok('products', json('products')), schema: schemas.products });
const pages = defineCollection({ loader: withStoryblok('pages', json('pages')), schema: schemas.pages });
const snippets = defineCollection({ loader: withStoryblok('snippets', json('snippets')), schema: schemas.snippets });

export const collections = { settings, branches, products, pages, snippets };
