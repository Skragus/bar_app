# Working on Bar-App

## Canonical progress data

`public/tracker.json` is the authoritative, publicly readable tracker. Edit this file for content changes; do not edit React components, seed functions, CSS, or configuration to update progress. GitHub Pages deploys pushes to `main` with `.github/workflows/pages.yml`. The browser loads the JSON at runtime beside the deployed page (`/bar_app/tracker.json`) with cache busting. The **Reload Data** button fetches the latest deployed file. A commit is visible only after its deployment finishes.

The default **GitHub-managed** view is read-only. Expanding groups is a temporary viewing preference, not a data update. Browser local-only mode uses `bar-app.v1` in localStorage and never writes to GitHub. The user can explicitly replace the local copy using **Sync local from GitHub**, with confirmation and an export option; failed fetches or storage writes leave the old copy intact. Otherwise old local progress is preserved with an export option; do not assume it has been merged into this file. An agent cannot inspect a user's browser data through the repository. If the user wants local progress incorporated, obtain their exported JSON and reconcile it explicitly, preserving unrelated canonical progress.

All tracker data and optional image URLs are public. Never put credentials, tokens, or private personal information here. Do not add browser write credentials or write endpoints.

## Format

The file is UTF-8 JSON with this envelope (also used for exported backups):

```json
{"version": 1, "items": []}
```

`items` is an ordered array of root groups. Each entry has a globally unique, stable, nonempty string `id`, `type`, and string `name`. Optional `description`, `icon`, and `image` are strings. Icons may be emoji; the existing built-in icons are `tv`, `swords`, and `book`. Images are optional public HTTP(S) URLs. Keep existing optional fields when modifying an entry.

- **Group:** `type: "group"`, nonempty `name`, boolean `expanded`, `presentation: "list"` or `"tiles"`, and a `children` array. Children may mix groups, checkboxes, and counters. Keep `children: []` for empty groups. Nesting is supported up to a defensive limit of 100 levels and 50,000 total entries.
- **Checkbox:** `type: "checkbox"`, boolean `complete`, optional positive integer `number`. May have a name, a number, or both. It is terminal: never add `children`, counters, or nested progress to it. Numbered checkboxes in the same group must have distinct numbers. Use the next unused number when adding a batch. A group's `presentation` controls its direct checkbox display; switching presentation never changes completion or IDs.
- **Counter:** `type: "counter"`, nonempty `name`, finite numeric `current >= 0`, finite numeric `target > 0`. Values may be decimal. It is terminal and has no `children`. `current` may exceed `target`; keep the true value (e.g. 529/504).

Progress is calculated by `progress()` in `src/model.js`: an equal-weight average of eligible immediate children, recursively; checked boxes are 1, unchecked boxes 0, counter ratios are clamped to [0, 1], and groups without progress-bearing descendants are excluded. Do not store percentages or change this calculation to edit data.

## Read and update safely

1. Use the existing checkout; each cloud task is already isolated. Do not create worktrees unless requested.
2. Inspect `git status`, fetch the current branch, and read the complete tracker before editing. Never discard existing local changes or reset the checkout to make a push succeed.
3. Find an existing record by its stable ID and full group path. Search names and inspect parents before adding anything. Duplicate names under different groups can be intentional; names alone are not identities. The validator rejects repeated IDs; semantic duplicates and accidentally repeated batch numbers still require this inspection.
4. For a new entry, generate a fresh UUID (`node -e 'console.log(crypto.randomUUID())'`) or another unique stable string. Existing IDs must survive renames, reordering, progress updates, and moves. Do not regenerate the whole dataset or run a seed function to update a grind.
5. Modify only the requested records. Preserve unrelated current values, completion, IDs, optional metadata, and child order. For a move, remove the original object and insert the SAME object in the destination's `children` array. Reorder by changing array position. Do not copy it and leave a duplicate. Never move a group into itself or a descendant. Only groups can be roots.
6. Delete only what the user requested; deleting a group deletes its descendants. Review the entire affected subtree first. Never replace the whole dataset with an abbreviated example.
7. Review `git diff -- public/tracker.json` for unrelated resets, removed IDs, duplicated records, or accidental replacements. JSON validation cannot infer user intent, so a passing validator does not replace reviewing the diff.

## Worked examples

**Add a grind:** after checking there is no existing entry at the requested path, insert the following object into the intended parent group's `children` array. Replace illustrative IDs with newly generated unique IDs. This is a generic structural example, not researched requirements; do not add it unless requested.

```json
{
  "id": "new-grind-uuid",
  "type": "group",
  "name": "Example grind",
  "description": "",
  "expanded": true,
  "presentation": "list",
  "children": [
    {"id": "new-counter-uuid", "type": "counter", "name": "Materials collected", "current": 0, "target": 100},
    {"id": "new-check-uuid", "type": "checkbox", "name": "Assembled", "complete": false}
  ]
}
```

For a numbered batch, add terminal checkbox objects with distinct fresh IDs and `number: 1` through `number: 13`, each `complete: false` (or the next unused sequence if the group already has numbered units), and set the parent `presentation` to `"tiles"`.

**Increment a counter:** find its ID by reading the JSON, then update only its `current`. This example requires the ID explicitly and fails if it is not a counter; it leaves every other field intact:

```sh
node --input-type=module - COUNTER_ID <<'JS'
import {readFileSync, writeFileSync} from 'node:fs';
import {findItem} from './src/model.js';
import {validateTracker} from './src/data.js';
const path = 'public/tracker.json';
const data = JSON.parse(readFileSync(path, 'utf8'));
validateTracker(data);
const item = findItem(data.items, process.argv[2]);
if (!item || item.type !== 'counter') throw new Error('Counter ID not found');
item.current += 1;
validateTracker(data);
writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
JS
```

To complete a checkbox set `complete: true`; rename by changing `name`; edit notes/images by changing `description`/`image`. To read a grind's progress use `findItem` and `progress` from `src/model.js` rather than summing unlike units.

## Validation and data-only commits

Run `npm ci` if dependencies are absent. Then:

```sh
npm run validate:data
npm test
npm run build
```

`npm run validate:data -- /path/to/candidate.json` validates another candidate without touching canonical data. Invalid JSON, unsupported versions, duplicate IDs, invalid nesting, unit children, and invalid counters fail with nonzero exit status. The build and Pages CI validate data before deployment. For application/loading changes also run `npm run test:e2e` (system Chromium at `/usr/bin/chromium`, overridable via `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`).

After reviewing the diff, stage only `public/tracker.json` for a data-only update, commit with a description of the requested progress change, and push the intended branch. Do not stage unrelated code or user edits.

### Concurrent agent updates

Use optimistic concurrency; never force-push or overwrite newer progress.

- **Git workflow:** begin from the current remote tip and record the base commit. Before pushing, fetch again. A normal non-force push protects against a remote advance. If it is rejected or the remote changed, re-read the latest tracker, reconcile the requested changes against it, and rerun validation. Do not resolve a JSON conflict by accepting one entire side. In particular, two updates to the same counter require reconciling the intended increments/absolute values; do not blindly rebase a stale absolute value. Preserve other agents' records and progress.
- **GitHub Contents API:** read the current file and its blob `sha`, then supply that exact SHA with the update request. On a conflict, read the new content/SHA and reconcile before retrying. Reuse the authenticated GitHub connection; never write tokens into this repo or browser JavaScript.

After pushing, inspect the Pages workflow result and the deployed tracker if access is available. Report whether deployment was actually verified; a local build or successful push alone does not prove publication.
