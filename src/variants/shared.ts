// Shared data access for the design variants (/silwa-classic-matratzen/variant_a|b|c/).
// Variants only change presentation: every text, price and image comes from src/content.
import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import type { Block } from '../content.config';

export const variants = [
  { slug: 'variant_a', short: 'A', label: 'Ruhe & Natur' },
  { slug: 'variant_b', short: 'B', label: 'Fachhandel (Ravensberger-Stil)' },
  { slug: 'variant_c', short: 'C', label: 'Klar & Kontrast' },
] as const;

export type Product = CollectionEntry<'products'>['data'] & { id: string };
export type Branch = CollectionEntry<'branches'>['data'] & { id: string };
export type Settings = CollectionEntry<'settings'>['data'];
export type BlockOf<T extends Block['component']> = Extract<Block, { component: T }>;

export async function loadVariantData(pageId: string) {
  const page = (await getEntry('pages', pageId))!.data;
  const settings = (await getEntry('settings', 'global'))!.data;
  const products = new Map((await getCollection('products')).map((p) => [p.id, { ...p.data, id: p.id }]));
  const branches = (await getCollection('branches')).sort((a, b) => a.data.order - b.data.order).map((b) => ({ ...b.data, id: b.id }));

  const product = (ref: { id: string }): Product => products.get(ref.id)!;
  const branch = (ref: { id: string }): Branch => branches.find((b) => b.id === ref.id)!;

  // Hero visual: the last model of the page's variant list (SILWA Classic 22 NEW, named in the hero eyebrow).
  const variantBlock = page.body.find((b): b is BlockOf<'productVariants'> => b.component === 'productVariants');
  const featured = variantBlock ? product(variantBlock.products.at(-1)!) : undefined;

  return { page, settings, branches, product, branch, featured };
}

export type VariantData = Awaited<ReturnType<typeof loadVariantData>>;
