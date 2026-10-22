// Content model for the prototype. Mirrors the planned Storyblok model:
// collections = Storyblok folders, `component` = Storyblok block name.
import { defineCollection, reference, z } from 'astro:content';
import { file, glob } from 'astro/loaders';

/** Inline text with `[label](href)` links and `**bold**`; rendered by src/lib/md.ts. */
const md = z.string();
const href = z.string().regex(/^(\/|https?:\/\/|tel:|mailto:|#)/, 'href must be site-relative, absolute, tel: or mailto:');
const link = z.object({ label: z.string(), href });
const image = z.object({ src: z.string().url(), alt: z.string().default('') });
const euro = z.number().nonnegative();
const price = z.object({ from: euro, regular: euro.optional(), prefix: z.string().default('ab'), suffix: z.string().optional() });

const navItem: z.ZodType<NavItem> = z.lazy(() =>
  z.object({ label: z.string(), note: z.string().optional(), href: href.optional(), children: z.array(navItem).optional() }),
);
export type NavItem = { label: string; note?: string; href?: string; children?: NavItem[] };

const settings = defineCollection({
  loader: file('src/content/settings.json'),
  schema: z.object({
    siteName: z.string(),
    logo: image,
    appointmentCta: link,
    navigation: z.array(navItem),
    footer: z.object({
      heading: z.string(),
      address: z.string(),
      phone: link,
      email: link,
      columns: z.array(z.object({ heading: z.string(), links: z.array(link.extend({ note: z.string().optional() })) })),
      copyright: z.string(),
      legal: z.array(link),
    }),
  }),
});

const branches = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/branches' }),
  schema: z.object({
    name: z.string(),
    href,
    company: z.string().optional(),
    street: z.string().optional(),
    zip: z.string().optional(),
    city: z.string().optional(),
    region: z.string().optional(),
    phone: z.string(),
    fax: z.string().optional(),
    email: z.string().email().optional(),
    hours: z.array(z.string()).optional(),
    mapsHref: href.optional(),
    image: image.optional(),
    order: z.number(),
  }),
});

const products = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/products' }),
  schema: z.object({
    name: z.string(),
    subtitle: z.string().optional(),
    href: href.optional(),
    image,
    badge: z.string().optional(),
    description: z.string().optional(),
    priceRegular: euro.optional(),
    priceFrom: euro,
    priceNote: z.string().optional(),
    size: z.string().optional(),
    returnPolicy: link.optional(),
    certificates: z
      .object({ heading: z.string(), intro: z.string(), image: image.optional(), links: z.array(link) })
      .optional(),
    detailsLink: link.optional(),
    pricesLink: link.optional(),
  }),
});

const card = z.object({
  eyebrow: z.string().optional(),
  title: z.string().optional(),
  titleTag: z.enum(['h2', 'h3', 'h4', 'p']).default('h3'),
  subtitle: md.optional(),
  href: href.optional(),
  image: image.optional(),
  text: z.array(md).default([]),
  bullets: z.array(md).default([]),
  price: euro.optional(),
  priceRegular: euro.optional(),
  pricePrefix: z.string().optional(),
  note: z.string().optional(),
  cta: link.optional(),
  linkLabel: z.string().optional(),
  isVideo: z.boolean().default(false),
});

const mediaText = z.object({
  component: z.literal('mediaText'),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  headingLevel: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).default('h2'),
  headingHref: href.optional(),
  body: z.array(md).default([]),
  bullets: z.array(md).default([]),
  outro: z.array(md).default([]),
  price: price.optional(),
  image: image.optional(),
  imageHref: href.optional(),
  imageFit: z.enum(['cover', 'contain']).default('cover'),
  ctas: z.array(link).default([]),
  reverse: z.boolean().default(false),
  tone: z.enum(['plain', 'sand', 'brand', 'accent']).default('plain'),
});

const cardGrid = z.object({
  component: z.literal('cardGrid'),
  eyebrow: z.string().optional(),
  heading: z.string().optional(),
  headingHref: href.optional(),
  intro: z.array(md).default([]),
  columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
  imageFit: z.enum(['cover', 'contain']).default('cover'),
  cards: z.array(card),
  ctas: z.array(link).default([]),
  tone: z.enum(['plain', 'sand', 'brand']).default('plain'),
});

// Importer: flowing text of a WordPress row (headings, paragraphs, lists, images, buttons) in source order.
// `id` carries in-page anchors (`#frage1`).
const contentItem = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), level: z.number().int().min(1).max(6), text: md, id: z.string().optional() }),
  z.object({ type: z.literal('paragraph'), text: md, lead: z.boolean().default(false), id: z.string().optional() }),
  z.object({ type: z.literal('list'), ordered: z.boolean().default(false), items: z.array(md), id: z.string().optional() }),
  z.object({ type: z.literal('image'), image, href: href.optional(), id: z.string().optional() }),
  z.object({ type: z.literal('button'), link, style: z.enum(['primary', 'secondary']).default('primary') }),
]);

const content = z.object({
  component: z.literal('content'),
  items: z.array(contentItem),
  tone: z.enum(['plain', 'sand']).default('plain'),
});

