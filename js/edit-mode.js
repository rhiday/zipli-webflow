// Browser-editable review mode. No-op unless the page is loaded with
// ?edit=1. See docs/plan-editable-review-mode.md for the full brief.
//
// Makes every [data-edit] element (stamped by build.mjs, see js/edit-ids.mjs)
// contenteditable, and on Save, patches the matching text back into the
// page's src/pages/*.html file on GitHub via the Contents API, committing
// straight to main. There is no backend: the GitHub Personal Access Token
// is pasted in once by the teammate and kept in this browser's localStorage.

import { findEditRegion, escapeHtml } from "./edit-ids.mjs";

const GITHUB_REPO = "rhiday/zipli-webflow";
const BRANCH = "main";
const TOKEN_KEY = "zipliEditPat";

if (new URLSearchParams(location.search).get("edit") === "1") initEditMode();

function initEditMode() {
  const sourcePath = document.querySelector('meta[name="zipli-edit-source"]')?.content;
  if (!sourcePath) {
    console.warn("[edit-mode] page has no zipli-edit-source meta tag, edit mode disabled");
    return;
  }

  const editable = Array.from(document.querySelectorAll("[data-edit]"));
  if (editable.length === 0) return;

  const originalText = new Map();
  for (const el of editable) {
    el.contentEditable = "true";
    el.classList.add("zipli-edit-target");
    originalText.set(el, el.textContent);
  }

  injectStyles();
  const bar = buildToolbar();
  document.body.appendChild(bar.root);
  bar.saveBtn.addEventListener("click", save);

  async function save() {
    const changed = editable.filter((el) => el.textContent !== originalText.get(el));
    if (changed.length === 0) {
      setStatus("No changes to save.", "info");
      return;
    }

    const pat = await getToken();
    if (!pat) {
      setStatus("Save cancelled, no GitHub token provided.", "error");
      return;
    }

    bar.saveBtn.disabled = true;
    setStatus("Saving…", "info");
    try {
      const { sha, text } = await fetchSourceFile(pat, sourcePath);

      const edits = changed
        .map((el) => ({ id: el.getAttribute("data-edit"), text: el.textContent, region: findEditRegion(text, el.getAttribute("data-edit")) }));

      const missing = edits.filter((e) => !e.region);
      for (const e of missing) {
        console.warn(`[edit-mode] id "${e.id}" not found in ${sourcePath}, skipping`);
      }
      const found = edits.filter((e) => e.region).sort((a, b) => b.region.innerStart - a.region.innerStart);
      if (found.length === 0) {
        throw new Error("None of the edited elements could be located in the source file. It may have changed since this page loaded, try reloading.");
      }

      let updated = text;
      for (const e of found) {
        updated = updated.slice(0, e.region.innerStart) + escapeHtml(e.text) + updated.slice(e.region.innerEnd);
      }

      await commitSourceFile(pat, sourcePath, sha, updated, found.length);
      for (const el of changed) originalText.set(el, el.textContent);

      const skippedNote = missing.length ? ` (${missing.length} could not be located and were skipped)` : "";
      setStatus(`Saved ${found.length} change(s)${skippedNote}. Live once Netlify redeploys, usually a minute or two.`, "success");
    } catch (err) {
      console.error("[edit-mode] save failed", err);
      setStatus(`Save failed: ${err.message}`, "error");
    } finally {
      bar.saveBtn.disabled = false;
    }
  }

  async function fetchSourceFile(pat, path) {
    const res = await fetch(
      `https://api.github.com/repos/${GITHUB_REPO}/contents/${path}?ref=${BRANCH}`,
      { headers: authHeaders(pat) },
    );
    if (res.status === 401) throw new Error("GitHub token was rejected, check it and try again.");
    if (!res.ok) throw new Error(`Could not read ${path} from GitHub (${res.status}).`);
    const json = await res.json();
    return { sha: json.sha, text: decodeBase64Utf8(json.content) };
  }

  async function commitSourceFile(pat, path, sha, newText, count) {
    const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/contents/${path}`, {
      method: "PUT",
      headers: authHeaders(pat),
      body: JSON.stringify({
        message: `Edit ${count} item(s) on ${path} via browser edit mode`,
        content: encodeBase64Utf8(newText),
        sha,
        branch: BRANCH,
      }),
    });
    if (res.status === 401) throw new Error("GitHub token was rejected, check it and try again.");
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.message || `GitHub rejected the commit (${res.status}).`);
    }
  }

  function authHeaders(pat) {
    return {
      Authorization: `Bearer ${pat}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
    };
  }

  async function getToken() {
    let pat = localStorage.getItem(TOKEN_KEY);
    if (pat) return pat;
    pat = await promptForToken();
    if (pat) localStorage.setItem(TOKEN_KEY, pat);
    return pat;
  }

  function promptForToken() {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "zipli-edit-modal-overlay";
      overlay.innerHTML = `
        <div class="zipli-edit-modal">
          <h2>GitHub access token needed</h2>
          <p>Paste a Personal Access Token scoped to just this repo, contents read/write only. It is saved in this browser only, so this is a one time step here.</p>
          <input type="password" placeholder="ghp_..." autocomplete="off" spellcheck="false">
          <div class="zipli-edit-modal-actions">
            <button type="button" class="zipli-edit-btn-secondary" data-action="cancel">Cancel</button>
            <button type="button" class="zipli-edit-btn-primary" data-action="save">Save token</button>
          </div>
        </div>`;
      document.body.appendChild(overlay);
      const input = overlay.querySelector("input");
      input.focus();
      const close = (value) => {
        overlay.remove();
        resolve(value);
      };
      overlay.querySelector('[data-action="cancel"]').addEventListener("click", () => close(null));
      overlay.querySelector('[data-action="save"]').addEventListener("click", () => close(input.value.trim() || null));
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") close(input.value.trim() || null);
        if (e.key === "Escape") close(null);
      });
    });
  }

  function buildToolbar() {
    const root = document.createElement("div");
    root.className = "zipli-edit-toolbar";
    root.innerHTML = `
      <span class="zipli-edit-label">Edit mode</span>
      <span class="zipli-edit-status" data-role="status"></span>
      <button type="button" class="zipli-edit-btn-primary" data-role="save">Save changes</button>
    `;
    return {
      root,
      saveBtn: root.querySelector('[data-role="save"]'),
      status: root.querySelector('[data-role="status"]'),
    };
  }

  function setStatus(msg, kind) {
    bar.status.textContent = msg;
    bar.status.dataset.kind = kind;
  }

  function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      .zipli-edit-target { outline: 1px dashed rgba(0,120,255,0.5); outline-offset: 2px; cursor: text; }
      .zipli-edit-target:focus { outline: 2px solid #0078ff; background: rgba(0,120,255,0.06); }
      .zipli-edit-toolbar {
        position: fixed; bottom: 16px; right: 16px; z-index: 999999;
        display: flex; align-items: center; gap: 12px;
        background: #111; color: #fff; padding: 10px 14px; border-radius: 10px;
        font: 14px/1.4 -apple-system, BlinkMacSystemFont, sans-serif;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
      }
      .zipli-edit-label { font-weight: 600; opacity: 0.8; }
      .zipli-edit-status { max-width: 320px; opacity: 0.85; }
      .zipli-edit-status[data-kind="error"] { color: #ff8080; }
      .zipli-edit-status[data-kind="success"] { color: #8fe0a0; }
      .zipli-edit-btn-primary, .zipli-edit-btn-secondary {
        font: inherit; border: none; border-radius: 6px; padding: 8px 14px; cursor: pointer;
      }
      .zipli-edit-btn-primary { background: #0078ff; color: #fff; }
      .zipli-edit-btn-primary:disabled { opacity: 0.5; cursor: default; }
      .zipli-edit-btn-secondary { background: #333; color: #fff; }
      .zipli-edit-modal-overlay {
        position: fixed; inset: 0; z-index: 9999999;
        background: rgba(0,0,0,0.5);
        display: flex; align-items: center; justify-content: center;
      }
      .zipli-edit-modal {
        background: #fff; color: #111; padding: 24px; border-radius: 12px;
        width: min(420px, 90vw); font: 14px/1.5 -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .zipli-edit-modal h2 { margin: 0 0 8px; font-size: 17px; }
      .zipli-edit-modal p { margin: 0 0 16px; opacity: 0.75; }
      .zipli-edit-modal input {
        width: 100%; box-sizing: border-box; padding: 10px; border-radius: 6px;
        border: 1px solid #ccc; font: inherit; margin-bottom: 16px;
      }
      .zipli-edit-modal-actions { display: flex; justify-content: flex-end; gap: 8px; }
    `;
    document.head.appendChild(style);
  }
}

function decodeBase64Utf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder("utf-8").decode(bytes);
}

function encodeBase64Utf8(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}
