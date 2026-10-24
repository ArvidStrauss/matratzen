# Requirements: relaunch gesunde-matratzen.de

Internal documentation (English). German version for the customer: [anforderungen.md](./anforderungen.md). Keep both in sync.

Source: customer meeting 2026-10-22. Status values: **DECIDED** (customer said so), **PROPOSED** (our interpretation, to be
confirmed), **OPEN** (unclear). Open questions about content found in the captured site stay in
[requirements-questions.md](./requirements-questions.md).

## 1. Goals

| ID | Goal |
|---|---|
| G1 | Improve loading times |
| G2 | Improve the mobile experience (70 % of visitors on mobile, 10 % on PC) |
| G3 | Relaunch in general (leave WordPress) |
| G4 | Reduce running costs: 1,100 € plugin costs, hosting 200 € (or 137 €, see O8), expensive SSL certificates |
| G5 | Separate the web presences: each presence has its own target group, its own campaigns and its own site |
| G6 | Improve the AI sales channel (GEO, chatbot search queries) |
| G7 | Increase in-store visits: "wenn Leute in den Laden kommen haben wir schon gewonnen" (80–90 % closing rate in store). The industry suffers from a lack of footfall |

## 2. Business facts (stated by the customer)

| Topic | Value |
|---|---|
| Google Ads | 10,000 €/month → 12,000 campaign clicks → 80 % of the traffic |
| Performance Max | 1,000 €/month → 200 branch visits |
| Closing rate in store | 80–90 % |
| Margins | Schlafsysteme 80 %, Wasserbetten 50 %, Boxspring 20 % |
| Devices | 70 % mobile, 10 % PC (remaining 20 % not specified) |
| Sales logic | Advertise with cheap mattresses, sell the high-priced ones. A cheap offer brings people into the shop; there they buy at least something, which allows upselling |
| Search behaviour | "Boxspring" is searched often, even when something else is meant |
| Reason the company exists | "Riesen-Auswahl": every kind of bed and every price segment |

## 3. Target groups

| Group | Profile |
|---|---|
| Back-pain customer | Main customer, willing to spend more; must be picked up immediately with "Schmerzfreier Schlaf" |
| Lübeck | Older, often couples, regular customers ("ist meine letzte Matratze"), children help with the search; hardly any competition |
| Hamburg | More often single; more competition; the current site is oriented towards Hamburg |
| Kiel | There are still customers in Kiel |
| General | Customers say "schön dass es einen Fachhandel gibt" (USP). Regional presence + SILWA brand is "Gold wert" |

## 4. Requirements

### 4.1 Content and structure

| ID | Requirement | Status |
|---|---|---|
| C1 | URL structure stays the same | DECIDED |
| C2 | Remove Massagesessel | DECIDED |
| C3 | Remove Tempur | DECIDED |
| C4 | Bring the word "Riesen-Auswahl" back prominently (the live site writes "Riesenauswahl", e.g. home H2 "Riesenauswahl getestete Matratzen, …") | DECIDED |
| C5 | Make it clearer that there are both cheap and high-priced products | DECIDED |
| C6 | Place Pflegebetten further down (too expensive at about 3,000 €) | DECIDED |
| C7 | Update "Über uns" | DECIDED, text to be supplied by the customer |
| C8 | Highlight "Manufaktur" prominently (live site: "Wir sind eine Matratzen-Manufaktur.") | DECIDED |
| C9 | New copy "Schmerzfreier Schlaf" for back-pain customers (does not exist on the live site) | DECIDED, copy to be supplied/approved by the customer |

### 4.2 Home page

| ID | Requirement | Status |
|---|---|---|
| H1 | Remove the 5 images at the top of the home page | DECIDED |
| H2 | Customers must get to beds and prices quickly | DECIDED |
| H3 | Advertise with discounts | DECIDED |
| H4 | Mobile-optimised home page | DECIDED |
| H5 | Modals on the home page can be leaner | OPEN (incomplete note, see O2) |
| H6 | "Aktionstage" pop-up banner | DECIDED. PROPOSED: no full-screen pop-up on mobile (hurts Google Ads landing-page experience and CLS); use a banner or bar instead |
| H7 | Product categories are placed vertically on the home page | OPEN: current state or requirement? |
| H8 | Keep the "Binden" (vertical teasers) as eye-catchers for new products and topics (e.g. Pflegebetten, Boxbetten), linking to landing pages that can be measured (time on page) | DECIDED |
| H9 | Vertical "Binden" are not effective on mobile → a different format is needed on mobile | DECIDED |

### 4.3 Conversion

| ID | Requirement | Status |
|---|---|---|
| K1 | Make "Termin vereinbaren" more prominent | DECIDED |
| K2 | Mark the appointment as **optional**: customers can come without an appointment; a branch visit is also an important conversion | DECIDED |
| K3 | "Beratung anfragen" | OPEN (incomplete note, see O5) |
| K4 | Increase the attractiveness of the branches (directions, opening hours, store photos / 360° views) | PROPOSED |

