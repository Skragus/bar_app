import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {validateTracker, readLocal, fetchTracker} from '../src/data.js';
import {group, checkbox, counter, validateData, STORAGE_KEY} from '../src/model.js';
const fixture = () => JSON.parse(readFileSync('public/tracker.json', 'utf8'));
test('canonical dataset validates with stable unique ids and expected progress', () => {
  const data = fixture(); const ids = entries => entries.flatMap(item => [item.id, ...(item.children ? ids(item.children) : [])]);
  assert.equal(ids(data.items).length, new Set(ids(data.items)).size);
  assert.deepEqual(validateTracker(JSON.parse(JSON.stringify(data))), data.items);
  assert.equal(spawnSync(process.execPath, ['scripts/validate-tracker.js']).status, 0);
  assert.throws(() => validateTracker({version:2, items:[]}));
  const duplicate = checkbox('duplicate');
  assert.throws(() => validateData([group('bad', [duplicate, duplicate])]));
  assert.throws(() => validateData([group('bad', [counter('bad', Infinity, 2)])]));
  assert.throws(() => validateData([group('bad', [{...checkbox('x'), children:[]}])]));
});
test('local migration reads legacy progress without writing or silently replacing corrupt data', () => {
  const items = fixture().items;
  const storage = {getItem(key) {assert.equal(key, STORAGE_KEY); return JSON.stringify(items);}, setItem() {throw new Error('must not write');}};
  assert.deepEqual(readLocal(storage).items, items);
  assert.equal(readLocal({getItem:()=>null}).items, null);
  const bad = readLocal({getItem:()=>'{broken'});
  assert.equal(bad.raw, '{broken'); assert.ok(bad.error); assert.equal(bad.items, null);
});
test('runtime loader resolves project path and bypasses cached data', async () => {
  let request;
  const items = await fetchTracker({baseURI:'https://skragus.github.io/bar_app/index.html', fetcher:async (url, options) => {request={url,options}; return {ok:true,json:async()=>fixture()};}});
  assert.deepEqual(items, fixture().items);
  assert.equal(request.url.pathname, '/bar_app/tracker.json');
  assert.ok(request.url.searchParams.has('v')); assert.equal(request.options.cache, 'no-store');
  await assert.rejects(fetchTracker({baseURI:'https://example.org/bar_app/', fetcher:async()=>({ok:false,status:404})}), /404/);
  await assert.rejects(fetchTracker({baseURI:'https://example.org/bar_app/', fetcher:async()=>({ok:true,json:async()=>({version:1,items:[{}]})})}), /Invalid/);
});
