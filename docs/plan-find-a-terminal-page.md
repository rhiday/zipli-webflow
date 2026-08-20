# Page requirement: Find a Terminal

Target file: `src/pages/find-a-terminal.html`. Supporting CSS lives in
`css/custom.css` under a new "FIND A TERMINAL" block, documented in
`src/pages/styleguide.html` under a new "Form" entry so the field styling is
reusable the next time a page needs a form.

## 1. Purpose

A restaurant lands here already convinced enough to check one thing: does
Zipli reach my city yet. The page has exactly one job, get that answer in
front of them fast, then turn a "yes" into a signed-up donor and a "not yet"
into a captured lead, in the same form.

Entry points: a "Find your nearest terminal" link under the kitchens.html
hero CTA (added as part of this build), and later the home page donor banner
referenced in the wireframe, which is not built yet and is out of scope
here.

## 2. Who is landing here and what they are thinking

A restaurant or kitchen manager, most likely following a link from the
kitchens page or a future donor banner. Their question is binary: is this
live where I am. They will not read paragraphs of copy first, so the lookup
has to be the first interactive thing on the page, not buried under a hero
statement the way the audience pages open.

## 3. Flow

1. **City lookup.** One input, one button. No page reload.
2. **Result.** Exactly one of two outcomes shows, never both at once:
   - **Terminal exists.** Confirms the city is live, states there is no
     setup fee and no long onboarding, and pushes toward the form with a
     "Become a Donor" CTA.
   - **No terminal yet.** Says so plainly, offers to notify them when Zipli
     launches nearby, and pushes toward the same form with a "Notify Me"
     CTA. Losing a visitor here because the answer is "not yet" is the
     single biggest conversion risk on this page, so the tone stays
     inviting, not apologetic.
   Both CTAs scroll to the same form. Splitting into two forms would mean
   building and maintaining two, for a difference the CRM follow-up can
   handle with one field.
3. **Objection handling.** A short FAQ sits between the result and the form,
   answering the three questions a restaurant asks before filling in
   contact details: is there a cost, how fast can they start, what happens
   if their city is not covered yet.
4. **The form.** Restaurant name, contact name, work email, phone (optional),
   city, and an optional note. Kept to what a CRM lead actually needs to
   follow up, every extra field is measurable drop-off. On submit, the page
   is mocked, no CRM is wired up yet, see section 5.

## 4. What is mocked and why

Per the brief, no real terminal directory exists yet. The city lookup checks
the typed city against a small hardcoded list of cities Zipli already
operates in (Helsinki, Espoo, Vantaa, via Stadin safka) and renders the
matching result panel. This is enough to demo the full flow and validate the
UI in both states. The open question flagged on the wireframe, whether this
becomes a real terminal directory with live data or a manually maintained
list, is a product decision for later and is not resolved by this build.

The form does not post anywhere. Submitting it swaps the form for a
confirmation message, so the interaction reads as complete without a
backend. The `<form>` carries a `data-crm-lead` marker so the field names are
easy to find when a real endpoint (HubSpot, Pipedrive, or a ziply-server
route) is wired up later.

## 5. Design system constraints

Nothing here invents a new visual language. Every block resolves to an
existing pattern or a small, documented extension of one:

- Hero: `.hero-wrapper.page`, same as every other subpage.
- Lookup bar: a new `.lookup-bar` component, same radius and mist fill as
  `.feature-card`, holding an input and a button.
- Result panels: `.feature-card` in `.lime` (success) and `.mist`
  (not yet) variants, the same pair the rest of the site already uses for
  a positive/neutral contrast.
- FAQ: the existing `.faq-list` accordion, unchanged.
- Form: new `.simple-form` field styles, built once here and written up in
  the styleguide so the next form on the site reuses it instead of
  reinventing it. Same radius language as everything else (`0.75em` fields,
  no borders, mist fill), the only new component this page introduces.
- CTA buttons on white or mist backgrounds need a variant of
  `.main-button` that is not invisible white-on-white. `.main-button.dark`
  (solid ink fill, white text) is added for this and is the only button
  variant this page introduces.

## 6. Non-goals

- No real terminal directory or map. Flagged for a later integration.
- No CRM integration. Flagged with `data-crm-lead` for later.
- No change to the main nav. Five items is already the tuned width, see
  `custom.css`'s nav gap comment. The page is reachable from kitchens.html
  and, later, the home page banner.
