# Browser-editable review mode

## Objective

A non-technical teammate needs to open the live marketing site in her browser,
edit page copy directly (click text, type), and have that edit actually save,
similar to how Webflow's edit mode works. She should not need git, a local
dev setup, or any tooling beyond a browser and a URL.

## Starting context (read this before touching anything)

This is a static site generator, not Webflow itself, despite living in a repo
called `zipli-webflow`. `build.mjs` stitches `src/pages/*.html` +
`src/partials/*.html` + one locale file per language
(`src/locales/en.json`, `src/locales/fi.json`) into a flat `dist/` folder.
There is no CMS, no database, and as of this writing no backend of any kind.

Key facts already confirmed, do not re-derive these:

- **Body copy is hardcoded per page, not templated.** `src/pages/*.html`
  contains literal English text directly in the markup. There are zero
  `{{t.}}` tokens inside any page file. The locale JSON files only drive nav,
  footer, and CTA labels through `src/partials/nav.html` and
  `src/partials/footer.html`. This means every English and Finnish page
  currently renders the same (untranslated) body copy, that is a separate,
  pre-existing gap, not something to fix here.
- Because body copy is not templated, an edit made on a rendered page maps
  to exactly one file: `src/pages/<name>.html`. No locale fan-out to worry
  about.
- **The repo is now on GitHub and deployed**, at
  `https://github.com/rhiday/zipli-webflow`, branch `main`. Step 1 below
  (push to GitHub) is done, confirm the Netlify connection (step 2) is
  wired up before assuming it is too.
- **There is no backend.** No Netlify functions, no `netlify.toml`, no
  serverless code anywhere in this repo.

## Decisions already made, do not re-litigate these

1. Persistence must be real, not a browser-local hack. Edits need to end up
   as git commits so they survive redeploys and are visible to Hasan, not
   just stuck in the teammate's browser `localStorage`.
2. Hosting: **Netlify**, connected to a GitHub repo, auto-deploy on push.
3. Branch flow: her saved edits commit **straight to `main`**. Hasan has
   accepted that this means an edit goes live on the next deploy with no
   review step in between. Every edit is still an individual git commit, so
   a bad one is a one-line `git revert`, not a scramble. Do not add a PR or
   preview-branch step, that was considered and explicitly turned down.
4. No custom server or serverless function. Commits happen by calling the
   GitHub Contents API directly from client-side JS in the browser, using a
   Personal Access Token the teammate pastes in once and that persists in
   her browser's `localStorage`. Scope that PAT to this one repo only, with
   contents read/write permission, nothing broader. This is an internal
   tool on a URL that is not linked publicly, that is the accepted tradeoff
   for keeping this backend-free.

## What needs to be built

### 1. Push this repo to GitHub — done

Repo is live at `https://github.com/rhiday/zipli-webflow`, `main` branch.
Nothing to do here.

### 2. Connect Netlify — done

Confirmed live at `zipli-webflow.netlify.app`, deploying from GitHub,
production branch `main`, auto-publishing on push (currently published at
commit `a7ea7ec`, matching the repo's `main`). Nothing to do here.

One thing this surfaces: the GitHub repo is **Public**. The PAT the teammate
pastes into the edit tool (step 4) needs to be scoped tightly, contents
read/write on this one repo only, since a public repo means anyone who got
hold of that token could push to it, not just people who already have
access.

Hasan is logged into Netlify in his browser already, so if step 5's
verification needs a dashboard check (deploy log, build settings, confirming
a new deploy actually triggered), ask him to check it directly rather than
asking for credentials or a Netlify API token.

### 3. `build.mjs`: stable per-element edit IDs

Rendered `dist/` HTML is not byte-identical to the source `src/pages/*.html`
file (partials get inlined, `{{base}}` and other tokens get resolved), so a
naive "find this text and replace it" approach will break on duplicate
phrases or whitespace differences. Add a build step that stamps a stable
`data-edit="<id>"` attribute onto text-bearing elements (headings,
paragraphs, list items, button/link labels, etc.) as pages are processed, so
the same ID exists in both the rendered output the teammate sees and the
source file the edit needs to land in. IDs should be stable across rebuilds
(for example, derived from position within the page, not randomly
generated), so re-saving after a normal content update does not shift every
ID out from under existing edits.

Keep this scoped to elements that plausibly hold editable prose. Do not tag
structural wrappers, nav/footer (those come from locale JSON, out of scope
for this tool), or SVG/icon markup.

### 4. Edit-mode client script

A script that activates when the page is loaded with `?edit=1` (or similar),
and:

- Makes every `[data-edit]` element `contenteditable`.
- On first use, prompts for a GitHub PAT and stores it in `localStorage`.
- Gives some visible affordance for "save" (a button, not autosave-on-blur,
  so a stray click cannot accidentally trigger a commit).
- On save, reads the current text of each edited `[data-edit]` element,
  looks up the corresponding source file (`src/pages/<name>.html`, derived
  from the current page path), locates the same `data-edit` id in that
  source file, replaces its inner text, and commits the change to `main` via
  the GitHub Contents API (get current file SHA, PUT updated content).
- Give clear success/failure feedback in the UI. A failed commit (bad token,
  network error, id not found in source) must not silently look like it
  saved.

### 5. Manual verification checklist before calling this done

- Edit a heading and a paragraph on one page, save, confirm the commit shows
  up on GitHub with the correct diff against the right source file.
- Confirm Netlify picks up that commit and redeploys, and the live site now
  shows the edited copy.
- Reload the edit page after saving, confirm it now shows the new text (not
  stale cached copy).
- Try editing the same page from a second browser/profile with no PAT saved
  yet, confirm it prompts for one rather than failing silently.
- Confirm elements outside `[data-edit]` (nav, footer, icons) are not
  editable and are untouched by the save flow.

## Explicitly out of scope

- Translating the Finnish pages or wiring body copy through the locale JSON.
  Pre-existing gap, unrelated to this task.
- Any PR/preview-branch review step, that was considered and rejected.
- Any dedicated backend/serverless function. If the GitHub Contents API
  approach turns out to be unworkable directly from the browser (rate
  limits, CORS, whatever), stop and flag that back rather than quietly
  standing up a server, since that changes the "no backend" premise this
  plan was scoped around.

## House rules that still apply

From the workspace `CLAUDE.md`: branch for real feature work rather than
committing straight to `main` while building this out (the "commits go
straight to main" decision above is about the teammate's *saved edits* once
this is live, not about how you build the tool itself). No AI co-author
trailers on commits. No em dashes in commit messages, docs, or PR text.
