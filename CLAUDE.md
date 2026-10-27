# WP Free Charts — notes for Claude

Plugin with two Gutenberg blocks. Updates ship to sites from GitHub releases via the
bundled plugin-update-checker library.
- `wp-free-charts/chart` (src/ root → build/): Chart.js v4 charts (bar, horizontalBar, line,
  pie, doughnut, polarArea, radar, scatter) from spreadsheet-style data, with theme colours
  and optional front-end filter buttons.
- `wp-free-charts/table` (src/table/ → build/table/): Word-style table. See "Table block" below.
- `wp-free-charts/contact-details` + child `wp-free-charts/contact-item` (src/contact/ → build/contact/,
  build/contact/item/): email, phone, WhatsApp, website and social links with icons. See "Contact block" below.

**Block names are permanent.** The `wp-free-charts/` namespace is stored in every post, so keep it
even if the plugin is renamed (changing it orphans saved blocks). Renaming the plugin title,
description or folder is fine; the update checker's repo URL and slug in the PHP file must match
the GitHub repo.

wp-scripts finds every `src/**/block.json`, so each block builds into the matching `build/`
subfolder; `wp-free-charts.php` registers both. Requires WordPress 6.6+ (the build depends on
the `react-jsx-runtime` script handle).

## Layout

| Path | Role |
|---|---|
| `wp-free-charts.php` | Plugin header (`Version`), update checker setup, `register_block_type( build/ )` |
| `includes/` | Plain PHP/JSON shipped as-is (not built): `contact-fields.php` (custom-field lookup + REST preview route), `contact-types.php` (item types: links), `contact-styles.php` (parent styling → classes/CSS vars), `contact-icons.json` (icons for editor + front end) |
| `src/block.json` | Block metadata + **all attributes** (copied to `build/` on build) |
| `src/index.js` | Registers the block (edit + save) |
| `src/edit.js` | Editor UI: sidebar controls, live preview, modals |
| `src/save.js` | Static saved markup: `<figure>` + `<canvas>` + filter buttons + JSON config `<script>` |
| `src/view.js` | Front end: reads the JSON, creates the chart, builds/wires filter buttons |
| `src/utils/chartDataUtils.js` | **Shared** attributes → Chart.js config (editor and front end), plus the legend-spacing and responsive plugins and `getFilterLabels()` |
| `src/components/` | `ChartPreview` (editor canvas), `DataSpreadsheet` (data modal), `ChartTypeSelector` |
| `src/style.css` | Front-end + editor styles, including mobile overrides |
| `src/editor.css` | Editor-only styles (modals, sidebar, preview chips) |
| `build/` | Compiled output. **Committed** because sites install straight from the release zip |
| `plugin-update-checker/` | Vendored YahnisElsts/plugin-update-checker v5; don't edit |
| `src/table/` | The table block (see "Table block") |
| `tools/visual-check/` | Headless-Edge screenshot harness for the chart block (see below) |
| `tools/tests/` | Node unit tests (`npm run test:unit`) |
| `tools/editor-test/` | End-to-end editor test against WordPress Playground (see Commands) |

`tools/` and `CLAUDE.md` are excluded from release zips via `.gitattributes`.

## Data model

`tableData` is a 2D array: row 0 = `[ '', 'Series 1', … ]`, rows 1..n = `[ 'Label', value, … ]`.
- pie/doughnut/polarArea: one dataset, one slice per row, column 1 only
- scatter: one dataset per X/Y column pair, one point per row
- others: one dataset per column, one category per row
- `horizontalBar` isn't a Chart.js type: it maps to `bar` with `indexAxis: 'y'`

## Rules that matter

- **Block validation.** WordPress re-runs `save()` and compares the result with stored post HTML.
  Any change to save output (markup, inline styles, the JSON config, even key order) breaks
  every existing block ("unexpected content"). Put behaviour changes in `view.js` /
  `chartDataUtils.js`. If a new setting must reach the front end, add it to `chartData` in
  `save.js` **only when it's non-default** (the `customRange` spread is the pattern), or add a
  `deprecated` entry in `index.js` with the old save.
- **Filter buttons are rebuilt by view.js** from `getFilterLabels()`. The ones in saved HTML are
  placeholders kept for validation (their labels are wrong for scatter/"label" filters on older saves).
