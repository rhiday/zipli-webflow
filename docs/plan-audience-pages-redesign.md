# Plan: richer content and layout for the three audience pages

Written for whoever picks this up next (recommended: run it with Opus in a
design/UX-focused mode). Target files: `src/pages/kitchens.html`,
`src/pages/management.html`, `src/pages/terminals.html`, plus a new pricing
component in `css/custom.css` documented in `src/pages/styleguide.html`.

Read `src/pages/styleguide.html` in full before starting. It is the contract:
every visual decision below should resolve to a class that already exists
there, or a new one built in the same idiom (large 2.5em radius, flat pastel
fills, no borders or shadows, Space Grotesk display type, everything sized in
em). The two most recent additions to that system, `.pull-quote.small` and
`.photo-placeholder`, are worth reading as a model for how to extend it
without breaking consistency.

## 1. The content reality, read this before writing any copy

Two sources were checked for content the three pages are missing:

- The older Webflow draft at
  `/Users/rhiday/Developer/archive/zipli-archive/Zipli webflow/`
  (English versions: `en/kitchens.html`, `en/management.html`,
  `en/terminals.html`, plus the top-level `pricing.html`).
- The deck `Shared_v.0.1_Tietoa Ziplistä ja käyttöönotto-ohjeet_17.8.2026.pptx`.

The finding: **there is almost no unused marketing copy left**. The current
kitchens and terminals pages are already line-for-line ports of the archive's
English versions, and the pptx's every reusable claim (the six kitchen
features, the trial testimonials and stats, the four-step process, the food
safety rules) is already live on the current site, mostly on
`kitchens.html` and `how-it-works.html`.

This changes what "richer" has to mean here. It is not a copy-mining
exercise, it is two things:

1. **One genuinely new content block: pricing.** None of the three pages
   currently show pricing. The data exists (see section 3) and needs a new
   component.
2. **Better presentation of what is already there.** Each page currently
   reads as one flat run of section-header-plus-grid blocks in the same
   rhythm. The job is to break that rhythm with the layout components that
   already exist in the styleguide but are under-used on these three pages
   (`step-list`, `media-split`, `logo-cloud`, `faq-list`, `pull-quote`), not
   to write new claims.

**Hard rule: do not invent facts.** No new stats, testimonials, logos, or
claims beyond what is already live on the current site, in
`en/kitchens.html` / `en/management.html` / `en/terminals.html`, or in the
pptx. If a section idea below needs a fact that does not exist anywhere in
those sources, either drop the section or flag it back rather than making one
up.

## 2. Do not use these files

Five files in the archive are from an earlier, unrelated positioning of the
company (food manufacturers and redistribution hubs, ERP integrations,
white-label, enterprise SaaS price points in the thousands of euros a month).
They predate the current Helsinki-kitchens-and-terminals product and do not
describe it:

- `pricing.html` (top level, not `en/`)
- `product.html`
- `industries.html`
- `why-zipli.html`
- `resources.html`

None of these should feed any of the three pages, especially not pricing.
The only real pricing source is the table embedded inside
`en/management.html`, detailed below.

## 3. The pricing component (new)

This is the one piece of net-new content work. It needs a new component,
because nothing in the styleguide currently renders a multi-column plan
comparison. Build it, then add a documented example to `styleguide.html`
following the existing pattern (a `sg-label`, a short note, a live example,
a copyable markup block).

**Visual language to match:** price figure styled like `.stat-number`
(Space Grotesk 500, tight line-height, negative tracking, in em). Plan card
styled like `.feature-card` (2.5em radius, flat fill, no border/shadow). One
tier can carry a `.lime` or accent treatment to read as the recommended
plan, the same way `.feature-card.lime` already marks a highlighted card
elsewhere. Collapse behaviour should follow the same breakpoints as
`.layout-grid`: full row at desktop, roughly half at tablet, one column at
767px, so it does not need its own bespoke media queries if it is built on
top of `.layout-grid`.

**The three pages need three different treatments, not one shared table:**

