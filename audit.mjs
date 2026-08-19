// Unit consistency audit for the Zipli stylesheets.
//
//   node audit.mjs           report findings
//   node audit.mjs --fix     rewrite the safe ones (rem -> em) in place
//
// Why this exists: body is 0.8333vw, so `em` scales with the viewport but
// `rem` does not, because `html` is left at the browser default of 16px.
// Mixing them gives you elements that hold a fixed size while everything
// around them grows. That is only visible between 992px and 1919px, which
// is exactly the range most people work at, so it hides well.

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = import.meta.dirname;

// Webflow output plus our own layer. normalize.css and webflow.css are
// framework files where px is correct, so they are not audited.
const FILES = ["css/zipli.webflow.css", "css/custom.css"];

// Properties whose values are part of the layout and must scale with it.
const SCALING = /^(font-size|line-height|letter-spacing|width|height|min-width|max-width|min-height|max-height|padding|padding-.*|margin|margin-.*|gap|grid-.*-gap|top|right|bottom|left|border-radius|flex-basis|text-indent)$/;

// Properties where a fixed px value is legitimate: hairlines and rings do
// not need to grow with the viewport.
const FIXED_OK = /^(border(-(top|right|bottom|left))?(-(width|style|color))?|outline(-(width|offset))?|box-shadow|text-shadow|stroke-width)$/;

// The spacer scale, for reporting values that sit just off it.
const SCALE = [0.5, 1, 1.5, 2.5, 3, 5.5, 8, 10, 14, 18];

// A rule only matters if it applies in the 992-1919px band. Below 992 and
// at 1920+ the body font-size is pinned to 16px, so there rem === em and
// the whole problem disappears.
function bandApplies(mq) {
  if (!mq) return true;
  const max = mq.match(/max-width:\s*(\d+)px/);
  if (max && Number(max[1]) <= 991) return false;
  const min = mq.match(/min-width:\s*(\d+)px/);
  if (min && Number(min[1]) >= 1920) return false;
  return true;
}

function parse(css) {
  const out = [];
  const lines = css.split("\n");
  let depth = 0, sel = "", mqStack = [];
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i], s = raw.trim();
    if (s.startsWith("@media")) { mqStack.push({ text: s, depth }); }
    else if (/^[^@}]*\{\s*$/.test(s) && s.includes("{")) { sel = s.replace(/\{$/, "").trim(); }
    const decl = s.match(/^([-\w]+)\s*:\s*([^;]+);?$/);
    if (decl && depth > 0) {
      out.push({
        line: i + 1, prop: decl[1], value: decl[2].trim(), sel,
        mq: mqStack.length ? mqStack[mqStack.length - 1].text : null, raw,
      });
    }
    depth += (raw.match(/\{/g) || []).length - (raw.match(/\}/g) || []).length;
    while (mqStack.length && depth <= mqStack[mqStack.length - 1].depth) mqStack.pop();
  }
  return out;
}

const findings = [];
const add = (level, file, d, msg, fixable = false) =>
  findings.push({ level, file, line: d.line, sel: d.sel, prop: d.prop,
                  value: d.value, msg, fixable, mq: d.mq });

for (const file of FILES) {
  const css = await readFile(path.join(ROOT, file), "utf8");
  for (const d of parse(css)) {
    const inBand = bandApplies(d.mq);
    const nums = [...d.value.matchAll(/(-?[\d.]+)(em|rem|px|vw|vh|%)/g)];
    if (!nums.length) continue;

    const units = new Set(nums.map((m) => m[2]));

    // Mixing em and rem/px inside one declaration is almost always a slip.
    if (units.has("em") && (units.has("rem") || units.has("px")) && inBand) {
      add("ERROR", file, d,
        `mixes ${[...units].join(" and ")} in one declaration`, units.has("rem"));
      continue;
    }

    for (const [, n, unit] of nums) {
      const val = Number(n);
      if (unit === "rem" && inBand && SCALING.test(d.prop)) {
        add("ERROR", file, d, `${n}rem will not scale, should be ${n}em`, true);
      } else if (unit === "px" && inBand && SCALING.test(d.prop) && Math.abs(val) > 2) {
        add("WARN", file, d, `${n}px is fixed, consider ${(val / 16).toFixed(4).replace(/0+$/, "")}em`);
      } else if (unit === "px" && inBand && !SCALING.test(d.prop) && !FIXED_OK.test(d.prop)) {
        add("INFO", file, d, `${n}px on a property that is neither layout nor a hairline`);
      }
    }

    // Spacer-ish values that land just off the documented scale.
    if (inBand && /^(padding-top|margin-top|margin-bottom|padding-bottom)$/.test(d.prop)) {
      for (const [, n, unit] of nums) {
        const val = Number(n);
        if (unit !== "em" || val === 0) continue;
        const nearest = SCALE.reduce((a, b) =>
          Math.abs(b - val) < Math.abs(a - val) ? b : a);
        const off = Math.abs(nearest - val);
        if (off > 0.001 && off <= 1) {
          add("INFO", file, d, `${n}em is off the spacer scale, nearest tier is ${nearest}em`);
        }
      }
    }
  }
}

const order = { ERROR: 0, WARN: 1, INFO: 2 };
findings.sort((a, b) => order[a.level] - order[b.level] ||
  a.file.localeCompare(b.file) || a.line - b.line);

const counts = { ERROR: 0, WARN: 0, INFO: 0 };
for (const f of findings) counts[f.level]++;

let lastLevel = null;
for (const f of findings) {
  if (f.level !== lastLevel) {
    const title = { ERROR: "Will not scale, should be fixed",
                    WARN: "Fixed px in a scaling context",
                    INFO: "Worth a look" }[f.level];
    console.log(`\n${"=".repeat(72)}\n${f.level}  ${title}\n${"=".repeat(72)}`);
    lastLevel = f.level;
  }
  const where = f.mq ? `  [${f.mq.replace(/\s+/g, " ")}]` : "";
  console.log(`${f.file}:${f.line}  ${f.sel}${where}`);
  console.log(`    ${f.prop}: ${f.value}`);
  console.log(`    -> ${f.msg}${f.fixable ? "   (--fix can do this)" : ""}`);
}

console.log(`\n${"=".repeat(72)}`);
console.log(`${counts.ERROR} error, ${counts.WARN} warning, ${counts.INFO} info`);
const fixable = findings.filter((f) => f.fixable).length;
console.log(`${fixable} of them can be rewritten automatically with --fix`);

if (process.argv.includes("--fix")) {
  for (const file of FILES) {
    const p = path.join(ROOT, file);
    const lines = (await readFile(p, "utf8")).split("\n");
    let n = 0;
    for (const f of findings.filter((x) => x.fixable && x.file === file)) {
      const i = f.line - 1;
      const next = lines[i].replace(/([\d.]+)rem/g, "$1em");
      if (next !== lines[i]) { lines[i] = next; n++; }
    }
    if (n) { await writeFile(p, lines.join("\n")); console.log(`\nfixed ${n} line(s) in ${file}`); }
  }
  console.log("\nRe-run without --fix to confirm, then check the site at ~1400px wide.");
}
