# Zipli marketing site

The public marketing site. It started as a Webflow export and is now built from
partials by a small Node script, so pages share one navbar, one footer and one
head, and every page is produced once per language.

## Running it

```
npm run dev      # build, serve on http://localhost:3456, rebuild on save
npm run build    # build once into dist/
```

No dependencies to install. It uses only the Node standard library, Node 20 or
newer.

`dist/` is the deployable folder. It is plain static files, so it can be dropped
on Netlify, Cloudflare Pages, Vercel, GitHub Pages or any bucket behind a CDN.
`dist/` is gitignored, build it in CI rather than committing it.

## Where things are

```
archive/         the original Webflow export, reference only, never built
src/pages/       one file per page, this is what you edit
src/partials/    head, nav, footer, logo, scripts, video modal
src/locales/     one JSON file per language, holds the shared strings
css/custom.css   our CSS, loaded last so it wins
css/*.webflow.css, js/webflow.js, images/, fonts/   Webflow output
build.mjs        the build
audit.mjs        the unit consistency audit
```

Open `/styleguide.html` in the dev server first. It shows every heading, button,
colour and the section skeleton, using the classes that already exist. Build new
pages out of those rather than inventing new ones.

## The rule about Webflow files

`css/normalize.css`, `css/webflow.css`, `css/zipli.webflow.css` and
`js/webflow.js` are Webflow output. Never edit them by hand. If someone
re-exports from Webflow, those four files get overwritten and any edit in them is
lost. Put all of our own CSS in `css/custom.css`, which loads after them and
therefore wins.

There is exactly one exception: `npm run audit:fix` rewrites `rem` to `em` in
`zipli.webflow.css`. That is allowed because it is reproducible. After any
re-export, run `npm run audit` and then `npm run audit:fix` to reapply it. Do not
make any other edit to that file, because nothing else is reproducible.

## The scaling trick, do not break this

Webflow sizes this site fluidly. `src/partials/global-style.html` sets:

```
body { font-size: 0.8333333333333334vw }
```

so above 991px `1em` is 1/120th of the viewport width and the entire layout
scales with the browser window. Below 991px it locks to 16px. Almost every value
in the Webflow CSS is in `em` because of this.

Two consequences:

1. Every page must include `{{> global-style}}`. Leave it out and the page will
   silently render at a different scale to the rest of the site.
2. Size new work in `em`, not `px`. A `px` value will not scale and will drift
   out of alignment as the window changes.

## The sitemap

Carried over from the previous draft in
`archive/zipli-archive/Zipli webflow`. That folder is the source of truth for
copy that has not been rebuilt yet, so read it before writing anything new for
one of the pending pages.

| Page | File | Status |
|---|---|---|
| Home | `src/pages/index.html` | Built |
| Kitchens | `src/pages/kitchens.html` | Built |
| Management | `src/pages/management.html` | Built |
| Terminals | `src/pages/terminals.html` | Built, copy is still a draft |
| How it works | `src/pages/how-it-works.html` | Built |
| Team | pending | Copy exists in the archive as `en/team.html` |
| Demo | pending | Copy exists in the archive as `en/demo.html` |
| Blog | `src/pages/blog/` | Built, 15 posts across 5 themes plus `/blog/` index |
| Privacy policy | pending | Archive `tietosuoja.html` |
| Terms of use | pending | Archive `kayttoehdot.html` |
| Styleguide | `src/pages/styleguide.html` | Internal, noindex, not in the sitemap |

The nav carries the three audience pages plus How it works and Contact. How it
works now points to its own page; Contact is still an anchor into the home
page.

Two things to know before picking up a pending page:

- **Terminals copy is not validated.** The archive page carried a visible note
  saying it was drafted from FAIR EDIH audit notes and had not been checked the
  way Kitchens and Management were. That is still true, the rebuilt page just
  does not say so on the page itself.
- **Pricing is now public**, resolving the question this file used to raise.
  The archive Management page's six-tier table (Free, Mini, S, M, L,
  Enterprise) is live on `management.html`, built on the `.plan-card`
  component. Kitchens shows the free tier only, because the donor side has no
  tiers, and Terminals shows a "not locked yet" card rather than a number,
  because no terminal price point exists in any source. If a figure changes,
  it changes in `src/pages/management.html`; nothing reads it from anywhere
  else.

