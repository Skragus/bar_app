import {readFileSync} from 'node:fs';
import {validateTracker} from '../src/data.js';
const path = process.argv[2] || 'public/tracker.json';
try {
  const items = validateTracker(JSON.parse(readFileSync(path, 'utf8')));
  const count = entries => entries.reduce((sum, item) => sum + 1 + (item.type === 'group' ? count(item.children) : 0), 0);
  console.log(`Valid tracker: ${items.length} root groups, ${count(items)} entries (${path}).`);
} catch (error) {
  console.error(`Invalid tracker (${path}): ${error.message}`);
  process.exitCode = 1;
}