- **Editor preview change detection** uses `JSON.stringify(config)`, which drops functions. Values
  used by scriptable options must also sit in the config as plain data (base font lives in
  `options.plugins.wfcResponsive.font`).
- **Chart.js plugins in chartDataUtils.js:** `legendSpacingPlugin` wraps `legend.fit()` to add 1rem
  and shifts bottom/right legends in `afterLayout`. `responsivePlugin` handles charts under 480px wide:
  fonts capped at 11px through scriptable `responsiveFont`, side legends moved to bottom, x labels
  allowed to rotate 90°. It mutates `chart.config.options` in `afterInit`/`resize`.
- Scale layering uses `ticks.z` / `grid.z`, not scale `z` (polarArea ticks use `ticks.z: 1`).
- Filter button CSS is scoped `.wfc-block .wfc-filters .wfc-filter-btn` with resets, so theme
  `button` styles can't override it.
- New setting checklist: `block.json` attribute → destructure + pass in `edit.js` → param in
  `tableDataToChartConfig` → control in `edit.js` → conditional key in `save.js` → destructure +
  pass in `view.js`.

## Table block (src/table/)

| File | Role |
|---|---|
| `tableUtils.js` | **Pure** grid operations (insert/delete rows/cols, merge, split, selection rects, header rows, column labels, widths). No WP imports; unit-tested in `tools/tests/tableUtils.test.mjs` |
| `styles.js` | Pure inline-style helpers shared by edit and save (cell style, table CSS vars, colour/font-size → `var(--wp--preset--…)`) |
| `edit.js` | Editor: setup placeholder, selection, toolbar (Rows & columns menu, Merge, Split), sidebar, column-resize drag |
| `save.js` | Static `<figure><div.wfc-table__scroll><table>…</table></div><figcaption/></figure>`; no front-end JS |
| `formats.js` | Underline format (`<u>`) with a toolbar button shown only inside this block ("More" ▾ menu) |
| `transforms.js` | Transform to/from `core/table` (text, merges, align, header row, caption; colours/fonts/widths dropped going to core). core/table content may be `RichTextData`, so it's converted with `toHTMLString()` |
| `style.css` | Front end + editor: table look via CSS vars, mobile scroll/stack layouts (container queries) |
| `editor.css` | Row/column handles, resize grips, selection highlight |

- **Data model:** `cells[r][c]` is a full grid. An origin cell is `{ content, colspan?, rowspan?, ...style }`
  and a position covered by a merge is `{ hidden: true }`. Spans are omitted when 1. Style keys are
  `STYLE_KEYS` in tableUtils. Column ops reuse row ops via `transpose()`. All helpers are immutable.
- **Colours and font sizes** are stored as value + slug (`bg`/`bgSlug`, `headerBg`/`headerBgSlug`, …).
  When a slug exists, output is `var(--wp--preset--color--{slug})`, so the table follows theme palette changes.
- **Whole-table typography, colours and spacing** come from block supports in block.json (theme
  fonts and sizes appear in the sidebar automatically). Table-only settings are attributes, output as
  CSS custom properties on `<table>` (`--wfc-border-*`, `--wfc-cell-padding`, `--wfc-header-*`, `--wfc-stripe-bg`).
- **Header rows:** `getHeaderRowCount()` grows the `<thead>` when a first-row cell is merged downward,
  so a rowspan never crosses thead/tbody.
- **Responsive:** the figure is a CSS container, so layouts react to the width of the block's
  container (Group, Columns), not the viewport. Below 600px: `is-mobile-scroll` makes resized column
  widths advisory (`table-layout: auto`) and scrolls sideways; `is-mobile-stack` turns rows into cards
  with `td[data-label]::before` labels (labels come from the first row, written by save.js). Stack rules
  are excluded in the editor via `.wfc-table--editor`.
- **Editor handles:** an extra handle row (column letters + resize grips) and handle column (row numbers)
  are rendered only in edit.js. They're always in the DOM, hidden via CSS when the block isn't selected,
  so columns stay aligned. Selection is local state of origin keys `"r-c"`.
