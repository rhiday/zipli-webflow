// Shared logic for the browser-editable review mode.
//
// Walks a page's raw HTML source (the literal src/pages/*.html file content,
// front matter comment and all) and finds the same set of "editable" leaf
// elements every time, in document order. Both build.mjs (Node) and
// js/edit-mode.js (browser, loaded as a plain <script type="module">) import
// this file, so the numbering can never drift between the rendered page the
// teammate edits and the source file the edit gets written back into.
//
// An element is "editable" if it is one of TAGGABLE_TAGS, contains no nested
// TAGGABLE_TAGS itself (so a card wrapper doesn't shadow the heading/paragraph
// inside it), and has non-whitespace text once other markup is stripped out
// (so icon-only links and empty wrappers are skipped). IDs are plain
// incrementing integers assigned in the order elements are found, which is
// why edits are per source file: the numbering only means anything within
// one page's source.

export const TAGGABLE_TAGS = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "li", "a", "button", "label"];

const OPEN_TAG_RE = new RegExp(`<(${TAGGABLE_TAGS.join("|")})\\b([^>]*)>`, "gi");

function stripTags(html) {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, " ").trim();
}

// Scans forward from `from` (just after an opening <tagName ...> match) for
// the close tag at the same nesting depth, tracking only opens/closes of
// that same tag name. Returns null on malformed/unclosed markup.
function findMatchingClose(html, tagName, from) {
  const re = new RegExp(`<${tagName}\\b|</${tagName}\\s*>`, "gi");
  re.lastIndex = from;
  let depth = 1;
  let m;
  while ((m = re.exec(html))) {
    if (m[0][1] === "/") {
      depth -= 1;
      if (depth === 0) return { closeStart: m.index, closeEnd: re.lastIndex };
    } else {
      depth += 1;
    }
  }
  return null;
}

// Walks `html`, calling onLeaf(info) for every editable leaf element found,
// in document order. info: { id, tag, openStart, openEnd, innerStart,
// innerEnd, closeEnd, inner }. onLeaf's return value is ignored; this is a
// read-only walk, callers build whatever output they need from it.
function walk(html, onLeaf) {
  let id = 0;
  OPEN_TAG_RE.lastIndex = 0;
  let m;
  while ((m = OPEN_TAG_RE.exec(html))) {
    const tag = m[1].toLowerCase();
    const openStart = m.index;
    const openEnd = OPEN_TAG_RE.lastIndex;
    const closed = findMatchingClose(html, tag, openEnd);
    if (!closed) continue; // malformed markup, skip rather than throw
    const inner = html.slice(openEnd, closed.closeStart);

    // Container elements (a card <li> holding its own <h3>/<p>, say) don't
    // get an id themselves, the nested elements do. The outer loop's
    // lastIndex is untouched, so it keeps walking through `inner` next and
    // still finds those nested elements.
    const isContainer = new RegExp(OPEN_TAG_RE.source, "i").test(inner);

    if (!isContainer && stripTags(inner).length > 0) {
      onLeaf({
        id: String(id),
        tag,
        openStart,
        openEnd,
        innerStart: openEnd,
        innerEnd: closed.closeStart,
        closeEnd: closed.closeEnd,
        inner,
      });
      id += 1;
    }
  }
}

// Build-time: returns `html` with a data-edit="<id>" attribute injected into
// every editable leaf element's opening tag.
export function stampEditIds(html) {
  const inserts = []; // { at, text }, applied right-to-left
  walk(html, (leaf) => {
    inserts.push({ at: leaf.openEnd - 1, text: ` data-edit="${leaf.id}"` });
  });
  let out = html;
  for (const ins of inserts.sort((a, b) => b.at - a.at)) {
    out = out.slice(0, ins.at) + ins.text + out.slice(ins.at);
  }
  return out;
}

// Edit-time: finds the leaf element with the given id in raw source `html`
// and returns its inner-content byte range, or null if the id doesn't exist
// in this source (e.g. the page changed since the edit page was loaded).
export function findEditRegion(html, id) {
  let found = null;
  walk(html, (leaf) => {
    if (leaf.id === id) found = leaf;
  });
  return found;
}

// Escapes plain text for safe placement back into HTML.
export function escapeHtml(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" })[c]);
}
