# Archive

The original Webflow export, kept for reference only. Nothing here is built,
served or deployed, and the build ignores this folder entirely.

| File | What it is |
|---|---|
| `index.html` | The exported home page. `src/pages/index.html` was built from this and is the live version now. |
| `old-home.html` | An earlier home page layout, superseded. |
| `new-home.html` | An empty Webflow page shell. Kept because it shows the exact head and script tags Webflow emits for a blank page. |

Use `index.html` as the reference when you want to check whether a change drifted
from the original design. To diff it against what the build now produces:

```
node build.mjs
diff <(tr -d ' \t\n' < archive/index.html | sed 's/></>\n</g') \
     <(tr -d ' \t\n' < dist/index.html    | sed 's/></>\n</g')
```

Every difference in that output should be one you can account for. As of the
extraction it is 101 lines, all of them deliberate: canonical and hreflang tags,
`custom.css`, the font loading change, ARIA labels, deduplicated SVG clip ids,
`rel="noopener"`, image dimensions and the language switcher.

These files reference `css/`, `js/` and `images/` with relative paths that no
longer resolve from this folder, so opening them directly will render unstyled.
That is expected. They are for reading, not for viewing.