### Management: full 6-tier table
This is the only page with complete pricing data. Source: `en/management.html`
(dated in the same August batch as the current live pages, so treat as
current, not stale).

| Plan | Sites | Price | What changes |
|---|---|---|---|
| Free | 1 site | €0/site/mo | Logging and donation via the app; one site's basic data; no data platform |
| Mini | 1 to 3 sites | €87/site/mo | Connects sites to one data platform; site comparison, optimisation and comms |
| S | 4 to 10 sites | €83/site/mo | + 2 extra user seats; named account manager |
| M | 11 to 25 sites | €76/site/mo | + 3 extra user seats; user feedback from recipients |
| L | 26 to 50 sites | €68/site/mo | + 5 extra user seats; tailored onboarding |
| Enterprise | 51+ sites | Ask for a quote | Unlimited extra user seats; SLA agreement, strategy reviews, named customer success team |

Framing line above the table (source copy): "Pricing: start free, grow step
by step." Footnote: "Billed monthly or annually per agreement. Sold
separately, get in touch and we will book a demo."

Placement: after the CSRD/ESRS media-split, before the closing CTA band,
matching where the archive put it.

Layout idea beyond a flat table: consider pairing the table with a short
`step-list` above it that narrates Free to Enterprise as a growth path (one
step per tier, using the tier name and site count as the step title) before
the detailed table. That reuses an existing component for a second purpose
and breaks up what would otherwise be a wall of numbers.