- **Keyboard and paste** use native capture-phase listeners on the editor `<table>`, so they run before
  WritingFlow (which would jump to the next block) and before RichText's paste handling. They read
  current state from `latest` (a ref), because they're attached once. Arrow keys only change cell when
  `caretAtEdge()` says the caret is at the start/end or the first/last line, and at the table's edge they
  fall through so the editor moves to the next block. **Move focus with
  `selectionChange(clientId, 'cell-r-c', offset, offset)`, never by setting the DOM caret:** RichText
  resets a hand-set caret on focus. Multi-cell paste triggers only when the clipboard has a tab or an
  HTML `<table>` (what Excel/Sheets put there); `parseClipboardGrid` handles quoted cells.
- **2.0.0 is live, so tables exist on real sites.** Style changes must work with the existing saved markup.
  Restyle through style.css (not validated) or by adding *optional* attributes/keys that output nothing
  when unset. `tools/editor-test/table-styles.test.mjs <out> <oldPostIds…>` re-checks old posts.
- **Look and theme integration:** the outer border is drawn by `table::after` (cells' outer edges are
  hidden with `border-style: hidden`), so it can follow the block's Border → Radius (block supports, on
  the `<figure>`, inherited down). The editor turns this off, because the handles sit inside the table.
  Default header/stripe tints are `color-mix(currentColor …)`, so they work on dark themes. Selectors are
  prefixed `.wp-block-wp-free-charts-table` to beat theme table CSS.
- **Mobile cards:** labels sit in a header-coloured column. The background is a gradient on the `td`
  (always full height) and the label is a float in the `td`'s left padding (`--wfc-label-w`, in `cqi`).
  Don't use grid/flex on the `td`: inline formatting in cell content would split into separate items.
  Cards force `text-align: left !important` and use `--wp--style--block-gap` between cards.
- **Theme controls:** cell padding uses `__experimentalSpacingSizesControl`, which stores
  `var:preset|spacing|x`; `styles.js spacingCss()` turns that into the CSS var. Cell typography uses the
  block-editor controls (FontAppearance with the font's `fontFace` weights, LineHeight, LetterSpacing,
  TextTransform, TextDecoration). These are looked up at runtime from `@wordpress/block-editor` and
  hidden if missing. In block.json, `__experimentalDefaultControls` keys are `fontFamily`,
  `fontAppearance`, `letterSpacing`, `textTransform` and `textDecoration`. These are not the `__experimental…`
  names used to enable them; with the wrong names the controls hide under ⋮.
- **Deprecations (table):** `save.js` builds each saved version from one `renderTable()` via
  `createSave( options )`. The current version is the default export; older ones are named exports
  (`saveV1` = 2.0.x, card labels with spaces instead of line breaks) listed in `deprecated` in
  `src/table/index.js`, newest first. To change saved markup, add an option, make the new behaviour the
  default, and add the old one as a deprecation. Test it by saving a table with the *old* build first,
  then rebuilding (see `tools/editor-test/table-borders.test.mjs`, which takes that post id). WordPress
  only re-serialises a block (and so upgrades it) when the post is edited.
- **Outer border:** `outerBorder*` attributes become `--wfc-outer-border-*`, combined with the cell-border
  fallbacks into `--wfc-frame` on the table. It's used by `table::after` (the frame) and by mobile cards
  (`tr`). In the editor the frame is inset past the handles using `--wfc-frame-top/left`, which edit.js
  measures from cell A1, with the radius passed as `--wfc-editor-radius`. Both are editor-only inline vars.
- `cellStyle()` property order is part of saved markup. Add new properties only if they're undefined
  for existing cells (as `fontFamily` was).
- The same **block-validation rule** as the chart applies: changing save.js output needs a `deprecated`
  entry in `src/table/index.js`.

## Contact block (src/contact/)

- **Dynamic blocks:** both are rendered by `render.php` (copied to build/ by wp-scripts). The parent's
  save is `<InnerBlocks.Content />` and the item's is `null`, so markup changes never need deprecations.
  They're dynamic because kses strips `<svg>` when users without `unfiltered_html` save static markup.
- **Parent** (`contact-details`): `layout` support (flex, like core/buttons) gives side-by-side items,
  justification, wrap and gap. Context to items: `wp-free-charts/showText` (off = icons only, with an
  `aria-label` on each link), `wp-free-charts/itemStyle`, `wp-free-charts/openInNewTab` (web links only).