## Adding a page

Copy `src/pages/index.html`, keep the front matter block and the includes, and
replace what is inside `.main-wrapper`. Front matter is a leading HTML comment:

```html
<!-- meta
title: Page title in English
description: Meta description in English
title.fi: Sivun otsikko suomeksi
description.fi: Kuvaus suomeksi
-->
```

`title` and `description` are the fallback, `title.fi` and `description.fi`
override them when the Finnish copy is built. The build handles the canonical
tag, the hreflang tags and the sitemap entry for you.

## Template syntax

| Syntax | What it does |
|---|---|
| `{{> nav}}` | inserts `src/partials/nav.html` |
| `{{> logo logoClass="logo-svg" logoId="nav"}}` | include with local variables |
| `{{t.cta.dashboard}}` | a string from the current locale file |
| `{{base}}` | path back to the site root, use it on every `css/`, `js/`, `images/` and `fonts/` reference |
| `{{page.title}}` | front matter from the page |

`{{base}}` is empty for English and `../` for Finnish, because Finnish pages sit
one folder deep. Links between pages need no prefix, since each locale's pages
all live in the same folder as each other.

Unresolved variables print a warning during the build rather than failing, so
watch the build output.

## Languages

`src/locales/en.json` is the source of truth for structure. To add a language,
copy it to `src/locales/sv.json` and translate the values. The build picks it up
automatically: it produces `dist/sv/`, adds the language to every page's hreflang
set, adds a switcher link to the navbar, and adds the URLs to the sitemap.

English is the default locale and sits at the site root. Set `site.defaultLocale`
in `build.mjs` to change that.

Only shared chrome (nav labels, CTA text, footer) is translated through the
locale files today. Page body copy is still English in both builds. When Finnish
body copy exists, either move those strings into the locale files or add
`src/pages/fi/` overrides, depending on how different the pages need to be.

Note that the navbar is sized for short English words. Long Finnish labels get a
tighter override in `custom.css`, scoped with `html:not([lang="en"])` so the
English layout stays exactly what Webflow shipped. If a language has even longer
words, that override is where to adjust it.

## Client-First