### Kitchens: single free-tier callout, not a table
Kitchens are the donor side and are already free via Stadin Safka; the
current page already states this in one line ("Free of charge for donor
restaurants via Stadin safka"). A six-column table would be the wrong shape
here and would imply the kitchen side has tiers, which it does not.

Build this as one wide `feature-card` (or a small two-column layout, price
on one side, what is included on the other), reusing the Free row from the
table above: "Free, 1 site, €0/site/mo, logging and donation via the app."
Keep the existing one-line statement too, do not remove it, this becomes its
expanded version.

### Terminals: no real numbers exist, do not fabricate a table
Both the current live page and the archive draft say the same thing in
their own words: terminal pricing is not locked yet. There is no source
anywhere (archive, pptx, current site) with a terminal price point.

Do not build a pricing table for this page. Instead, style a "pricing note"
block that reads as deliberate rather than missing: a single card, same
visual family as the plan cards on the other two pages so it is recognisably
part of the same pricing story sitewide, but with the content being "Custom,
based on your terminal's volume" or the existing CTA line ("Terminal
pricing is not locked yet, let us talk about what you actually need") set in
the same price-figure type treatment as a placeholder would use. Do not
invent a number to fill the slot.

## 4. Layout variation, page by page

The goal is that someone clicking Kitchens, then Management, then Terminals
in a row feels three distinct pages built from one consistent system, not
one page repeated three times with the nouns swapped. Current section
rhythm on all three is: hero, section-header, grid, (maybe stat band),
CTA. Break that.

### Kitchens (currently: hero, 6-card grid, stat band + 4 testimonial cards, CTA)
- Add the free-tier pricing callout from section 3, placed after the
  6-card feature grid.
- Consider splitting the 6-card grid into two groups of 3 with a short
  divider (a `step-list` of "photo, in seconds, no more calls" using the
  three ideas that already anchor the page, or a `media-split` with a phone
  screenshot if one is available in `images/app-home-before-log.png` or
  `images/app-home-after-log.png`, which already exist and are used on
  `how-it-works.html`), so the page is not one flat 6-up grid.
- The testimonial section is already good and does not need new copy, but
  consider whether all four need to be `feature-card white` in a 2-up grid,
  or whether 2 to 3 of the strongest as `pull-quote` (larger, one at a time)
  plus the rest as compact cards reads better. Do not drop any of the four
  quotes, only consider changing how they are grouped.
- Optional: a small FAQ accordion, 2 to 3 questions, only using facts
  already established on this or another current page (e.g. "Is it really
  free?" answered with the Stadin Safka line, "What if we have more than one
  site?" answered by pointing to Management). No invented answers.

### Management (currently: hero, 4-card grid, dark stat band, media-split, CTA)
- Add the full pricing table from section 3 as the new centrepiece section,
  in the position the archive used it (after the CSRD media-split, before
  the CTA).
- Add a `logo-cloud` for credibility. Only `images/logos/city-of-helsinki.png`
  and `images/logos/eu-co-funded.png` exist as real assets today (used
  already on `about.html`); do not add placeholder logos for Sodexo, Etappi,
  or funders without an actual mark on file. If only one relevant mark
  exists, a one-logo row is fine, or skip this addition if it feels thin
  with just one mark.
- Consider whether the existing dark stat band (21M tonnes, 100% CSRD) and
  the new pricing section both work better if one of them is not on a
  black background, so the page does not read as three tonal snaps
  (light, dark, light, pricing, light). Alternate deliberately.

### Terminals (currently: hero, 2-card challenge/solution grid, 3-card grid, CTA)
This is the thinnest page and needs the most work, with the least new copy
available. Options that use only existing facts:
- Add the pricing note block from section 3.
- Add a `step-list` reframing the batch lifecycle from the terminal's side:
  batch arrives in real time, structured recipient match, pickup and
  outcome tracked. This is the same underlying process already described in
  `how-it-works.html`'s four steps (Logging, Matching, Pickup, Impact), so
  write it as the terminal's view of the same process rather than
  duplicating that page's copy verbatim, three steps not four, since the
  Logging step is not the terminal's own action.
- Add a small FAQ accordion for terminal-specific questions grounded in what
  is already known: pricing is not locked yet, how batches appear in real
  time, whether existing spreadsheets need to be kept in parallel (no).
- If none of the above is enough to make the page feel complete without
  inventing content, that is an acceptable outcome to report back rather
  than force. Terminals may end up shorter than the other two pages on
  merit, since less validated content exists for it (the archive draft
  itself is flagged "based on FAIR EDIH audit notes, not yet validated the
  way Kitchens and Management are").

## 5. Guardrails

- Reuse the styleguide's tokens and components. Any new CSS goes in
  `css/custom.css` only, never in `zipli.webflow.css` or `webflow.css`
  (those are Webflow export output and get overwritten on a re-export).
- Everything in em, per "The em rule" section of the styleguide. No new
  fixed-pixel sizes.
- No new colours. Use the existing `--zipli-*` custom properties.
- Document every new component (the pricing table, the pricing-note card,
  and anything else new) in `styleguide.html`, in the same format as the
  existing entries: a label, a short note explaining what it generalises
  and why, a live example, a copyable markup block.
- After each page, run `node build.mjs` then `node audit.mjs` from the repo
  root and confirm 0 errors (warnings that already exist in
  `zipli.webflow.css` are fine and expected, do not fix those, they are
  vendor output).
- Browser-check each finished page at a normal desktop width and at mobile
  width before calling it done. A static screenshot is not enough, actually
  scroll it.
- Test after each page, not once at the end. Finish Terminals, check it,
  then move to Management, then Kitchens. Do not batch all three and test
  once.
- This repo is not currently a git repository, so there is no branch or PR
  step blocking this work today. If that changes before this plan is
  picked up, branch first per the workspace's usual rule.
- No em dashes in any written copy this work produces (headings, cards, FAQ
  answers). The existing site already uses `&mdash;` in a small number of
  places in older body copy; that is a pre-existing exception, not licence
  to add more.

## 6. Suggested order

1. Build the pricing component (table + free-tier callout + pricing-note
   card variants) and document it in `styleguide.html` first, before
   touching any of the three pages, so all three can pull from one settled
   component.
2. Terminals (thinnest, most layout work, least content risk since almost
   nothing there is copy-sensitive).
3. Management (add the full pricing table, the highest-value single
   addition across all three pages).
4. Kitchens (smallest change: free-tier callout plus optional regrouping
   of the existing six-card grid).
5. Finish with a side-by-side pass: open all three pages and check spacing,
   section rhythm, and tone read as one consistent system rather than
   three separately-designed pages.