- **All styling is on the parent, not the items** (the user wants every item consistent). Items have no
  color/typography/spacing/border supports and no block styles. Parent attributes (`itemStyle` plain|button|outline,
  `iconPosition`, `itemGap`, `itemPadding`, item border/radius/underline, item colours + hover, `iconSize`,
  `iconShape`, `iconPadding`, icon colour/background; colours stored as value + `…Slug`) become classes
  (`is-item-style-*`, `has-item-color`, `has-icon-shape-*`, …) + CSS vars (`--wfc-item-*`, `--wfc-icon-*`) on
  the wrapper via `src/contact/styles.js` (editor) and `includes/contact-styles.php` (front end). **Keep those
  two in step**; both validate values (lengths, colours, slugs, enums) so nothing else reaches the style
  attribute. `style.css` applies them; a `has-…` class only appears when set, so unset settings leave theme
  styles alone, and rule order matters (user settings come after the Outline/Button defaults).
  Controls: colours in the Styles tab's Color panel (`InspectorControls group="color"` +
  `ColorGradientSettingsDropdown`, PanelColorSettings fallback), "Items"/"Icons" panels in `group="styles"`.
  Native typography/spacing/border supports on the parent style the container (fonts inherit to items).
  `contact.test.mjs` measures a styled item in the editor and on the site and requires they match.
- **Types are a list, not variations.** `src/contact/types.js` (editor: label, group contact|social, kind,
  field label, validation, `defaultText()`) and `wp_free_charts_contact_types()` / `wp_free_charts_contact_link()`
  in `includes/contact-types.php` (front end), matched by `name`. Kinds: email (mailto), phone (tel),
  whatsapp (https://wa.me/digits), url (website + social; https:// added if missing, needs a dotted host).
  Default text with no display text: the detail for email/phone/WhatsApp, the address without https:// for
  website, the network name for social. Add a type to both files plus an icon. The Type dropdown (optgroups)
  picks it. Don't register block variations: they show as buttons under the block card, which the user
  didn't want. `type` has no `enum`; unknown types fall back to email.
- **Item** (`contact-item`): `type`, `value`, optional `label` (display text), stored as RichText HTML.
  The canvas edits `label` when set (and always for web links, whose default text is the placeholder,
  shown unfaded), otherwise `value`. The `<a>` is the block wrapper. Items saved before 2.7 with the old
  per-item `is-style-button` class still get `wp-element-button` when the parent style is Plain.
- **Custom fields:** `source: 'field'` + `field` (name) + `fieldFrom` (`post` | `option` | `author`) read
  the detail at render time with `wp_free_charts_contact_resolve_field()` in **`includes/contact-fields.php`**
  (plain PHP, required by wp-free-charts.php, not built). It returns the value or an error code
  (`not_found`, `empty`, `not_text` + suggested sub-fields, `no_post`, …). Dots reach into Group/array
  fields (`contact.email`). `post` uses the `postId` context, so it works per post inside a Query Loop.
  render.php calls it through `wp_free_charts_contact_resolve_field_safe()`, which catches any `Throwable`
  (logs it, returns `php_error`). Rendering runs inside the REST response when a post is saved, so an
  uncaught error there shows as "Updating failed. The response is not a valid JSON response".
  The same file registers `POST /wp-free-charts/v1/contact-fields` `{ lookups: [ { field, from, post_id } ] }`
  (needs `edit_posts`; each post needs `read_post`, else `forbidden`). `item/useFieldPreview.js` **batches**
  every item's lookup into one request (one-per-item bursts can trip shared hosts' concurrent-request
  limits), so the editor shows the real value or a plain-English reason (`fieldProblem()` in item/edit.js). Values typed into the ACF box show after the post is saved. **Security:** Authors can add these blocks and output is public, so it only reads ACF fields
  (`get_field_object`) or, for `post` only, unprotected post meta. Never read raw `get_option` /
  `get_user_meta`, names starting with `_`, or non-scalar values. Test with `blueprint-acf.json`
  (installs ACF, loads `acf/fields.php` as an mu-plugin, runs `acf/setup.php`) and `contact-acf.test.mjs`.