This project follows [Client-First](https://finsweet.com/client-first). The
Webflow export already shipped part of it (`padding-global`, `main-container`,
the `padding-{size}` spacers, `text-size-small`, `text-color-*`), and
`css/custom.css` fills in the tiers that were missing. Open `/styleguide.html`
to see the whole scale rendered.

Four rules, in priority order:

1. **Use a utility before you write a class.** If a spacer, max width or text
   utility does the job, use it. New classes are for genuinely new components.
2. **Every section uses the same three levels.** `section` wraps
   `.padding-global` (side gutter) wraps `.main-container` (max width). Vertical
   space comes from spacers or `.padding-section-*` inside that. Never put side
   padding on a container or a max width on a section.
3. **Space with spacers, not margins.** A spacer is an empty div that sets
   `padding-top` only, so two adjacent blocks always have exactly one predictable
   gap and nothing collapses.
4. **Everything in `em`, never `px` or `rem`.** See below. This is the one that
   silently breaks things.

### Why em and not rem

`body` is set to `0.8333vw`, so above 991px `1em` is 1/120th of the viewport
width and the layout scales with the window. But `html` is never given a
font-size, so it stays at the browser default of 16px, which means `rem` does
**not** scale. Mixing the two gives you elements that hold a fixed size while
everything around them grows.

### Known issues in the inherited CSS

Two things the export left behind. Neither is fixed, because each changes how
the current home page renders, so they are decisions rather than cleanups.

(The `rem`-at-desktop-scope problem that used to be listed here **has** been
fixed: all 15 rules were converted and `npm run audit` reports 0 errors. The 16
`rem` values still in `zipli.webflow.css` all sit inside a `max-width: 991px`
media query or narrower, where the body font-size is pinned to 16px and `rem`
and `em` are identical, so they are harmless.)

- **The spacer scale has a flat spot.** `.padding-small` is 2.5em and
  `.padding-medium` is 3em, close enough to be interchangeable, then medium to
  large jumps 3em to 5.5em. Worth re-spacing, but it shifts the home page.
- **`h1` is set in fixed pixels**, at `font-size: 100px`, `line-height: 97px`
  and `letter-spacing: -8px`. It is the one place the site opts out of the
  scaling rule, and it is the largest type on the page, so it is also the most
  visible place to opt out: the hero headline holds one size while the layout
  around it grows and shrinks, reading proportionally large at 1200px and small
  at 1900px. Converting it to em is a one-line change but it visibly redraws the
  hero at most widths, so it is a design call rather than a cleanup and it stays
  as-is until someone makes it. Do not copy the pattern into new work.

### Layout grids

Before this layer existed the stylesheet contained exactly two
`grid-template-columns` declarations, both one-off, so every multi-column
section hand-rolled its own grid. `.layout-grid` is the reusable version. The
base class carries the display and the gap, a combo class carries the column
count, which matches the pattern the export already uses in
`.b2b-solution-card.reverse` and `.main-container.new-home`.

```html
<div class="layout-grid cols-3"> ... </div>
```

Columns: `.cols-2`, `.cols-3`, `.cols-4`, `.cols-sidebar` (1fr 2fr),
`.cols-sidebar-end` (2fr 1fr), `.cols-auto` (as many 18em columns as fit).
Gap defaults to 2em, override with `.gap-small`, `.gap-large`, `.gap-xlarge`.
Vertical alignment is `.items-start` and `.items-center`, named that way
because `.align-center` was already taken and means margin auto.

Collapse is at the site's own breakpoints: at 991px three and four columns
become two and the sidebar pair becomes one, at 767px everything becomes one
column. That is the same behaviour the home page four-up already had.

### Components

`css/custom.css` also carries a small component layer. Every component in it is
**extracted from a pattern the home page already uses**, not invented, and each
one names the Webflow class it generalises in a comment above it. That is
deliberate: the guide is meant to describe the site we have rather than
introduce a second, parallel design language alongside it.

| Class | Generalises | What it is |
|---|---|---|
| `.section-header` | ad-hoc, rebuilt per section | eyebrow, heading and lede as one unit |
| `.feature-card` | `.how-can-we-help-card` | the icon card from the four-up, with swappable fill |
| `.media-split` | `.b2b-solution-card` | alternating image-and-text row, `.reverse` flips it |
| `.step-list` | `.how-it-work-timeline-card` | numbered circle beside a title |
| `.pull-quote` | `.project-manager-quate` | large light quote with attribution |
| `.person-card` | the CTA contact pair | portrait, name, role, contact link |

Three traits are shared across all of them, taken from the export rather than
from a component library: a large `2.5em` radius rather than the 8 to 12px most
libraries default to, flat pastel fills with no borders and no shadows, and
large light display type at weight 300 to 500 rather than bold. If you add a
component, match those three or it will read as belonging to a different site.

Two notes. All modifier classes (`.lime`, `.reverse`, `.dark`, `.on-dark` and
so on) are written as combo selectors scoped to their base class, never bare, so
they cannot collide with the export; `.reverse` in particular already exists as
`.b2b-solution-card.reverse` and is untouched. And `.pull-quote` resets
`border-left` and `padding`, because Webflow's base stylesheet gives every
`blockquote` a 5px grey border and fixed px padding (`webflow.css:268`).

### Components, tier 2

The stat band and the image card extend patterns the export already had. The
logo cloud, the accordion and the CTA band are new, because the export has no
precedent for them, so they are built from the same three traits as everything
above.

| Class | What it is |
|---|---|
| `.stat-band` | big figures with labels, number styling taken from `.box-title` |
| `.logo-cloud` | partner and funder marks, sized by height so they share one optical line |
| `.faq-item` | accordion on `<details>`/`<summary>`, no JavaScript |
| `.feature-card.image-card` | the feature card with a photo instead of an icon |
| `.cta-band` | closing call to action, lime by default |

Two things worth knowing. The accordion's plus becomes a minus by collapsing one
of two gradient layers to zero height, **not** by rotating the box, because a
plus turned a quarter turn is still a plus. And `.logo-cloud.on-dark` works by
inverting the image, so it is only safe on a single-colour mark; on the EU flag
it would turn the blue orange, which is a trademark problem rather than a
styling one.

The logo cloud also deliberately has no greyscale-to-colour hover. That effect
is the clearest single tell of a template site.

## Images

Images are sorted by what they are, so a photograph can be found by name instead
of by opening every file.

```
images/people/    portraits, named after the person
images/logos/     partner and funder marks
images/           product shots, UI, icons, favicons
```

Portraits are named after the person, lowercase and hyphenated, and the Webflow
responsive variants keep their `-p-500` style suffix so the existing `srcset`
pattern still works: `people/ninja-fedy.png` alongside `people/ninja-fedy-p-500.png`
and so on. Before this, the CTO's headshot was called
`Screenshot-2025-05-19-at-0.23.56.png`, which is the reason the folder exists.

Current contents: `people/ninja-fedy`, `people/hasan-shahriar`,
`people/heta-hyvarinen`, `logos/city-of-helsinki`, `logos/eu-co-funded`.

**Alt text.** Every portrait and logo in the export shipped with `alt=""`, which
tells a screen reader to skip it. That is right for decoration and wrong for a
photograph of a named person or an organisation's mark, so all five now carry
real alt text. Give any new portrait the person's name.

### Naming

Client-First names describe what a thing *is*, not what it looks like, and use
lowercase with hyphens. The export is mostly consistent with this. Two carried-over
oddities to be aware of rather than to copy: `.footer_component` and
`.footer_links` use underscores, and there are leftover Webflow auto-names
(`.div-block-3`, `.div-block-5`, `.box-one`, `.box-two`). Do not add more of
either. Also note `.reciver-*` is a misspelling of "receiver" that appears in
several class names, so search for both spellings.

## The unit audit

```
npm run audit       report findings
npm run audit:fix   rewrite the safe ones (rem -> em) in place
```

`audit.mjs` reads `zipli.webflow.css` and `custom.css` and reports three levels.
It only flags rules that apply between 992px and 1919px, because below 992px and
at 1920px and up the body font-size is pinned to 16px, so `rem` and `em` are
identical there and the problem does not exist.

| Level | Meaning |
|---|---|
| ERROR | Will not scale. A `rem` on a layout property, or one declaration mixing `em` with `rem` or `px`. `--fix` handles these. |
| WARN | A fixed `px` value over 2px on a property that should scale. Needs a human, since some are deliberate. |
| INFO | Off-scale spacer values, and `px` in places that are neither layout nor hairlines. |

Only ERROR is auto-fixable. WARN and INFO are for reading, because a `px` value
is sometimes correct and the script cannot tell intent.

Run this after any Webflow re-export, and before opening a PR that touches CSS.

### What the first run found and fixed

15 rules used `rem` on desktop, so they held a fixed size while everything around
them scaled. Measured at a 1417px viewport, where `1em` is 11.81px:

| | Before | After |
|---|---|---|
| `.text-size-small` font-size | 14px | 10.33px |
| `.text-size-small` line-height | 19.2px | 12.40px |
| `.footer_component` row-gap | 48px | 35.43px |
| `.footer_links-wrapper` column-gap | 46px | 33.95px |
| `.footer_others` padding-top | 16px | 11.81px |

Everything affected was roughly 35% oversized in that band. `.footer_component`
padding-top measured 70.85px before and after, because it was already in `em`,
which is a useful control on the numbers above.

One consequence worth knowing: the footer small text now genuinely is small at
mid widths, because it scales like everything else instead of holding at 14px.
That is the system working as designed, but if it reads as too small, the fix is
to raise `.text-size-small` from `0.875em` rather than to put the `rem` back.

## Deploying

Build, then upload `dist/`. Recommended host config:

- Serve `dist/` as the site root.
- Cache `css/`, `js/`, `images/` and `fonts/` for a long time, and HTML for a
  short time. The asset filenames are not content-hashed, so if you change an
  image without renaming it you will need to purge the CDN cache.
- Serve the fonts with `Access-Control-Allow-Origin` if assets end up on a
  different domain to the pages.
- Update `site.origin` in `build.mjs` if the domain ever changes. It feeds the
  canonical tags, the hreflang tags and the sitemap.
