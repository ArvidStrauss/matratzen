# AGENTS.md — gesunde-matratzen.de relaunch

Always-loaded project context for AI agents. Keep it short and factual.
Mark everything as **DECIDED**, **PROPOSED** or **OPEN**. Update it when a decision changes.

## Goal

Recreate https://gesunde-matratzen.de with **exactly the same content** but a **modern layout/design**.
Content (products, prices, texts) must be editable by non-developers via a CMS.

**Project scope (DECIDED, 2026-10-20):** migrate the **whole current WordPress site as it is** (all pages, same URLs,
same content) and **keep the existing SEO setup** — years of work went into it. Markup does **not** have to be a 1:1 HTML
copy: new elements (cards, new menu style, new section layouts) are fine. **Bottom line: the content stays exactly as it is.**

**Why the customer leaves WordPress:** painful plugin maintenance and, above all, **very slow loading times**. The new site
must be fast and prepared for a good **Google Ads** setup (landing-page experience / Quality Score) and high
**Lighthouse / Core Web Vitals** scores.

## Status

- Phase: **test-pilot / pre-sales prototype**.
- Prototype of the 3 pages is **built** (2026-10-15); `npm run verify` is green.
- **Customer feedback (2026-10-20):** wants a **more modern and less colourful** design. Three layout variants of the
  SILWA Classic page are built for review (see [Design variants](#design-variants)).
- **Customer meeting (2026-10-22):** chose the **original prototype design** (none of the variants A/B/C); requirements and phases 1–4
  recorded in [docs/requirements.md](docs/requirements.md) (internal, EN) and [docs/anforderungen.md](docs/anforderungen.md)
  (for the customer, DE; keep both in sync). Phase 1 plan (steps, architecture, hosting, estimate): [docs/phase1.md](docs/phase1.md).

## Repo layout

| Path | Purpose |
|---|---|
| `reference/raw/` | Captured HTML + WP REST JSON (read-only, regenerate with `npm run capture`) |
| `reference/extracted/` | Ordered verbatim content blocks per page (`npm run extract`); `*.txt` = readable dumps (`node scripts/dump.mjs <page> [sections\|menu\|footer\|heroNav]`) |
| `src/content.config.ts` | Content model (zod). Mirrors future Storyblok: collection = folder, `component` = block name |
| `src/content/` | `settings.json` (logo, nav, footer), `pages/`, `products/`, `branches/`, `snippets/` (shared block groups from WPBakery templates) |
| `scripts/import.mjs`, `scripts/import/` | WordPress importer (REST → blocks), re-runnable; raw REST data cached in `reference/raw/pages/` (read-only), page index in `reference/raw/page-index.json` |
| `src/components/blocks/` | One Astro component per block; registered in `BlockRenderer.astro` |
| `src/styles/global.css` | Design tokens (`@theme`). brand-600 = original green `#517512`, accent-500 = original orange `#e99600` |
| `src/variants/` | Design variants A/B/C of the SILWA Classic page (presentation only, see [Design variants](#design-variants)) |
| `src/pages/silwa-classic-matratzen/variant_*.astro` | One route per variant (one route each, so each page bundles only its own CSS) |
| `scripts/verify-content.mjs` | Parity gate: every text/price in `src/content` must exist verbatim in `reference/raw` |
| `docs/` | `requirements.md` (EN, internal) + `anforderungen.md` (DE, customer copy), `phase1.md` (phase 1 steps, architecture, estimate), `requirements-questions.md` (content questions) |

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run import -- --group=/lattenroste/ [--offline]` = fetch a URL group from the WP REST API and (re)write `src/content/pages/<path>.json` + `snippets/`;
  prints the fallback share per page. Imported pages carry `source` (WP id) and `seo` (from `yoast_head`) and stay `noindex`. Never edit them by hand, re-import instead
- `npm run verify` = content parity + `astro check` + build + output parity (headings, image alts, in-page anchors of imported pages vs. source). **Must be green before handing work back.**
- Inline rich text in content JSON: `[label](href)` and `**bold**` only (rendered by `src/lib/md.ts`, HTML-escaped).
- Prices are numbers (`priceFrom`, `priceRegular`, `price.from`), formatted with `Intl` de-DE. Never store price strings.

## Decisions

| Topic | State | Value |
|---|---|---|
| Content parity | DECIDED | Same content as live site; never invent copy, prices or claims. Only exceptions: customer-requested changes in [docs/requirements.md](docs/requirements.md) (e.g. remove Massagesessel/Tempur and the 5 home-top images, move Pflegebetten down, new copy supplied by the customer) |
| Project scope | DECIDED | Migrate the whole WordPress site (all ~290 pages) as it is. New markup/components allowed, content unchanged except the requested changes above |
| Roadmap | DECIDED | Phase 1: port content 1:1 + first design changes and small changes. 2: A/B tests, analytics. 3: campaign performance. 4: agentic GEO / chatbot search |
| SEO parity | DECIDED | Keep the Yoast SEO setup: same URLs (incl. trailing slash), titles, meta descriptions, canonicals, heading hierarchy, image alt texts, internal links, structured data. Source: `yoast_head` in `reference/raw/*.wp.json`. Changed URLs need 301 redirects |
| Performance | DECIDED | Main driver for leaving WordPress. Targets: Lighthouse/Core Web Vitals green on mobile, Google-Ads-ready landing pages (fast LCP, no layout shift, clear call/appointment CTAs) |
| Design | DECIDED | Modern redesign, not a pixel clone. 2026-10-20 the customer asked for more modern / less colourful; 2026-10-22 they chose the original prototype design anyway |
| Design direction | DECIDED (2026-10-22) | **Original prototype design** (current `global.css` + `src/components/`, as used by the 3 prototype pages). Variants A/B/C were **not** chosen. Known issue: white text on orange `#e99600` fails WCAG contrast |
| Competitor | INFO | https://www.ravensberger-matratzen.de/ — big competitor; variant B borrows its design scheme (never its content or assets) |
| Architecture | DECIDED | **Static site, permanently.** No shop, no backend, no database — ever. Only a headless CMS |
| Forms | DECIDED | Client-side embeddable forms only (third-party embed), no own backend |
| CMS | DECIDED (later) | Storyblok, integrated after the prototype. Must be usable without coding. Content flow: importer → JSON in `src/content/` → push script → Storyblok (then source of truth); see [docs/phase1.md](docs/phase1.md) |
| Frontend | DECIDED | Astro + Tailwind |
| Prototype content | DECIDED | Typed JSON in `src/content/` with schemas that mirror the future Storyblok model |
| Prototype pages | DECIDED | 1. Home `/`  2. Product page `/silwa-classic-matratzen/`  3. Branch page `/filialen/filiale-hamburg/` |
| Prototype out of scope | DECIDED | Forms, cookie consent, CMS, search, all other pages. SEO meta tags are not in the prototype yet (pages are `noindex`), but SEO parity is in scope for the relaunch |

## Design variants

Customer asked (2026-10-20) for a more modern, less colourful look. Three variants of `/silwa-classic-matratzen/`,
each with **identical content** (same JSON as the original page, nothing new or reworded):

| Variant | URL (GitHub Pages) | Concept |
|---|---|---|
| Original | [/silwa-classic-matratzen/](https://arvidstrauss.github.io/matratzen/silwa-classic-matratzen/) | Current prototype (green + orange) |
| A "Ruhe & Natur" | [/silwa-classic-matratzen/variant_a/](https://arvidstrauss.github.io/matratzen/silwa-classic-matratzen/variant_a/) | Warm paper neutrals, one muted sage accent (desaturated brand green), Fraunces serif headlines + Inter. Editorial, airy: models as a calm list (image · text · price), certificates folded away, arch-framed hero, hairline dividers |
| B "Fachhandel" | [/silwa-classic-matratzen/variant_b/](https://arvidstrauss.github.io/matratzen/silwa-classic-matratzen/variant_b/) | **Ravensberger-style**: Mona Sans, light-weight headlines, steel blue `#758ca3`-family, beige service bar, pale blue-grey panels, white product cards on warm grey, graphite buttons, icon rows, branch cards with photos, two-row header with centred mega menu |
| C "Klar & Kontrast" | [/silwa-classic-matratzen/variant_c/](https://arvidstrauss.github.io/matratzen/silwa-classic-matratzen/variant_c/) | Monochrome black/white/fog grey, brand green only for prices/checks, Manrope. Dark hero, bento panels, swipeable model cards on mobile, slide-in drawer menu (native `popover`), **sticky mobile call + appointment bar** (Google Ads landing focus) |

- Build: `src/variants/shared.ts` loads page/products/branches/settings; each `src/variants/<a|b|c>/` has its own
  `theme.css` (`@import 'tailwindcss' source(none)` + `@source` → only its own classes), `Header`, `Footer`, `Blocks`, `Page`.
  `src/variants/nav/` = unstyled menu structures (hover mega menu, accordion), styled per variant via `ui` classes.
- Variants must only change presentation. Labels that are pure UI (e.g. "Größe:", "Menü", the prototype `VariantSwitcher`) are allowed;
  any visible copy must come from `src/content`. Decorative icons live in `src/variants/icons.ts`.
- Lighthouse mobile on the production build (2026-10-20, local preview): perf 96–98, a11y 100, best practices 96, CLS ≈ 0 for all three
  variants; original page a11y 95 (white on orange `#e99600` fails contrast). SEO score is low only because of `noindex` + no meta description.
- None of the variants was chosen (2026-10-22): the customer chose the original prototype design. Keep `src/variants/` and the
  `variant_*` routes for now as reference; do not port them into `src/components/`. Delete them once the user says so.

## Live site findings (captured 2026-10-15)

- **Stack**: WordPress 5.8.2 (outdated), Avada theme, WPBakery 6.8.0 (`vc_*`), WP Rocket, Yoast. No WooCommerce.
- **Size** (public REST API `/wp-json/wp/v2/`): 290 pages, 0 posts, 2437 media items.
  REST namespaces: `wp/v2`, `yoast/v1`, `mdb-api/v1`, `wp-rocket/v1`, `oembed/1.0`.
- **Content format** (re-checked 2026-10-22 over all 290 pages): `content.rendered` is **rendered WPBakery HTML**
  (`vc_row`/`wpb_*` classes, 191 distinct builder classes) for 287 pages; only 3 pages return raw `[vc_row]` shortcodes
  (`rahmen-silwa-viado-4motorig`, `tempur-all-around-schlafkissen`, `silwa-lattenrahmen-xxl-maxi-kf`). Migration = HTML → structured
  content converter, not a shortcode parser. 27 pages contain iframes, 19 MP4 videos, 4 forms, 9 inline scripts.
- **Indexed URLs** (Yoast sitemap): 290 pages + **1,638 attachment pages** (return 200, e.g. `/start-x/favicon-2/`) + 5 misc.
  Attachment URLs need a redirect decision. Hosting: Apache on Hetzner (FSN1), DNS nameservers `domaincontrol.com`.
- **Products/prices are free text** inside page content (e.g. `199,00 €`, `99,- €`). No product data model exists;
  designing one (product, variants, sizes, prices) is the core work of the real relaunch.
- **Home**: ~10,000 px tall, ~30 sections, 70 images, mega menu with ~100 internal links.
- **SILWA Classic page**: ~6,100 px, 5 variants (Classic 15/18/20/21/22) with prices, 49 images.
- **Extras**: Google reviews widget, 360° store views, self-hosted MP4 videos, appointment booking (`/beratungstermin/`),
  live search, simple cookie banner.
- Many promo banners have text **baked into images** — keep for prototype, flag for redesign.
- **Branches**: Lübeck (`/matratzen-luebeck/`), Hamburg (`/filialen/filiale-hamburg/`), Kiel (`/filialen/filiale-kiel/`).
- **Main categories**: Testsieger-Matratzen, SILWA Schlafsystem (own brand), Marken-Matratzen, Tempur, Topper,
  Lattenroste, Boxspringbetten, Bettgestelle, Komplettbetten, Wasserbetten, Massagesessel, Schlafsofas,
  Kissen, Decken, Bettwäsche, Schnäppchen-Markt.
- **Service pages**: Bewertungen, Über uns, Kompetenz-Zentrum, Finanzierung, Rückgaberecht, Lieferung,
  Kontakt, Impressum, Datenschutz, AGB.

## Agent rules

- `reference/` (captured source data, once it exists) is read-only.
- Take text, prices and images from captured source data only — never paraphrase or invent.
- Get raw site data via the REST API or `Invoke-WebRequest`/`curl`, not via web-page summarisers (they lose characters).
- The VS Code integrated browser is for inspection only; real clicks need a Playwright spec.
- Do not commit; the user commits himself.
- **No information leaves this repo.** This project is completely separate from TrackingHub and the LLM wiki: never write to
  the `dao-llm-wiki` MCP (or any other wiki, knowledge base or external memory store), never use Telecontext or other company
  tools for this project, and never send repo content to third-party services.

## Environment

- Windows, PowerShell 5.1. Node v20.9.0 (pick tool versions that support it; Node 22 comes with a new PC).
- Pinned for Node 20.9: `astro@5.18.2` (Astro 6+/7 need Node 22), root `vite@6.4.4` (Vite 8/rolldown needs Node 20.12+),
  `overrides: @astrojs/language-server@2.16.16` (2.17+ needs Node 20.19). Lift these on the Node 22 PC.
- `@types/node@20.19.43` (dev) so `astro check` accepts `process.env` in `astro.config.mjs`; bump with the Node upgrade.
- `npm audit` flags Astro <=7.2.7 (XSS via `define:vars`) — **never use `define:vars`**; fixed by the Astro upgrade.
- PowerShell `Set-Content -Encoding utf8` and `>` add BOM / UTF-16 — never write repo files from the shell.

## Gotchas (verified)

- Images are **hotlinked** from gesunde-matratzen.de and optimised at build (`image.domains`). Build needs network;
  a broken URL fails the build (good). Transient "other side closed" fetch errors → just rerun.
- Hero tile `data-bg-url` values on the live site are stale 404s; the real image is the `background-image` of the inner span.
- Some upload file names use **decomposed (NFD) umlauts** (`fachma\u0308nnische…`). Copy URLs byte-exact from `reference/raw`.
- Long German compounds ("Kaltschaummatratzen" ≈ 10 em) overflow phones; browsers often have no German hyphenation dictionary.
  Size headings so the word fits the column (≥ 360 px) and keep `overflow-wrap: break-word` as fallback; grid children need `min-w-0`.
- Headless Edge `--screenshot` cannot render below ~500 px width; use `npx playwright screenshot --channel=msedge --viewport-size=390,844`.

## Open content questions for the customer

Tracked in [docs/requirements-questions.md](docs/requirements-questions.md) (colour scheme / design variant, baked-in image text, Kiel data,
Lohmühle spelling, Bettgestelle price, SILWA Classic 15 naming, SEO migration). Update answers there, not here.
Open questions from the 2026-10-22 meeting (O1–O10) are in [docs/requirements.md](docs/requirements.md).
