// Static site build for the Zipli marketing site.
// Stitches src/pages/*.html together with src/partials/*.html and one locale
// file per language, then writes a flat, deployable dist/.
//
//   node build.mjs          build once into dist/
//   node build.mjs --serve  build, then serve dist/ and rebuild on change
//
// Template syntax used in pages and partials:
//   {{> name key="value"}}  include src/partials/name.html, with local vars
//   {{t.cta.dashboard}}     look up a string in the current locale file
//   {{base}}                path back to the site root, for css/js/images
//   {{page.title}}          front matter from the top of the page file

import { readFile, writeFile, mkdir, readdir, rm, cp } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { stampEditIds } from "./js/edit-ids.mjs";

const ROOT = import.meta.dirname;
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "dist");

const site = {
  origin: "https://www.getzipli.com",
  defaultLocale: "en",
};

// Static assets copied verbatim. Everything here is referenced with {{base}}.
const ASSETS = ["css", "js", "images", "fonts"];

// Pages kept out of the sitemap and given a robots noindex meta tag. Home,
// About, and the blog are the only pages we're going live with for now; the
// rest still build (direct links and the edit-mode flow keep working) but
// stay out of nav and out of Google.
const noindex = new Set([
  "styleguide.html",
  "why-zipli.html",
  "product.html",
  "terminals-hubs.html",
  "catering-chains.html",
  "resources.html",
  "pricing.html",
  "find-a-terminal.html",
]);

const read = (p) => readFile(p, "utf8");

// Front matter is a leading HTML comment holding one key: value pair per line.
// Kept as a comment so the raw page file still opens in a browser.
function parseFrontMatter(raw) {
  const m = raw.match(/^\s*<!--\s*meta\n([\s\S]*?)-->\s*/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^\s*([\w.]+)\s*:\s*(.*?)\s*$/);
    if (kv) meta[kv[1]] = kv[2];
  }
  return { meta, body: raw.slice(m[0].length) };
}

function lookup(obj, dotted) {
  return dotted.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

const partialCache = new Map();
async function partial(name) {
  if (!partialCache.has(name)) {
    partialCache.set(name, await read(path.join(SRC, "partials", `${name}.html`)));
  }
  return partialCache.get(name);
}

// Resolves {{> name key="value"}} includes, depth-limited so a partial that
// includes itself fails loudly instead of hanging the build.
async function resolveIncludes(tpl, depth = 0) {
  if (depth > 10) throw new Error("Include nesting too deep, check for a cycle");
  const re = /\{\{>\s*([\w-]+)([^}]*)\}\}/g;
  let out = "";
  let last = 0;
  for (const m of tpl.matchAll(re)) {
    out += tpl.slice(last, m.index);
    let inner = await partial(m[1]);
    for (const a of m[2].matchAll(/([\w.]+)="([^"]*)"/g)) {
      inner = inner.replaceAll(`{{${a[1]}}}`, a[2]);
    }
    out += await resolveIncludes(inner, depth + 1);
    last = m.index + m[0].length;
  }
  return out + tpl.slice(last);
}

function fill(tpl, ctx) {
  return tpl.replace(/\{\{([\w.]+)\}\}/g, (whole, key) => {
    const v = lookup(ctx, key);
    if (v === undefined) {
      console.warn(`  warn: unresolved {{${key}}}`);
      return "";
    }
    // Pre-rendered HTML fragments are trusted, plain strings are escaped.
    return key === "hreflang" || key.endsWith("Links") || key === "langSwitch" ||
      key === "robotsMeta"
      ? v
      : escapeHtml(v);
  });
}

