import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {group, checkbox, counter, progress, validateData, moveItem, updateItem, findItem} from '../src/model.js';
import {validateTracker, readLocal} from '../src/data.js';
const weightedCounter = (name, current, target, weight) => ({...counter(name,current,target), weight});
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12, `${actual} != ${expected}`);

test('unweighted legacy data matches the old calculation and the current canonical data validates', () => {
  validateTracker(JSON.parse(readFileSync('public/tracker.json','utf8')));
  const data=JSON.parse(readFileSync('tests/fixtures/starter.json','utf8'));
  validateTracker(data);
  function old(item) {
    if(item.type==='checkbox') return item.complete ? 1 : 0;
    if(item.type==='counter') return Math.min(1,Math.max(0,item.current/item.target));
    const values=item.children.map(old).filter(value=>value!==null);
    return values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
  }
  function check(items) {for(const item of items){assert.equal(item.weight,undefined);assert.equal(progress(item),old(item));if(item.children)check(item.children);}}
  check(data.items);
});
test('weighted siblings use relative effort and cap counters above target', () => {
  const node=group('Goal', [checkbox('Rare drop',{complete:true,weight:8}), weightedCounter('Common materials',50,100,2), checkbox('Final assembly',{weight:.1})]);
  near(progress(node),9/10.1);
  node.children[1].current=200;
  near(progress(node),10/10.1);
});
test('weights apply independently at every nesting level and never alter leaf completion', () => {
  const child=group('Child',[checkbox('done',{complete:true,weight:3}),checkbox('todo')],{weight:4});
  near(progress(child),.75);
  near(progress(group('Parent',[child,weightedCounter('half',1,2,2)])),2/3);
  child.weight=0;
  near(progress(child),.75);
  near(progress(group('Parent',[child,counter('half',1,2)])),.5);
  assert.equal(progress(checkbox('done',{complete:true,weight:0})),1);
  assert.equal(progress(weightedCounter('half',1,2,0)),.5);
});
test('zero weights and empty subtrees are excluded, all-ineligible groups return null', () => {
  const empty=group('Empty',[],{weight:100});
  const onlyZero=group('Zero',[checkbox('x',{weight:0})]);
  assert.equal(progress(onlyZero),null);
  assert.equal(progress(group('Parent',[onlyZero,empty])),null);
  assert.equal(progress(group('Parent',[checkbox('done',{complete:true}),checkbox('ignored',{weight:0}),empty,onlyZero])),1);
  assert.equal(progress(group('Parent',[empty,weightedCounter('ignored',1,1,0)])),null);
});
test('finite extreme weights do not overflow or divide by zero', () => {
  for(const weight of [Number.MAX_VALUE,Number.MIN_VALUE]) {
    near(progress(group('Scaled',[weightedCounter('done',1,1,weight),weightedCounter('half',1,2,weight)])),.75);
  }
});
test('invalid weights on every entry type fail shared, canonical and local validation', () => {
  for(const weight of [-1,Infinity,-Infinity,NaN,'2',null,true,{},[]]) {
    for(const item of [group('group'),counter('counter'),checkbox('check')]) {
      const items=[group('root',[{...item,weight}])];
      assert.throws(()=>validateData(items),/Progress weight/);
      assert.throws(()=>validateTracker({version:1,items}),/Progress weight/);
      const local=readLocal({getItem:()=>JSON.stringify(items)});
      assert.ok(local.error);
    }
  }
  for(const weight of [0,.1,1,8,Number.MAX_VALUE]) assert.doesNotThrow(()=>validateData([group('x',[],{weight})]));
});
test('weights survive generic updates, movement, order changes, JSON backups and local loading', () => {
  const unit=weightedCounter('x',115,262,.1), source=group('Source',[checkbox('done',{weight:8,complete:true}),unit],{weight:0}), destination=group('Destination');
  let items=[source,destination];
  items=updateItem(items,unit.id,item=>({...item,name:'Renamed',current:116}));
  items=moveItem(items,unit.id,source.id,0);
  assert.equal(findItem(items,source.id).children[0].id,unit.id);
  items=moveItem(items,unit.id,destination.id);
  assert.equal(findItem(items,unit.id).weight,.1);
  const backup=JSON.parse(JSON.stringify({version:1,items}));
  assert.deepEqual(validateTracker(backup),items);
  assert.deepEqual(readLocal({getItem:()=>JSON.stringify(backup.items)}).items,items);
  assert.equal(findItem(backup.items,source.id).weight,0);
});