### 4.4 Trust and USPs

| ID | Requirement | Status |
|---|---|---|
| T1 | The video about the consultation / Vermessung is the USP: every customer is measured. Place it very prominently | DECIDED |
| T2 | Present Google reviews and own reviews more prominently | DECIDED |
| T3 | Bug on the live site: the Google rating (hover button) is not shown on mobile. The new site must show it without hover | DECIDED |
| T4 | "Fachhandel" as USP (the live site already has the "Echter Fachhandel" seal) | DECIDED |
| T5 | Emphasise regional presence + the SILWA brand | DECIDED |
| T6 | Address Lübeck customers more strongly (the site currently leans towards Hamburg) | PROPOSED |

### 4.5 Navigation and design

| ID | Requirement | Status |
|---|---|---|
| D1 | Make the navigation more visible | DECIDED |
| D2 | Sticky navigation (currently not sticky) | DECIDED |
| D3 | Design: **the original prototype design** (as on the 3 prototype pages). None of the variants A/B/C was chosen | DECIDED |

### 4.6 Analytics and testing (phase 2)

| ID | Requirement | Status |
|---|---|---|
| A1 | Analytics: how visitors move through the site, where they drop off, what is never clicked | DECIDED |
| A2 | Measure scroll depth (not measured today) | DECIDED |
| A3 | A/B tests: high-priced vs. low-priced | DECIDED |
| A4 | Time on page of the "Binden" landing pages | DECIDED |
| A5 | Tracking only behind cookie consent; client-side tools only (static site) | PROPOSED |

### 4.7 Campaigns (phase 3)

| ID | Requirement | Status |
|---|---|---|
| M1 | Reduce wasted ad spend: show Ads only in selected regions / city districts and exclude others | DECIDED |
| M2 | Campaign landing pages: fast, mobile, clear CTA | DECIDED (part of the performance goal) |

### 4.8 Multiple web presences

The current set-up "feuert aus allen Kanonen" and confuses customers. Example: a customer searches "Boxspring", lands on
Lohmühle and does not find the Bettenhaus "Boxspringbetten.com".

| Presence | Target group / state |
|---|---|
| gesunde-matratzen.de | Mass market |
| boxspringbetten.com | Boxspring |
| pflege-betten.de | New presence |
| luxusbetten | Not working, hardly any customers come to the shop |
| Lohmühle | OPEN, see O6 |

Requirement: each presence has its own target group, campaigns and site (DECIDED). Scope of this project (only
gesunde-matratzen.de or more presences): OPEN.

### 4.9 Hosting and CMS

| ID | Topic | Status |
|---|---|---|
| B1 | Check a change of hosting provider ("365 Grad Hosting Dirk Jakobs") | OPEN |
| B2 | What would it mean to host all 5 presences elsewhere? | OPEN, offer needed |
| B3 | Can the hosting provider also host Storyblok and the website? Answer: Storyblok is SaaS and is hosted by Storyblok; the static site can run on any static host / CDN | Answer for the customer |
| B4 | Show how a new product is created (CMS workflow demo) | DECIDED |

## 5. Phases

| Phase | Content | Status |
|---|---|---|
| 1 | Port the content 1:1, with first design adjustments and small changes (sections 4.1–4.5) | DECIDED |
| 2 | A/B tests, analytics, possible improvements of the website (4.6) | DECIDED |
| 3 | Optimise campaign performance (4.7) | DECIDED |
| 4 | Agentic GEO and search queries from chatbots (G6) | DECIDED |

## 6. Impact on earlier decisions (AGENTS.md)

- **Content parity / "migrate as it is"**: C2, C3, C6, C9 and H1 change content. Interpretation (PROPOSED): these are the
  "small changes" of phase 1. Removed pages (Massagesessel, Tempur) need 301 redirects (SEO parity).
- **Design direction**: changed from OPEN to DECIDED (original prototype design; variants A/B/C not chosen). Q1 in
  [requirements-questions.md](./requirements-questions.md) is answered.

## 7. Open questions (incomplete notes)

| ID | Note | Question |
|---|---|---|
| O1 | "größte Seite" | Which page is meant (traffic, size, revenue)? |
| O2 | "Modals auf Startseite können schlanker (" | Which modals, and what should they look like? |
| O3 | "das findest du hier komprimiert auf Mobile" | Which content is meant? |
| O4 | "wenn es nichts günstiges gibt kommen die …" | Probably "…kommen die nicht"? |
| O5 | "Beratung anfragen -" | New CTA/form? Different from "Termin vereinbaren"? |
| O6 | "Lohmühle" | Own presence / brand, or the Lübeck branch (Bei der Lohmühle 21a)? |
| O7 | 1,100 € plugin costs | Per year or per month? |
| O8 | Hosting 200 € vs. 137 € | Which is current, per month or per year, for how many presences? |
| O9 | "alle 5" | Which 5 presences exactly? |
| O10 | "Wir" | Incomplete thought |