// Importer fallback for markup no block recognises: sanitised HTML (see scripts/import/sanitize.mjs).
const richText = z.object({
  component: z.literal('richText'),
  html: z.string(),
  reason: z.string().optional(),
});

const tableCell = z.object({ text: z.array(md).default([]), images: z.array(image).default([]) });
const table = z.object({
  component: z.literal('table'),
  heading: z.string().optional(),
  head: z.array(tableCell).default([]),
  rows: z.array(z.array(tableCell)),
});

const blocks = z.discriminatedUnion('component', [
  z.object({
    component: z.literal('promoTiles'),
    tiles: z.array(z.object({ title: z.string(), subtitle: z.string(), href, image, tour360: z.boolean().default(false) })),
  }),
  z.object({
    component: z.literal('hero'),
    eyebrow: z.string().optional(),
    headingLines: z.array(z.string()),
    subheading: md.optional(),
    seal: image.optional(),
    introTitle: z.string().optional(),
    bullets: z.array(md).default([]),
    ctas: z.array(link).default([]),
    rating: z.object({ title: z.string(), image, cta: link }).optional(),
    aside: z
      .object({ title: z.string(), video: z.string().url(), poster: z.string().url().optional(), caption: z.string(), text: z.array(md), cta: link })
      .optional(),
  }),
  z.object({
    component: z.literal('categoryPrices'),
    heading: z.string().optional(),
    image: image.optional(),
    items: z.array(z.object({ label: z.string(), price: euro, href })),
  }),
  mediaText,
  z.object({
    component: z.literal('productGrid'),
    heading: z.string(),
    products: z.array(reference('products')),
    cta: link.optional(),
  }),
  z.object({
    component: z.literal('productVariants'),
    products: z.array(reference('products')),
    appointment: link,
  }),
  cardGrid,
  z.object({
    component: z.literal('testimonials'),
    heading: z.string(),
    intro: md.optional(),
    items: z.array(
      z.object({
        author: z.string(),
        meta: z.string().optional(),
        product: z.string().optional(),
        rating: z.number().int().min(1).max(5).optional(),
        summary: md.optional(),
        text: z.array(z.string()),
      }),
    ),
    cta: link.optional(),
  }),
  z.object({
    component: z.literal('appointmentCta'),
    heading: z.string(),
    href,
    text: z.string(),
    branches: z.array(z.object({ label: z.string(), branch: reference('branches') })),
  }),
  z.object({
    component: z.literal('branchList'),
    heading: z.string(),
    linkLabel: z.string(),
    branches: z.array(reference('branches')),
  }),
  z.object({
    component: z.literal('branchHero'),
    branch: reference('branches'),
    headingLines: z.array(z.string()),
    contactHeading: z.string(),
    hoursHeading: z.string(),
    cta: link,
    ctaNote: z.string().optional(),
    seal: image.optional(),
    mapsLabel: z.string().optional(),
  }),
  z.object({
    component: z.literal('gallery'),
    heading: z.string(),
    images: z.array(image),
  }),
  z.object({
    component: z.literal('linkList'),
    heading: z.string(),
    links: z.array(link),
  }),
  content,
  richText,
  table,
  z.object({
    component: z.literal('accordion'),
    heading: z.string().optional(),
    items: z.array(z.object({ title: md, body: z.array(md).default([]), open: z.boolean().default(false) })),
  }),
  z.object({
    component: z.literal('productHeader'),
    heading: z.string().optional(),
    headingLevel: z.enum(['h1', 'h2', 'h3', 'h4', 'h5', 'h6']).default('h2'),
    headingHref: href.optional(),
    image: image.optional(),
    seals: z.array(image).default([]),
    price: price.optional(),
    body: z.array(md).default([]),
    reverse: z.boolean().default(false),
    snippet: reference('snippets').optional(),
  }),
  z.object({
    component: z.literal('tabs'),
    tabs: z.array(z.object({ title: z.string(), body: z.array(z.discriminatedUnion('component', [content, mediaText, cardGrid, richText, table])) })),
  }),
  // Shared block group (WPBakery "templatera" template); the group lives in src/content/snippets/.
  z.object({
    component: z.literal('snippet'),
    snippet: reference('snippets'),
  }),
]);

export type Block = z.infer<typeof blocks>;

const seo = z.object({
  title: z.string(),
  description: z.string().optional(),
  canonical: z.string().url().optional(),
  robots: z.string().optional(),
  openGraph: z.record(z.string(), z.string()).default({}),
  schema: z.unknown().optional(),
});

const pages = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/pages' }),
  schema: z.object({
    path: z.string().regex(/^\/(.*\/)?$/, 'path must start and end with /'),
    title: z.string(),
    // Set by the importer (scripts/import.mjs); hand-written prototype pages have no source.
    source: z.object({ id: z.number().int(), link: z.string().url(), modified: z.string() }).optional(),
    seo: seo.optional(),
    body: z.array(blocks),
  }),
});

const snippets = defineCollection({
  loader: glob({ pattern: '*.json', base: 'src/content/snippets' }),
  schema: z.object({
    name: z.string(),
    // WordPress page ids whose HTML contains this template (used by verify-content).
    sources: z.array(z.number().int()),
    body: z.array(blocks),
  }),
});

export const collections = { settings, branches, products, pages, snippets };
