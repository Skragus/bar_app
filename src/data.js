import {STORAGE_KEY, validateData} from './model.js';

export function validateTracker(data) {
  if (!data || data.version !== 1) throw new Error('Unsupported tracker version; expected version 1.');
  validateData(data.items);
  return data.items;
}

export function readLocal(storage) {
  let raw = null;
  try {
    raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    return {raw, items: raw === null ? null : validateData(JSON.parse(raw)), error: ''};
  } catch {
    return {raw, items: null, error: 'Local progress could not be read. Export your local backup before making local edits. Stored data has not been overwritten.'};
  }
}

export async function fetchTracker({baseURI = document.baseURI, signal, fetcher = fetch} = {}) {
  // Resolve beside index.html, including the GitHub Pages /bar_app/ project path.
  const url = new URL('./tracker.json', baseURI);
  url.searchParams.set('v', Date.now().toString());
  const response = await fetcher(url, {cache: 'no-store', signal});
  if (!response.ok) throw new Error(`Tracker request failed (HTTP ${response.status}).`);
  return validateTracker(await response.json());
}
