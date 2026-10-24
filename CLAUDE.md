# CLAUDE.md — gesunde-matratzen.de relaunch

Always-loaded project context for Claude Code (the only agent used on this project since 2026-10-24). Keep it short and factual.
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
| `src/lib/schema.ts`, `src/content.config.ts` | Content model (zod, plain module so Node scripts can load it) + Astro collections. Collection = Storyblok content type, `component` = block name |
| `storyblok/model.json` | **Generated** from `src/lib/schema.ts` (`npm run storyblok:generate`): Storyblok components + JSON↔Storyblok field map. Never edit by hand |
| `scripts/storyblok/` | `generate`, `check` (offline round trip), `sync-components`, `push`, `roundtrip` (remote gate), `env.mjs` (draft-preview launcher) |
| `src/lib/storyblok/` | `convert.mjs` (JSON↔story, shared by scripts and loader), `cdn.mjs`, `loader.ts` (`CONTENT_SOURCE` switch), `integration.mjs` (dev preview) |
| `src/content/` | `settings.json` (logo, nav, footer), `pages/`, `products/`, `branches/`, `snippets/` (shared block groups from WPBakery templates) |
| `scripts/import.mjs`, `scripts/import/` | WordPress importer (REST → blocks), re-runnable; raw REST data cached in `reference/raw/pages/` (read-only), page index in `reference/raw/page-index.json` |
| `src/components/blocks/` | One Astro component per block; registered in `BlockRenderer.astro` |
| `src/styles/global.css` | Design tokens (`@theme`). brand-600 = original green `#517512`, accent-500 = original orange `#e99600` |
| `src/variants/` | Design variants A/B/C of the SILWA Classic page (presentation only, see [Design variants](#design-variants)) |
| `src/pages/silwa-classic-matratzen/variant_*.astro` | One route per variant (one route each, so each page bundles only its own CSS) |
| `scripts/verify-content.mjs` | Parity gate: every text/price in `src/content` must exist verbatim in `reference/raw` |
| `.claude/settings.json` | Claude Code permissions: hard-blocks the agent rules below (see [Agent rules](#agent-rules)) |
| `docs/` | `requirements.md` (EN, internal) + `anforderungen.md` (DE, customer copy), `phase1.md` (phase 1 steps, architecture, estimate), `requirements-questions.md` (content questions) |

## Commands

- `npm run dev` / `npm run build` / `npm run preview`
- `npm run import -- --group=/lattenroste/ [--offline]` = fetch a URL group from the WP REST API and (re)write `src/content/pages/<path>.json` + `snippets/`;
  prints the fallback share per page. Imported pages carry `source` (WP id) and `seo` (from `yoast_head`) and stay `noindex`. Never edit them by hand, re-import instead
- `npm run verify` = content parity + Storyblok model/round-trip check + `astro check` + build + output parity (SEO head vs. `yoast_head`, headings, image alts, in-page anchors,
  internal links of imported pages vs. source; every built page `noindex` unless `INDEXABLE=true`). **Must be green before handing work back.**
  It also lists links to WordPress pages that are not imported yet (404 on the preview until their group is imported).
- `node scripts/screens.mjs --group=/lattenroste/ [--viewport=mobile|desktop]` (needs `npm run preview` running) = live vs. new
  screenshots as side-by-side tiles in `.screens/` (gitignored). Uses the installed Chrome via Playwright (no Edge on this PC).
- **Storyblok** (setup in `.env`, template `.env.example`; writing commands only when the user asks):
  `npm run storyblok:generate` after every schema change (`verify` fails if `model.json` is stale) · `npm run storyblok:components [-- --dry-run]` ·
  `npm run storyblok:push -- --group=/lattenroste/ [--dry-run] [--publish]` (group pages + referenced snippets/products/branches; dry run works without a token) ·
  `npm run storyblok:roundtrip` (Storyblok content converted back must equal the local JSON) · `npm run dev:storyblok` = https dev server with draft content
  for the Visual Editor (preview URL `https://localhost:4321/`). `CONTENT_SOURCE=storyblok` makes any build read Storyblok first, local JSON fills the gaps.
- SEO head: `src/layouts/Layout.astro` renders `seo` verbatim (title, description, canonical, og/article/twitter meta, JSON-LD).
  Robots stays `noindex, nofollow` until the production build sets `INDEXABLE=true`.
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
| Page layout | DECIDED (2026-10-24) | **Modern redesign, not a layout clone.** The live layout (columns, spacing) is a reference, not a target: same content, same order, same SEO; layout and spacing follow our design system |
| Competitor | INFO | https://www.ravensberger-matratzen.de/ — big competitor; variant B borrows its design scheme (never its content or assets) |
| Architecture | DECIDED | **Static site, permanently.** No shop, no backend, no database — ever. Only a headless CMS |
| Forms | DECIDED | Client-side embeddable forms only (third-party embed), no own backend |
| CMS | DECIDED | Storyblok. Must be usable without coding. Content flow: importer → JSON in `src/content/` → push script → Storyblok (then source of truth); see [docs/phase1.md](docs/phase1.md) |
| Storyblok pilot (2026-10-24) | DECIDED | `/lattenroste/` in the **developer's trial space**; moved to the customer org later by re-running `storyblok:components` + `storyblok:push`. Images stay URL + alt text fields (hotlinked) until P4. Hosted editor preview (draft rebuild vs. preview server, which touches "static only") is decided with the host (P1); until then the preview is the local `dev:storyblok` |
| Storyblok model | DECIDED | Generated from zod, never built by hand in the UI. Technical names snake_case (`mediaText` → `media_text`; `content` is reserved → `content_section`). Pages at the space root (folder tree = URL, a page with children = folder start page, `/` = story `home`), data stories in `data/<collection>/`. Snippets = content type `snippet_group` (`snippet` is the block that inserts one). String lists = textarea, one entry per line |
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
- The user tracks project hours himself; do not remind him or ask about hours.
- **No information leaves this repo.** This project is completely separate from TrackingHub and the LLM wiki: never write to
  the `dao-llm-wiki` MCP (or any other wiki, knowledge base or external memory store), never use Telecontext or other company
  tools for this project, and never send repo content to third-party services.
  For Claude Code this also means: no Artifacts, no Claude Docs, no Google Drive or other connectors for project content.
  **Exception (DECIDED 2026-10-24): Storyblok.** Site content (`src/content/` JSON, the component schema generated from
  `src/content.config.ts`) may be sent to the project's Storyblok space (EU region, `mapi.storyblok.com` / `api.storyblok.com`),
  and the build may read from it. Only through the repo's own scripts (push script, Astro loader), never by hand or via other
  tools. Nothing else goes there: no `docs/`, no `reference/raw`, no estimates or customer data. Tokens live in `.env`
  (gitignored) and are never printed, logged or committed. Writing to Storyblok (push, component sync, deletes) is outward-facing:
  the agent runs it only when the user asks for that run.
- **Knowledge lives in the repo, not in Claude's memory.** Do not save project facts to Claude Code auto-memory
  (`~/.claude/projects/.../memory/`); write decisions and findings into this file or `docs/` so they are versioned and visible.
- Hard guardrails are enforced in [.claude/settings.json](.claude/settings.json) (`permissions.deny`): no `git commit`/`git push`,
  no edits under `reference/`, no wiki/Docs/Drive/Artifact tools. Do not work around a denied call; ask the user instead.

## Environment

- Windows, PowerShell 5.1. **Node v24.22.1** since the move to the new PC (2026-10-24). The Node 20.9 pins below still apply
  but can now be lifted (separate task, not done yet). Line endings: `.gitattributes` = `* text=auto eol=lf`.
- Pinned for Node 20.9: `astro@5.18.2` (Astro 6+/7 need Node 22), root `vite@6.4.4` (Vite 8/rolldown needs Node 20.12+),
  `overrides: @astrojs/language-server@2.16.16` (2.17+ needs Node 20.19). Lift these on the Node 22 PC.
- `@types/node@20.19.43` (dev) so `astro check` accepts `process.env` in `astro.config.mjs`; bump with the Node upgrade.
- `npm audit` flags Astro <=7.2.7 (XSS via `define:vars`) — **never use `define:vars`**; fixed by the Astro upgrade.
- PowerShell `Set-Content -Encoding utf8` and `>` add BOM / UTF-16 — never write repo files from the shell.
- Storyblok's official Astro quickstart (`storyblok create`, Core Blueprint, `@storyblok/astro` with `output: "server"`, demo
  blocks `page`/`teaser`/`grid`/`feature`) is **deliberately not used**: it scaffolds a separate project, needs SSR (conflicts with
  "static, permanently") and its demo model is not ours. Our setup = `.env` + `npm run storyblok:components` + `storyblok:push`.
  Scripts assume the **EU** server location (`mapi.storyblok.com`, `api.storyblok.com`); check Settings → Space before using a new space.
- Git Bash rewrites `--group=/lattenroste/` into a Windows path; prefix `MSYS_NO_PATHCONV=1` there (PowerShell is fine).

## Gotchas (verified)

- Images are **hotlinked** from gesunde-matratzen.de and optimised at build (`image.domains`). Build needs network;
  a broken URL fails the build (good). Transient "other side closed" fetch errors → just rerun.
- Hero tile `data-bg-url` values on the live site are stale 404s; the real image is the `background-image` of the inner span.
- Some upload file names use **decomposed (NFD) umlauts** (`fachma\u0308nnische…`). Copy URLs byte-exact from `reference/raw`.
- Long German compounds ("Kaltschaummatratzen" ≈ 10 em) overflow phones; browsers often have no German hyphenation dictionary.
  Size headings so the word fits the column (≥ 360 px) and keep `overflow-wrap: break-word` as fallback; grid children need `min-w-0`.
- Headless Chrome/Edge `--screenshot` cannot render below ~500 px width; use Playwright (`scripts/screens.mjs`, channel `chrome`).
  Single full-page screenshots fail above ~16,000 px, so the script shoots clipped tiles.
- **Layout of blocks (2026-10-24):** multi-column WPBakery rows that match no specific block become a `columns` block (`span` in
  twelfths, recursive: columns hold blocks). `src/components/blocks/Columns.astro`: main + sidebar (8/4, 9/3) side by side from `lg`,
  other spans from `md`; DOM order = source order (SEO checks unchanged). Blocks nested in a column or tab (`data-nested`) drop their
  page frame via `global.css`. **Blocks choose their layout with container queries** (`@xl`/`@2xl`/`@3xl`/`@4xl`, `@max-sm` = sidebar
  width), not viewport breakpoints, so they work at full width and in a column. Use `@…:` for new layout classes in blocks.
- Tailwind puts `!py-*` utilities in a cascade layer; an unlayered `!important` rule loses against them. Overrides that must beat
  them go into `@layer base` in `global.css`.
- Line endings: some files were checked out as CRLF; scripted string edits must handle that (all of `src/` and `scripts/` are LF now).
- Live theme CSS hides `.desktoponly` rows on phones (`max-width:480px` / `max-device-width:667px`) and shows `.mobilonly`
  (sic) only there. The importer keeps this as block `visibility: desktop|mobile` (rendered `max-sm:hidden` / `sm:hidden`).
- Ultimate Addons buttons are `<a class="ubtn-link"><button>…</button></a>`; `<ol start="7">` continues a numbered list.
  Customer reviews are `<details>` (collapsed, "Mehr Info…" is a CSS label, not content).
- Some Yoast canonicals point to `/produkte__trashed/…` (404). The importer replaces them with the page URL (Q7).

## Open content questions for the customer

Tracked in [docs/requirements-questions.md](docs/requirements-questions.md) (colour scheme / design variant, baked-in image text, Kiel data,
Lohmühle spelling, Bettgestelle price, SILWA Classic 15 naming, trashed canonicals, SEO migration). Update answers there, not here.
Open questions from the 2026-10-22 meeting (O1–O10) are in [docs/requirements.md](docs/requirements.md).
