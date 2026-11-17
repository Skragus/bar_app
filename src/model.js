export const STORAGE_KEY = 'bar-app.v1';
export const uid = () => crypto.randomUUID();
export const group = (name, children = [], extra = {}) => ({ id: uid(), type: 'group', name, description: '', expanded: true, presentation: 'list', children, ...extra });
export const checkbox = (name = '', extra = {}) => ({ id: uid(), type: 'checkbox', name, description: '', complete: false, ...extra });
export const counter = (name, current = 0, target = 100) => ({ id: uid(), type: 'counter', name, description: '', current, target });
export function progress(item) {
  if (item.type === 'checkbox') return item.complete ? 1 : 0;
  if (item.type === 'counter') return Math.min(1, Math.max(0, item.current / item.target));
  const eligible = item.children.map(child => ({value: progress(child), weight: child.weight ?? 1}))
    .filter(child => child.value !== null && child.weight > 0);
  if (!eligible.length) return null;
  // Normalizing by the largest weight prevents overflow for finite large weights.
  const scale = eligible.reduce((max, child) => Math.max(max, child.weight), 0);
  let weightedProgress = 0, totalWeight = 0;
  for (const child of eligible) {
    const weight = child.weight / scale;
    weightedProgress += weight * child.value;
    totalWeight += weight;
  }
  return Math.min(1, Math.max(0, weightedProgress / totalWeight));
}
export function updateItem(items, id, update) {
  return items.map(item => item.id === id ? update(item) : item.type === 'group' ? { ...item, children: updateItem(item.children, id, update) } : item);
}
export function findItem(items, id) {
  for (const item of items) { if (item.id === id) return item; if (item.type === 'group') { const found = findItem(item.children, id); if (found) return found; } }
}
export function removeItem(items, id) {
  return items.filter(item => item.id !== id).map(item => item.type === 'group' ? { ...item, children: removeItem(item.children, id) } : item);
}
export function contains(item, id) { return item.id === id || (item.type === 'group' && item.children.some(child => contains(child, id))); }
export function moveItem(items, id, parentId, index = Infinity) {
  const item = findItem(items, id);
  if (!item || (parentId && (contains(item, parentId) || findItem(items, parentId)?.type !== 'group')) || (!parentId && item.type !== 'group')) return items;
  const remaining = removeItem(items, id);
  const insert = children => { const result = [...children]; result.splice(Math.max(0, Math.min(index, result.length)), 0, item); return result; };
  return parentId ? updateItem(remaining, parentId, parent => ({ ...parent, children: insert(parent.children) })) : insert(remaining);
}
export function groupOptions(items, prefix = '') {
  return items.flatMap(item => item.type === 'group' ? [{ id: item.id, label: prefix + item.name }, ...groupOptions(item.children, prefix + item.name + ' / ')] : []);
}
export function validateData(value) {
  const ids = new Set(); let count = 0;
  function validate(items, depth = 0) {
    if (!Array.isArray(items) || depth > 100) throw new Error('Invalid outline or nesting exceeds 100 levels.');
    for (const item of items) {
      if (++count > 50000) throw new Error('This file contains too many items.');
      if (!item || typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id) || typeof item.name !== 'string' || !['group', 'checkbox', 'counter'].includes(item.type)) throw new Error('Invalid or duplicate item in this file.');
      ids.add(item.id);
      if (item.weight !== undefined && (!Number.isFinite(item.weight) || item.weight < 0)) throw new Error('Progress weight must be a finite nonnegative number.');
      if (item.type !== 'checkbox' && !item.name.trim()) throw new Error('Groups and counters need a name.');
      for (const key of ['description', 'image', 'icon']) if (item[key] !== undefined && typeof item[key] !== 'string') throw new Error('Invalid item details.');
      if (depth === 0 && item.type !== 'group') throw new Error('Top-level items must be groups.');
      if (item.type === 'group') {
        if (!['tiles', 'list'].includes(item.presentation) || typeof item.expanded !== 'boolean') throw new Error('Invalid group presentation.');
        validate(item.children, depth + 1);
      } else {
        if ('children' in item) throw new Error('Progress units cannot have children.');
        if (item.type === 'checkbox' && typeof item.complete !== 'boolean') throw new Error('Invalid checkbox.');
        if (item.number !== undefined && (!Number.isInteger(item.number) || item.number < 1)) throw new Error('Invalid checkbox number.');
        if (item.type === 'counter' && (!Number.isFinite(item.current) || item.current < 0 || !Number.isFinite(item.target) || item.target <= 0)) throw new Error('Counters need a nonnegative current and positive target.');
      }
    }
  }
  validate(value); return value;
}
export function seed() {
  return [
    group('Television', [group('Example Show', [group('Season 1', Array.from({length: 8}, (_, i) => checkbox('', {number: i + 1, complete: i < 3})), {description: 'One episode at a time.', presentation: 'tiles'}), group('Season 2', [counter('Episodes watched', 6, 13)])])], {icon: 'tv'}),
    group('RuneScape', [group('Masterwork Ranged', [group('Havenhythe Materials', [counter('Apex hides', 529, 504), counter('Apex sinew', 115, 262)]), group('Nex Materials', [checkbox('Materials acquired')])])], {icon: 'swords'}),
    group('Reading', [group('Sun Eater', [group('Demon in White', [counter('Percent read', 68, 100)])])], {icon: 'book'})
  ];
}
