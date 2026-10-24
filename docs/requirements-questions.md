# Requirements engineering: open questions for the customer

Project: relaunch of https://gesunde-matratzen.de (static site, headless CMS).
Status of the prototype: home, SILWA Classic product page and Filiale Hamburg are built; open points below came up while rebuilding them.
Source of every finding: captured pages in `reference/raw/` (2026-10-15).

Requirements from the customer meeting on 2026-10-22: [requirements.md](./requirements.md) (German copy for the customer: [anforderungen.md](./anforderungen.md)). Phase 1 plan: [phase1.md](./phase1.md).

Status values: **OPEN**, **ANSWERED**, **DECIDED**. Fill in *Answer* and *Decision* with the customer; update the status.

---

## Q1: Colour scheme and brand identity

| | |
|---|---|
| **Finding** | The live site uses green `#517512` (headings, buttons, footer text) and orange `#e99600` (highlights). The prototype keeps both as brand and accent colours inside a new, lighter palette (tints of green, sand backgrounds, dark green footer). |
| **Question** | Should the relaunch keep these two colours as they are, shift to a modernised palette, or follow an existing brand guideline? |
| **Follow-ups** | Is there a style guide or logo usage rule (minimum size, clear space, background colours)? The logo is a raster PNG; is a vector version (SVG) available? Are the SILWA and "natürlich Wasserbetten" sub-brand logos allowed to change colour? Which font should be used (the live site uses Sintony, the prototype Inter)? |
| **Why it matters** | Colour tokens drive every component. Changing them later is cheap in the prototype, but contrast checks (accessibility) and baked-in images (see Q2) depend on the choice. |
| **Update 2026-10-20** | Customer feedback: the design should be **more modern and less colourful**. Three variants of the SILWA Classic page were built with identical content: [A "Ruhe & Natur"](https://arvidstrauss.github.io/matratzen/silwa-classic-matratzen/variant_a/) (warm neutrals, muted sage, serif), [B "Fachhandel"](https://arvidstrauss.github.io/matratzen/silwa-classic-matratzen/variant_b/) (design scheme of competitor ravensberger-matratzen.de: steel blue, beige, light headlines), [C "Klar & Kontrast"](https://arvidstrauss.github.io/matratzen/silwa-classic-matratzen/variant_c/) (black/white, brand green only as accent, sticky call/appointment bar on mobile). Question: which variant (or which mix) should the relaunch use? Note: the orange `#e99600` with white text fails WCAG contrast; all three variants drop it as a UI colour. |
| **Status** | DECIDED |
| **Answer** | Customer meeting 2026-10-22: the **original prototype design** (green `#517512` + orange `#e99600`, as on the 3 prototype pages). None of the variants A/B/C was chosen. |
| **Decision** | Keep the current `global.css` tokens and `src/components/`. Variants stay in the repo for now as reference. Still to fix: white text on orange fails WCAG contrast. See [requirements.md](./requirements.md) D3. |

## Q2: Images with text and prices baked in

| | |
|---|---|
| **Finding** | Several promo images contain text or prices as part of the picture, for example the Boxspring offer images, the Set-Angebot banner (`set-angebot-silwa-classic-20-pro-nv.png`) and the "Fast alles für den gesunden Schlaf" price overview. Editors cannot change this text in a CMS, and it stays the same in every language, screen size and colour scheme. |
| **Question** | Who can supply clean images without text (or the original design files), so that prices and claims can be real, editable text? |
| **Options** | (a) Customer or agency supplies text-free originals; the new design adds the text as editable fields. (b) We keep the current images unchanged; prices in them stay a manual, separate edit. (c) We recreate the banners as designed components without photos. |
| **Why it matters** | Prices in images can get out of sync with the real prices, which is exactly what the CMS should prevent. Option (a) or (c) gives a single source of truth for prices. |
| **Status** | OPEN |
| **Answer** | |
| **Decision** | |

## Q3: Filiale Kiel: contact data

| | |
|---|---|
| **Finding** | The Kiel entry in the menu and in the header tiles shows the **Lübeck phone number** (0451 / 7 70 07). No street address, opening hours or e-mail for Kiel appear in the captured pages. The Kiel page itself (`/filialen/filiale-kiel/`) is not part of the prototype. |
| **Question** | Does the Kiel branch have its own phone number, address, opening hours and e-mail? Is it a full branch with a shop, or a consultation point served from Lübeck? |
| **Why it matters** | The branch data model (address, phone, hours) needs every field filled for each branch, and it is used in the header, footer, appointment section and branch pages. |
| **Status** | OPEN |
| **Answer** | |
| **Decision** | |

## Q4: Spelling of the Lübeck street

| | |
|---|---|
| **Finding** | The home page branch section reads "Bei der **Lohmüle** 21a"; the footer reads "Bei der **Lohmühle** 21a". The prototype uses the footer spelling. |
| **Question** | Which spelling is correct? (Probably "Lohmühle".) |
| **Why it matters** | With one branch record as the single source, the address is corrected once and appears correctly everywhere. This is an example of the benefit of structured content. |
| **Status** | OPEN |
| **Answer** | |
| **Decision** | |

## Q5: Bettgestelle starting price differs between pages

| | |
|---|---|
| **Finding** | Home page: Bettgestelle "ab **407,00 €**". Filiale Hamburg page: Bettgestelle "ab **499,-**". The prototype keeps each page's value unchanged. |
| **Question** | What is the current starting price for Bettgestelle? Should the price overview ("Fast alles für den gesunden Schlaf") be the same on all pages? |
| **Why it matters** | In the CMS a category starting price can be stored once and reused. That requires deciding which value is right and who updates it. |
| **Status** | OPEN |
| **Answer** | |
| **Decision** | |

## Q6: SILWA Classic 15: different name and link on two pages

| | |
|---|---|
| **Finding** | Home page: "SILWA Classic 15 KS Kaltschaum-Matratze mit 7 Zonen", linked to `/produkte/silwa-schlafsystem/silwa-classic-matratzen/silwa-classic-15-kaltschaum-matratze/`. Product page: "SILWA Classic 15 KS Kaltschaummatratze", with no product-detail link and no price list link (the other four Classic models have both). The prototype uses a single product entry with the product-page name. |
| **Question** | What is the official product name? Does Classic 15 have a detail page and a price list (PDF) like Classic 18 to 22? |
| **Why it matters** | One product entry feeds every teaser and listing. Name, link and price must be defined once. |
| **Status** | OPEN |
| **Answer** | |
| **Decision** | |

---

## Q7: Canonical URLs pointing to a deleted page

| | |
|---|---|
| **Finding** | 7 of the 21 `/lattenroste/` pages (2026-10-24) have a Yoast canonical, `og:url` and JSON-LD URL below `/produkte__trashed/…`, the URL of a parent page that was moved to the WordPress trash. These URLs return **404**, e.g. `/produkte__trashed/lattenroste/federleisten-rahmen/systemrahmen-silwa-alu-nv/` (the page itself is live at `/lattenroste/federleisten-rahmen/systemrahmen-silwa-alu-nv/`). Affected: `systemrahmen-silwa-alu-nv`, the 4 Lattenrost-Ratgeber sub-pages, `tellerlattenrahmen-evolution-2-kf`, `tellerlattenrahmen-evolution-nv`. More groups may be affected. |
| **Question** | May we replace these canonicals with the real page URL in the new site? (Recommended: yes. A canonical to a 404 page is ignored by Google at best and can keep the page out of the index at worst.) |
| **Why it matters** | SEO parity means keeping the Yoast setup, but copying a broken canonical would carry an existing SEO error over to the new site. |
| **Status** | OPEN. PROPOSED and already applied in the importer (`fixTrashedCanonical` in `scripts/import/seo.mjs`): the trashed URL is replaced by the page URL in canonical, `og:url` and JSON-LD; `npm run import` lists every fixed page. |
| **Answer** | |
| **Decision** | |

---

## Not yet captured (to be clarified when the scope grows)

- 360° virtual tour embed (Hamburg, Lübeck, Kiel) and the Google reviews widget: source and licence.
- Forms (appointment booking): which third-party embed is acceptable, and data protection requirements.
- Search and cookie consent: out of prototype scope.
- SEO migration (now **in project scope**, decided 2026-10-20: keep the Yoast setup): confirm that all ~290 URLs stay unchanged,
  who owns Google Search Console / Google Ads access, which tracking (GA4, Ads conversion) must run behind the cookie consent,
  and whether any pages may be merged or dropped (each needs a 301 redirect).
