# Bar-App

A quiet, single-page progress outline. React + Vite, without accounts, external APIs, or a backend.

## Development

Requires Node.js 22+ and npm.

```sh
npm ci
npm run dev -- --port 5173
```

Open the address printed by Vite. The app seeds three editable examples on its first visit. Use **Add group**, expand rows, and open the row's **…** menu to add nested groups, counters, single checkboxes, or a numbered batch. Use **Edit details** for names, notes, optional icons/image URLs, and counter values. Click counter values to edit them directly.

Checkbox display is a group presentation preference; changing list/tile display never changes the underlying units. Numbered batches switch that group's checkboxes to tiles. Move/reorder controls allow moving an item to any valid group, changing sibling order, or moving groups to the top level. A group cannot move inside itself or a descendant. Nonempty group deletion asks for confirmation.

Progress averages eligible immediate children equally, recursively. Empty groups do not count. Counter progress is capped at 100%, but the actual value can exceed its target. Targets must be positive and current values nonnegative. The percentage measures requirements completed, not effort remaining.

## Persistence and backups

All data, expansion state, and display settings are saved automatically to this browser's `localStorage` under `bar-app.v1`. This session has no ChatGPT Sites storage/publishing integration. Storage is specific to the browser and origin: no cross-device synchronization. Clearing site data removes progress. Use **…** in the top header to export/import JSON. Import validates before asking to replace existing data. Image URLs are optional remote resources; images themselves are not included in backups.

If saving fails, an on-screen warning appears; export a backup before leaving. If stored data is invalid, it is left untouched until you explicitly create/import changes.

## Validation

```sh
npm test
npm run build
npm run test:e2e
```

Browser tests use Playwright with `/usr/bin/chromium` by default. Set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to use another installed Chromium browser. Tests exercise deep nesting, mixed units, 13-checkbox batch creation, progress, layout switching, inline editing, movement, reload persistence, collapse state, search, JSON round-trips, invalid imports, and a mobile viewport. No credentials or external service is needed.

Build output is in `dist/`. Serve it with `npx vite preview --host 0.0.0.0 --port 4173`. Live processes need restarting after the cloud machine restarts. Use the existing checkout; cloud tasks are already isolated and do not need extra worktrees.