- **Item styles:** "Plain" (theme link look), "Button" (adds `wp-element-button`, so theme.json button
  styles apply; a zero-specificity 9999px radius copies core/button's default), "Outline" (2px currentColor border).
- **Icons** live once in `includes/contact-icons.json` (24×24 path lists, `evenodd` flag), read by
  `src/contact/icons.js` (imported JSON) and `wp_free_charts_contact_icon()`. Brand logos are from Simple
  Icons (CC0); LinkedIn isn't in Simple Icons any more, so it and email/phone/website are drawn here.
  Use **filled shapes, never stroke-only outlines**: the editor's block-icon CSS and many themes force
  `fill: currentColor` on SVGs, which turns outlines into solid boxes. The icon background is padding +
  background on the `<svg>` itself (`box-sizing: content-box`), so no extra markup.
- Tests: `tools/editor-test/contact.test.mjs <outDir>` and `contact-acf.test.mjs <outDir>` (print PASS/FAIL).
  `contact-save.test.mjs` saves posts and reports any non-JSON REST response; run it against
  `blueprint-acf-debug.json` (WP_DEBUG_DISPLAY on, so PHP warnings land in responses), with `--php=7.4`
  and the default PHP. That blueprint breaks Playground's auto-login, so the test logs in as admin/password.
- Playground quirks: under bursts of parallel requests its SQLite layer sometimes returns empty 500s
  (or "Cannot escape data without an active database connection") for *core* endpoints too; probe one
  request at a time before blaming the plugin. With `--login`, anonymous POSTs get redirected into GETs.

## Commands

```powershell
npm install --include=dev   # node_modules is not committed
npm run build               # always rebuild and commit build/ after src/ changes
npm run start               # watch mode
npm run test:unit           # table grid logic (node --test tools/tests/*.test.mjs)
powershell -ExecutionPolicy Bypass -File tools\visual-check\shoot.ps1   # chart screenshots -> tools\visual-check\out\
```

**Real-editor testing (table block, or anything editor-side):** WordPress Playground runs
WordPress in Node with no Docker or PHP install. Start it in the background with the repo mounted,
then drive it with `tools/editor-test/table-editor.test.mjs` (create/type/select/merge/colour/resize/
responsive screenshots), `table-stage4.test.mjs` (arrow keys, paste, fonts, transforms) and
`table-styles.test.mjs` (cards, stripes, radius, theme spacing/typography panels, old-post validity) and
`table-borders.test.mjs` (outer border, card label line breaks, 2.0.x deprecation).
The last two print PASS/FAIL. They use using playwright-core + installed Edge, headless. Copy the test files into the scratch
folder that has playwright-core so the import resolves. See the header of that file for the exact commands. Use `--mount-dir <path> <vfs>`, since the
`--mount=a:b` form can't parse Windows drive letters. Install playwright-core in a scratch folder,
not in the repo. The editor canvas is an iframe (`iframe[name="editor-canvas"]`). Close the welcome
modal first. Extra rich-text formats sit in the toolbar's "More" ▾ menu. Use `wp.data` in
`page.evaluate` for setup and assertions (e.g. `getBlocks()[0].isValid` after a reload).

The visual check renders all 8 chart types at 375px and 760px, with the legend top/right, plus a
filter grid with the 2nd button clicked off. Use `Read` on the PNGs to inspect them. To compare
against the last commit, extract `build/view.js` and `build/style-view.css` with `git show HEAD:…`
into a folder and pass `-BuildDir`.

## Releasing

1. Bump `Version:` in `wp-free-charts.php` (there's no version constant any more). Bump
   `version` in `src/block.json` too when CSS changes, since WordPress uses it to cache-bust the block CSS.
2. `npm run build`, commit (including `build/`), push.
3. Publish a GitHub release whose tag equals the version (e.g. `1.0.9`, no `v`).
   Sites check every 12h; "Check for updates" on the Plugins screen forces a check.

## Environment quirks (this Windows machine)

- `git` is not on PATH: use `& "C:\Program Files\Git\cmd\git.exe" …`. The Git install is missing
  `usr\bin\sh.exe`/`bash.exe`, so the Bash tool fails; use PowerShell. (VS Code push can fail with
  an askpass error for the same reason; fix with `git config --global credential.helper manager`.)
- Windows PowerShell 5.1 `Set-Content -Encoding utf8` writes a BOM, which breaks `package.json`.
  Use the Write/Edit tools or `[IO.File]::WriteAllText` with `UTF8Encoding($false)`.
- Line endings churn (CRLF/LF) makes diffs huge; use `git diff --ignore-all-space --ignore-cr-at-eol`
  to see real changes.
- Headless Edge has a ~500px minimum window width, which is why the harness uses iframes.
