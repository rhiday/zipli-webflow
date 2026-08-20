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

const ROOT = import.meta.dirname;
const SRC = path.join(ROOT, "src");
const OUT = path.join(ROOT, "dist");

const site = {
  origin: "https://www.getzipli.com",
  defaultLocale: "en",
};

// Static assets copied verbatim. Everything here is referenced with {{base}}.
const ASSETS = ["css", "js", "images", "fonts"];

// Pages kept out of the sitemap. They also carry a robots noindex meta tag.
const noindex = new Set(["styleguide.html"]);

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
    return key === "hreflang" || key.endsWith("Links") || key === "langSwitch"
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
      const raw = await read(path.join(SRC, "pages", file));
      const { meta, body } = parseFrontMatter(raw);
      const urlPath = (isDefault ? "/" : `/${lang}/`) + urlSuffix(file);

      // Nested pages (blog/slug.html) need extra "../" on top of the
      // locale's own base to still reach dist/.
      const depth = file.split("/").length - 1;
      const base = localeBase + "../".repeat(depth);

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

      // Nav/footer hrefs are written relative to the site root in the
      // locale file, so they resolve within the current locale from any
      // nesting depth once prefixed with this page's own {{base}}.
      const linkHref = (href) =>
        href.startsWith("http") ? href : base + href;

      // A nav entry with a `children` array renders as a click-to-open
      // dropdown (built on <details>, same no-JS pattern as the FAQ
      // accordion) instead of a plain link. `footerOnly` keeps an entry
      // (Contact) out of the top nav while it still appears in the footer.
      const navLinks = t.nav.filter((l) => !l.footerOnly).map((l) => {
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
      const footerLinks = t.nav.flatMap((l) => l.children ?? [l]).map((l) =>
        `                <a href="${linkHref(l.href)}" class="footer_link">${
          escapeHtml(l.label)}</a>`).join("\n");

      const others = codes.filter((c) => c !== lang);
      const langSwitch = others.map((c) => {
        const href = (c === site.defaultLocale ? base : `${base}${c}/`) + file;
        return `              <a href="${href}" hreflang="${c}" class="lang-switch" ` +
          `lang="${c}">${escapeHtml(locales[c].name)}</a>`;
      }).join("\n");

      const ctx = {
        base, lang, t, site, hreflang, navLinks, footerLinks, langSwitch,
        page: {
          title: meta[`title.${lang}`] ?? meta.title ?? "Zipli",
          description: meta[`description.${lang}`] ?? meta.description ?? "",
          canonical: urlPath,
        },
      };

      const html = fill(await resolveIncludes(body), ctx)
        .replace("<html", `<html lang="${lang}"`);
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

  await writeFile(path.join(OUT, "robots.txt"),
    `User-agent: *\nAllow: /\n\nSitemap: ${site.origin}/sitemap.xml\n`);

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
  watch(SRC, { recursive: true }, () => {
    clearTimeout(pending);
    pending = setTimeout(() => {
      partialCache.clear();
      build().catch((e) => console.error(e.message));
    }, 100);
  });
}
