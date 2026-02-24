# Handoff Document — movieboyz-site

_Last updated: 2026-02-23_

---

## Goal

Static GitHub Pages SPA (Fantasy Box Office league dashboard) at
`dthunder746.github.io/movieboyz-site` (or custom domain via CNAME).

Displays per-owner profit leaderboard, an interactive Chart.js profit-over-time
graph, and a Tabulator data table — all linked via a shared multi-select owner
filter.

---

## Current Progress

### Completed this session

1. **Bug fixes** — four bugs in the linked filter system:
   - Unreleased movies appeared on per-movie chart → filtered with `release_date <= latestDate`
   - Leaderboard active-card highlight ignored → switched from `border-color` (overridden by Bootstrap `!important`) to `outline`
   - Owner-filter Clear button didn't update leaderboard → wired through shared state
   - Per-movie chart tooltip misaligned → all datasets padded with `y: 0` before release date so `mode: 'index'` works

2. **Two-way filter linking** — clicking leaderboard cards or owner-filter buttons both drive the same state; all three components (leaderboard, chart, table) re-render on every change

3. **Modular multi-select filter** — `createOwnerFilter` (Set-based toggle/clear + `onChange` callback); leaderboard/chart/table are pure render functions that accept `activeOwners[]`

4. **Separate colour palettes** — `PALETTE` (muted Tableau-10) for owner lines; `MOVIE_PALETTE` (vivid 20-entry) for per-movie lines. Wraps at 20 movies.

5. **JS split into ES modules** (committed `c4a18c7`) — extracted ~700 lines from `index.html` into seven files; `index.html` now contains only markup, styles, CDN tags, and the inline theme-restore snippet.

6. **Tabulator JS CDN tag restored** — the script tag was missing after the split (only the CSS link was present); added back. **This fix is not yet committed** (see Next Steps).

### Module map (`js/`)

| File | Exports | Notes |
|------|---------|-------|
| `utils.js` | `fmt`, `colorClass`, `fmtTimestamp`, `formatShortDate`, `formatDayMonth`, `formatWeekLabel`, `isoWeekBounds`, `daysRunning`, `grossAsOf`, `dailyDelta` | Pure helpers, no DOM |
| `palettes.js` | `PALETTE`, `MOVIE_PALETTE`, `buildMoviePalette(n)`, `buildColorMap(owners)` | Colour palettes |
| `filter.js` | `createOwnerFilter(onChange)` | Set-based toggle/clear state |
| `leaderboard.js` | `buildLeaderboard(data, owners, colorMap, latestDate, activeOwners)` | Pure render |
| `chart.js` | `buildChart(data, owners, colorMap, activeOwners)` → Chart instance | 3-mode: 0=all owners, 1=per-movie, 2+=selected owners |
| `table.js` | `buildTable(data, owners, colorMap, latestDate)` → Tabulator instance; `buildOwnerFilter(owners, colorMap, activeOwners)` | UMD globals: `Tabulator` |
| `app.js` | Entry point | Wires everything; module-level `_chart`, `_table` |

### CDN globals (loaded via `<script src>` before the module)

- `Bootstrap 5.3.3`
- `Tabulator 6.3.0` (both CSS and JS via unpkg)
- `Chart.js 4.4.4` + `chartjs-adapter-date-fns 3.0.0`
- `Hammer.js 2.0.8` + `chartjs-plugin-zoom 2.0.1`

### Branch state

- On `dev`, **2 commits ahead of `origin/dev`**, not yet pushed
- `index.html` has **1 unstaged change** (Tabulator JS script tag)
- `main` is behind `dev` by those same 2 commits (not deployed yet)

---

## What Worked

- **ES modules + zero-build**: `type="module"` script deferred by default; UMD CDN globals remain accessible from inside modules. No bundler needed for GitHub Pages.
- **Single source of truth for filter state**: `createOwnerFilter` with one `onChange` callback; all components re-render. Eliminated all bidirectional sync complexity.
- **Event delegation on containers**: Leaderboard and owner-filter click handlers survive `innerHTML` re-renders.
- **`outline` instead of `border-color`** for active card highlight: Bootstrap `.border` uses `!important`, so inline `border-color` has no effect. `outline` is unaffected.
- **Hex alpha suffix `+ '22'`** for `backgroundColor`: cleaner than string-replacing HSL; works with both palettes.
- **Pre-release zero-padding** for per-movie chart: keeps all datasets on the same x-range so `interaction.mode: 'index'` works correctly.

---

## What Didn't Work

- **Inline `border-color`/`border-width` for active cards**: Overridden by Bootstrap `.border` `!important`. Use `outline` instead.
- **HSL string manipulation for alpha** (`color.replace('hsl(','hsla(')...`): Broke silently when palette switched to hex colours. Use `color + '22'` (8-digit hex alpha).
- **Changing `interaction.mode` to `'x'`**: Rejected in favour of padding data with zeros so `mode: 'index'` keeps working.
- **Inline `onchange="toggleTheme(this)"`**: Doesn't work with ES modules (function not in global scope). Use `addEventListener` in the module instead.

---

## Next Steps

### Immediate (dev branch)

1. **Commit the Tabulator JS fix**:
   ```bash
   git add index.html
   git commit -m "fix: add missing Tabulator JS CDN script tag"
   ```

2. **Push dev and deploy to main**:
   ```bash
   git push origin dev
   git checkout main
   git merge dev
   git push
   git checkout dev
   ```

3. **Update `TODO.md`**: The "Linked chart/table/leaderboard" item in
   `/Users/marcus/Documents/Projects/TODO.md` is complete — mark it done or remove it.

### Pending (from TODO.md)

4. **movieboyz-fetcher — auto-update cron**: Add a cron script on the host that
   compares the Docker image digest before/after `docker pull` and recreates the
   container if it changed. See `/Users/marcus/Documents/Projects/TODO.md`.

---

## Local Development

```bash
# Fetch latest data
curl https://raw.githubusercontent.com/dthunder746/movieboyz-site/data/data.json -o data.json

# Serve locally (file:// won't work — fetch() needs HTTP)
python3 -m http.server 8080 --directory /Users/marcus/Documents/Projects/movieboyz-site
# then open http://localhost:8080
```
