import {test} from 'node:test';
import assert from 'node:assert/strict';
import {group, checkbox, counter, progress, moveItem, validateData, seed, findItem} from '../src/model.js';
test('equal weight of immediate eligible children, not descendant count', () => {
  const nested = group('many', Array.from({length: 13}, () => checkbox('', {complete:true})));
  assert.equal(progress(group('root', [nested, checkbox(), group('empty')])), .5);
  assert.equal(progress(group('empty')), null);
  assert.equal(progress(group('only empty', [group('empty')])), null);
  assert.equal(progress(counter('over', 529, 504)), 1);
  assert.equal(progress(counter('negative', -3, 10)), 0);
});
test('deep hierarchy and mixed units', () => {
  let node = group('leaf', [checkbox('', {complete:true}), counter('half', 5, 10)]);
  for(let i = 0; i < 8; i++) node = group('level ' + i, [node]);
  assert.equal(progress(node), .75); assert.doesNotThrow(() => validateData([node]));
});
test('moving and reordering preserve values, prevent cycles and root units', () => {
  const unit = counter('x', 115, 262), check = checkbox('done', {complete:true});
  const child = group('child', [unit, check]), root = group('root', [child]), other = group('other');
  let tree = [root, other];
  assert.equal(moveItem(tree, root.id, child.id), tree);
  assert.equal(moveItem(tree, unit.id, null), tree);
  tree = moveItem(tree, check.id, child.id, 0);
  assert.equal(findItem(tree, child.id).children[0].id, check.id);
  tree = moveItem(tree, unit.id, other.id);
  assert.deepEqual(findItem(tree, unit.id), unit);
  assert.equal(findItem(tree, child.id).children.length, 1);
  assert.deepEqual(findItem(tree, check.id), check);
  tree = moveItem(tree, other.id, null, 0);
  assert.equal(tree[0].id, other.id);
});
test('backup validation rejects corrupt data without altering valid data', () => {
  const tree = seed(); assert.deepEqual(validateData(JSON.parse(JSON.stringify(tree))), tree);
  assert.throws(() => validateData([checkbox()]));
  assert.throws(() => validateData([group('bad', [{...checkbox(), children:[]}])]));
  assert.throws(() => validateData([group('bad', [counter('zero', 1, 0)])]));
  assert.throws(() => validateData([tree[0], tree[0]]));
});
