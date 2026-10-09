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

Source files live in `src/`. The compiled plugin lives in `build/` and **must be committed** — the update checker installs updates from the GitHub release zip, which only contains committed files.

---

## Publishing a new release

Updates are delivered by the bundled [plugin-update-checker](https://github.com/YahnisElsts/plugin-update-checker) library (in `plugin-update-checker/`). It checks this repository for new GitHub releases — no extra plugin is needed on the site. Follow these steps every time you want to push an update.

### 1. Bump the version number

Edit `wp-free-charts.php` and update the `Version` line in the plugin header:

```php
 * Version:           1.0.1
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

The update checker compares the latest release tag against the installed `Version` header and surfaces the update in **Dashboard → Updates** on any site where the plugin is installed. It checks every 12 hours; use **Check for updates** on the Plugins screen to force a check.

> **Note:** Use the bare version number for the tag (e.g. `1.0.7`). A `v` prefix is tolerated, but keeping tags identical to the `Version` header avoids confusion.

---

## What goes to GitHub?

| Path | Committed? | Reason |
|---|---|---|
| `src/` | Yes | Source files |
| `build/` | Yes | Compiled output — required, since updates install straight from the release zip |
| `plugin-update-checker/` | Yes | Bundled update checker library |
| `wp-free-charts.php` | Yes | Main plugin file |
| `package.json` / `package-lock.json` | Yes | Dependency manifest |
| `node_modules/` | **No** | Auto-generated; install with `npm install --include=dev` |
