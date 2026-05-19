# WP Free Charts

A WordPress Gutenberg block for adding interactive charts (pie, bar, line, doughnut, polar area, radar, scatter) with spreadsheet-style data entry, theme colour integration, and front-end filters.

## Requirements

- WordPress 6.3+
- PHP 7.4+
- Node.js 18+ (for development only)

## Development

Install dependencies and start the watcher:

```bash
npm install --include=dev
npm run start        # live rebuild on save
npm run build        # production build
```

Source files live in `src/`. The compiled plugin lives in `build/` and **must be committed** — Git Updater serves it directly from the GitHub release zip.

---

## Publishing a new release

Follow these steps every time you want to push an update to sites running this plugin via [Git Updater](https://github.com/afragen/git-updater).

### 1. Bump the version number

Edit `wp-free-charts.php` and update **both** places:

```php
 * Version:           1.0.1          ← plugin header
...
define( 'WP_FREE_CHARTS_VERSION', '1.0.1' );   ← constant
```

Use [semantic versioning](https://semver.org/): `MAJOR.MINOR.PATCH`
- **Patch** (`1.0.1`) — bug fixes, no new features
- **Minor** (`1.1.0`) — new features, backward-compatible
- **Major** (`2.0.0`) — breaking changes (e.g. save format changes that require block recovery)

### 2. Build

```bash
npm run build
```

### 3. Commit everything

```bash
git add .
git commit -m "Release 1.0.1"
git push
```

### 4. Tag and create a GitHub Release

On GitHub: **Releases → Draft a new release**

- **Tag:** `1.0.1` (must match the `Version` header exactly)
- **Title:** `1.0.1` or a short description
- **Description:** brief change notes (shown in the WP update screen)
- Click **Publish release**

Git Updater reads the `Version` header in the tagged zip and surfaces the update in **Dashboard → Updates** on any site where the plugin is installed.

> **Note:** Do not prefix the tag with `v` — Git Updater matches it against the bare version number in the plugin header.

---

## What goes to GitHub?

| Path | Committed? | Reason |
|---|---|---|
| `src/` | Yes | Source files |
| `build/` | Yes | Compiled output — required for Git Updater |
| `wp-free-charts.php` | Yes | Main plugin file |
| `package.json` / `package-lock.json` | Yes | Dependency manifest |
| `node_modules/` | **No** | Auto-generated; install with `npm install --include=dev` |