async function build() {
  const localeFiles = (await readdir(path.join(SRC, "locales")))
    .filter((f) => f.endsWith(".json"));
  const locales = {};
  for (const f of localeFiles) {
    locales[path.basename(f, ".json")] = JSON.parse(
      await read(path.join(SRC, "locales", f)));
  }
  const codes = Object.keys(locales).sort(
    (a, b) => (a === site.defaultLocale ? -1 : b === site.defaultLocale ? 1 : 0));

  // Recurses into one or more subfolders (e.g. src/pages/blog/*.html), so
  // every page path is relative to src/pages/ and uses forward slashes
  // regardless of OS.
  const pages = (await readdir(path.join(SRC, "pages"), { recursive: true }))
    .filter((f) => f.endsWith(".html"))
    .map((f) => f.split(path.sep).join("/"));

  // A bare "index.html" pretty-prints to "/", a nested "blog/index.html" to
  // "/blog/". Every other file keeps its path as the URL suffix.
  function urlSuffix(file) {
    if (file === "index.html") return "";
    const dir = path.dirname(file).split(path.sep).join("/");
    return path.basename(file) === "index.html" ? `${dir}/` : file;
  }

  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  for (const lang of codes) {
    const t = locales[lang];
    // Default locale sits at the root, every other locale in its own folder.
    const isDefault = lang === site.defaultLocale;
    const dir = isDefault ? OUT : path.join(OUT, lang);
    // How many "../" it takes to get back to dist/ from this locale's root.
    const localeBase = isDefault ? "" : "../";
    await mkdir(dir, { recursive: true });

    for (const file of pages) {
      // A locale can override a page's body copy with its own literal HTML
      // by adding a same-named file under src/pages-<lang>/. Falls back to
      // the English source when no override exists (e.g. Blog, which has
      // no translation yet), so every locale still builds every page.
      const overridePath = path.join(SRC, `pages-${lang}`, file);
      const hasOverride = existsSync(overridePath);
      const raw = hasOverride
        ? await read(overridePath)
        : await read(path.join(SRC, "pages", file));
      const { meta, body } = parseFrontMatter(raw);
      // A non-default locale with no override is showing the English
      // source verbatim (e.g. Blog, which isn't translated yet). The page
      // itself is still in English, whatever locale folder it sits in.
      const usesFallback = !isDefault && !hasOverride;
      const contentLang = usesFallback ? site.defaultLocale : lang;
      const urlPath = (isDefault ? "/" : `/${lang}/`) + urlSuffix(file);

      // Nested pages (blog/slug.html) need extra "../" on top of the
      // locale's own base to still reach dist/.
      const depth = file.split("/").length - 1;
      const base = localeBase + "../".repeat(depth);
      // Path back to this locale's OWN root, not all the way to dist/.
      // {{base}} is for assets, which only live once at dist/ regardless
      // of locale. Links to other pages on the site need to stay inside
      // the current locale, so they use {{pageBase}} instead, or they'd
      // walk straight past the locale folder back into English.
      const pageBase = "../".repeat(depth);

      // Every page declares its translations to search engines, including
      // itself, plus an x-default pointing at the default locale.
      const hreflang = [
        ...codes.map((c) => {
          const href = site.origin + (c === site.defaultLocale ? "/" : `/${c}/`) +
            urlSuffix(file);
          return `  <link rel="alternate" hreflang="${c}" href="${href}">`;
        }),
        `  <link rel="alternate" hreflang="x-default" href="${site.origin}/${urlSuffix(file)}">`,
      ].join("\n");

      // Nav/footer hrefs are written relative to the locale's own root in
      // the locale file, so they resolve within the current locale from
      // any nesting depth once prefixed with this page's own {{pageBase}}.
      const linkHref = (href) =>
        href.startsWith("http") ? href : pageBase + href;

      // A nav entry with a `children` array renders as a click-to-open
      // dropdown (built on <details>, same no-JS pattern as the FAQ
      // accordion) instead of a plain link. `footerOnly` keeps an entry
      // out of the top nav; the footer mirrors the top nav exactly, so it
      // stays out of both until it's unmarked.
      const visibleNav = t.nav.filter((l) => !l.footerOnly);
      const navLinks = visibleNav.map((l) => {
        if (!l.children) {
          return `                  <li>\n                    <a href="${linkHref(l.href)}" class="nav-link">${
            escapeHtml(l.label)}</a>\n                  </li>`;
        }
        const items = l.children.map((c) =>
          `                        <li><a href="${linkHref(c.href)}" class="nav-dropdown-link">${
            escapeHtml(c.label)}</a></li>`).join("\n");
        return `                  <li class="nav-item-dropdown">\n` +
          `                    <details class="nav-dropdown">\n` +
          `                      <summary class="nav-link nav-dropdown-toggle">${escapeHtml(l.label)}` +
          `<span class="nav-dropdown-caret" aria-hidden="true"></span></summary>\n` +
          `                      <ul class="nav-dropdown-menu">\n${items}\n                      </ul>\n` +
          `                    </details>\n                  </li>`;
      }).join("\n");

      // The footer is a flat link row, so a dropdown entry contributes its
      // children directly rather than the unclickable group label.
      const footerLinks = visibleNav.flatMap((l) => l.children ?? [l]).map((l) =>
        `                <a href="${linkHref(l.href)}" class="footer_link">${
          escapeHtml(l.label)}</a>`).join("\n");

      const others = codes.filter((c) => c !== lang);
      const langSwitch = others.map((c) => {
        const href = (c === site.defaultLocale ? base : `${base}${c}/`) + file;
        return `              <a href="${href}" hreflang="${c}" class="lang-switch" ` +
          `lang="${c}">${escapeHtml(locales[c].name)}</a>`;
      }).join("\n");

      const robotsMeta = noindex.has(file)
        ? `  <meta name="robots" content="noindex, nofollow">\n`
        : "";

      const ctx = {
        base, pageBase, lang, t, site, hreflang, navLinks, footerLinks, langSwitch, robotsMeta,
        page: {
          title: meta[`title.${lang}`] ?? meta.title ?? "Zipli",
          description: meta[`description.${lang}`] ?? meta.description ?? "",
          canonical: urlPath,
          // A locale without its own override still edits back to the
          // English source (that's the only copy that exists). A locale
          // with a real translated file, like src/pages-fi/, edits back to
          // that file instead, so a browser edit never overwrites the
          // English source with translated text. Read by edit-mode.js to
          // know which file to fetch/commit through the GitHub API.
          editSource: hasOverride ? `src/pages-${lang}/${file}` : `src/pages/${file}`,
        },
      };

      // Stamped before includes are resolved, so ids only ever land on
      // elements that live in the page file itself (nav/footer come from
      // partials and are never touched), and so the same id numbering the
      // edit-mode client computes when it re-walks the raw source file on
      // GitHub lines up with what the teammate sees in the rendered page.
      // <html lang> describes the page's actual content, not the URL's
      // locale folder, so an untranslated page under /fi/ still declares
      // itself English.
      let html = fill(await resolveIncludes(stampEditIds(body)), ctx)
        .replace("<html", `<html lang="${contentLang}"`);

      // On a page still showing the English fallback inside a non-English
      // locale, drop a small notice right after the hero section (the
      // page's first </section>, true on every page in this site) telling
      // the reader why. Uses the *other* locale's own wording, since the
      // chrome around the English content is in that locale.
      if (usesFallback) {
        // No padding-section-* wrapper on purpose: those add multiple ems
        // of space on their own, and the next section's own top padding
        // would stack on top of that. This sits flush against the hero
        // above and only as tall as its own text needs.
        const notice = `      <div style="background:#fff4e5;border-top:1px solid #f0dcb8;border-bottom:1px solid #f0dcb8;">\n` +
          `        <div class="padding-global">\n` +
          `          <div class="main-container new-home" style="padding:0.7em 0;">\n` +
          `            <p class="page-note" style="margin:0;">${escapeHtml(t.contentEnglishOnly ?? "This page is only available in English.")}</p>\n` +
          `          </div>\n` +
          `        </div>\n` +
          `      </div>\n`;
        html = html.replace("</section>", `</section>\n${notice}`);
      }
      const outFile = path.join(dir, file);
      await mkdir(path.dirname(outFile), { recursive: true });
      await writeFile(outFile, html);
      console.log(`  ${path.relative(ROOT, outFile)}`);
    }
  }

  // Sitemap and robots. Every locale of every page gets its own <url> entry
  // carrying xhtml:link alternates, which is what Google wants for hreflang.
  const urls = [];
  for (const file of pages) {
    if (noindex.has(file)) continue;
    for (const lang of codes) {
      const suffix = urlSuffix(file);
      const loc = site.origin +
        (lang === site.defaultLocale ? "/" : `/${lang}/`) + suffix;
      const alts = codes.map((c) => {
        const href = site.origin +
          (c === site.defaultLocale ? "/" : `/${c}/`) + suffix;
        return `    <xhtml:link rel="alternate" hreflang="${c}" href="${href}"/>`;
      }).join("\n");
      urls.push(`  <url>\n    <loc>${loc}</loc>\n${alts}\n  </url>`);
    }
  }
  await writeFile(path.join(OUT, "sitemap.xml"),
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
    `xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join("\n")}\n</urlset>\n`);

  // Netlify sets CONTEXT to "production" for the live site and to
  // "branch-deploy" or "deploy-preview" for everything else. Only the real
  // site invites crawlers: a branch preview is a full copy of the marketing
  // site on its own public URL, and if it gets indexed it competes with
  // getzipli.com in search for our own copy. Netlify adds noindex to deploy
  // previews on its own but NOT to branch deploys, so this covers the gap.
  // Unset (a local build) is treated as production, so `npm run build` output
  // is what actually ships.
  const isProduction = !process.env.CONTEXT || process.env.CONTEXT === "production";
  await writeFile(path.join(OUT, "robots.txt"), isProduction
    ? `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`
    : `# ${process.env.CONTEXT} build, not the live site.\nUser-agent: *\nDisallow: /\n`);

  for (const a of ASSETS) {
    if (existsSync(path.join(ROOT, a))) {
      await cp(path.join(ROOT, a), path.join(OUT, a), { recursive: true });
    }
  }
  if (existsSync(path.join(ROOT, "static"))) {
    await cp(path.join(ROOT, "static"), OUT, { recursive: true });
  }
  console.log(`\nBuilt ${pages.length} page(s) x ${codes.length} locale(s) into dist/`);
}

await build();

if (process.argv.includes("--serve")) {
  const { createServer } = await import("node:http");
  const { watch } = await import("node:fs");
  const TYPES = {
    ".html": "text/html", ".css": "text/css", ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg",
    ".avif": "image/avif", ".woff2": "font/woff2", ".ttf": "font/ttf",
  };
  createServer(async (req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(OUT, p);
    try {
      const buf = await readFile(file);
      res.writeHead(200, { "content-type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      res.end(buf);
    } catch {
      res.writeHead(404).end("Not found");
    }
  }).listen(3456, () => console.log("\nhttp://localhost:3456"));

  let pending;
  const rebuild = () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      partialCache.clear();
      build().catch((e) => console.error(e.message));
    }, 100);
  };
  watch(SRC, { recursive: true }, rebuild);
  for (const dir of ASSETS) {
    const dirPath = path.join(ROOT, dir);
    if (existsSync(dirPath)) watch(dirPath, { recursive: true }, rebuild);
  }
}
