# WP Free Charts — notes for Claude

WordPress Gutenberg block (`wp-free-charts/chart`) that renders Chart.js v4 charts
(bar, horizontalBar, line, pie, doughnut, polarArea, radar, scatter) from spreadsheet-style
data, with theme colours and optional front-end filter buttons. Updates ship to sites from
GitHub releases via the bundled plugin-update-checker library.

## Layout

| Path | Role |
|---|---|
| `wp-free-charts.php` | Plugin header (`Version`), update checker setup, `register_block_type( build/ )` |
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
| `tools/visual-check/` | Headless-Edge screenshot harness (see below); excluded from release zips via `.gitattributes` |

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

## Commands

```powershell
npm install --include=dev   # node_modules is not committed
npm run build               # always rebuild and commit build/ after src/ changes
npm run start               # watch mode
powershell -ExecutionPolicy Bypass -File tools\visual-check\shoot.ps1   # screenshots -> tools\visual-check\out\
```

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
