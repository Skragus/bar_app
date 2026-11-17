# Bar-App

A single-page progress outline with nested groups, checkbox tiles, and counters. React + Vite; no backend or accounts.

## GitHub-managed tracking

`public/tracker.json` is the canonical public dataset. Ask an agent with repository access to read [AGENTS.md](AGENTS.md), edit the JSON, validate it, and commit the update. No application code changes are needed for progress updates. Pushes to `main` validate, build, and deploy through the existing GitHub Pages workflow.

The website loads `tracker.json` at runtime relative to its page, including at `https://skragus.github.io/bar_app/`. Refresh the page or choose **Reload Data** after deployment finishes. Fetches bypass browser caches and include a cache-busting query. There is no polling or browser-to-GitHub write path.

The default GitHub-managed view is read-only; groups still expand/collapse for viewing. **Export JSON** exports the displayed dataset. Failed reloads show an error and keep the previous valid data visible; an initial failure never falls back to old local progress or hardcoded examples.

## Existing local progress

Old `bar-app.v1` data is preserved. If it differs from GitHub, a notice offers **Export local backup** and **Open local-only mode** to review it. No automatic merge or silent replacement occurs. Local-only mode keeps the original browser editing features (creation, counters, checkboxes, list/tiles, moving, notes, imports). Edits are explicitly local, not synchronized to GitHub. Reloading always returns to GitHub-managed mode; re-enter local-only mode to see your saved local data. A fresh local workspace copies canonical data only when you explicitly open that mode.

Invalid local data is left untouched; export it before making local edits. Storage failures show a warning. Clearing site data removes local progress. Export before changing browsers or origins. To reconcile local changes with GitHub, give an agent your exported JSON and specify which changes to apply.

All GitHub data and image URLs are public. Do not store private information or credentials. Remote images are not embedded in exports. This app has no authentication, database, or write endpoints.

## Development

Node.js 22+ and npm:

```sh
npm ci
npm run dev -- --port 5173
```

Use the existing checkout; cloud tasks are already isolated and need no additional worktrees. Server processes must restart after the machine restarts.

```sh
npm run validate:data
npm test
npm run build
npm run test:e2e
```

Browser tests use `/usr/bin/chromium` (override with `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`). Tests cover core editing in explicit local mode, canonical loading at a project subpath, data-only updates, migration, invalid data, persistence, and narrow viewports.

Build output is `dist/`, including `tracker.json` and a bundled `bar-app.html`. The HTML still fetches `tracker.json` at runtime and must be served with it. It is no longer an offline single-file data snapshot. Preview with `npx vite preview --host 0.0.0.0 --port 4173`.

Progress is an equal-weight average of eligible immediate children, recursively. Empty groups do not contribute. Counter progress caps at 100%, while actual values may exceed targets. It measures requirements completed, not effort remaining.
