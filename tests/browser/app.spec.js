import {readFileSync} from 'node:fs';
import {test, expect} from '@playwright/test';
async function openLocal(page) {
  await expect(page.getByRole('button', {name:'Reload Data', exact:true})).toBeEnabled();
  await page.getByRole('button', {name:'Open local-only mode', exact:true}).click();
}

const node = (page, name) => page.locator('.group-node').filter({has: page.getByRole('button', {name: 'Collapse ' + name, exact:true})}).last();
const actions = (page, name) => page.getByRole('button', {name: 'Actions for ' + name, exact:true}).click();
async function add(page, parent, type, name) {
  if (parent) {await actions(page, parent); await page.getByRole('menuitem', {name: type === 'group' ? 'Nested group' : type === 'checkbox' ? 'Checkbox' : 'Counter', exact:true}).click();}
  else await page.getByRole('button', {name:'Add group', exact:true}).click();
  const form = page.getByRole('form'); await form.getByLabel('Name', {exact:true}).fill(name); await form.getByRole('button', {name:'Create ' + type, exact:true}).click();
}
test('foundation acceptance: nesting, units, batch, layout, edits, moves, persistence', async ({page}) => {
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await openLocal(page);
  await expect(page.getByRole('heading', {name:'Your progress.'})).toBeVisible();
  await add(page, null, 'group', 'Level 1');
  for(let i = 2; i <= 5; i++) await add(page, 'Level ' + (i - 1), 'group', 'Level ' + i);
  await add(page, 'Level 5', 'checkbox', 'Task');
  await add(page, 'Level 5', 'counter', 'Pages');
  await actions(page, 'Level 5'); await page.getByRole('menuitem', {name:'Numbered checkboxes', exact:true}).click();
  const form = page.getByRole('form'); await form.getByLabel('Number of checkboxes').fill('13'); await form.getByRole('button', {name:'Create checkboxes'}).click();
  const leaf = node(page, 'Level 5'); await expect(leaf.getByRole('checkbox')).toHaveCount(14);
  await leaf.getByRole('checkbox', {name:'Episode 13', exact:true}).click();
  await expect(leaf.locator(':scope > .item-row .group-progress')).toContainText('7%');
  await actions(page, 'Level 5'); await page.getByRole('menuitem', {name:'Show checkboxes as list'}).click();
  await expect(page.getByRole('checkbox', {name:'Episode 13', exact:true})).toHaveAttribute('aria-checked', 'true');
  await actions(page, 'Level 5'); await page.getByRole('menuitem', {name:'Show checkboxes as tiles'}).click();
  await page.getByRole('button', {name:'Edit values for Pages'}).click();
  await page.getByLabel('Current', {exact:true}).fill('115'); await page.getByLabel('Target', {exact:true}).fill('262');
  await page.getByRole('button', {name:'Save changes'}).click();
  await expect(page.getByRole('button', {name:'Edit values for Pages'})).toContainText('115');
  await page.getByRole('button', {name:'Increase Pages'}).click(); await page.getByRole('button', {name:'Decrease Pages'}).click();
  await actions(page, 'Task'); await page.getByRole('menuitem', {name:'Edit details'}).click();
  await page.getByLabel('Name', {exact:true}).fill('Finished task'); await page.getByLabel('Note optional').fill('Keep this note'); await page.getByRole('button', {name:'Save changes'}).click();
  await page.getByRole('checkbox', {name:'Finished task', exact:true}).click();
  await actions(page, 'Finished task'); await page.getByRole('menuitem', {name:'Move or reorder'}).click();
  await page.getByRole('button', {name:'Move down', exact:true}).click();
  await page.getByLabel('Destination').selectOption({label:'Level 1 / Level 2 / Level 3 / Level 4'});
  await page.getByRole('button', {name:'Move here'}).click();
  await expect(page.getByRole('checkbox', {name:'Finished task', exact:true})).toHaveAttribute('aria-checked', 'true');
  const saved = await page.evaluate(() => localStorage.getItem('bar-app.v1'));
  await page.reload(); await openLocal(page);
  expect(await page.evaluate(() => localStorage.getItem('bar-app.v1'))).toEqual(saved);
  await expect(page.getByRole('checkbox', {name:'Finished task', exact:true})).toHaveAttribute('aria-checked', 'true');
  await expect(page.getByRole('button', {name:'Edit values for Pages'})).toContainText('262');
  await actions(page, 'Level 1'); await page.getByRole('menuitem', {name:'Delete group'}).click();
  await expect(page.getByRole('alertdialog', {name:'Confirm deletion'})).toBeVisible();
  await page.getByRole('button', {name:'Keep group'}).click();
  await page.getByRole('button', {name:'Collapse Level 1', exact:true}).click(); await page.reload(); await openLocal(page);
  await expect(page.getByRole('button', {name:'Expand Level 1', exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
test('search, export/import, invalid import, and mobile layout', async ({page}) => {
  await page.goto('/'); await openLocal(page); await page.getByLabel('Search outline').fill('Apex sinew');
  await expect(page.getByRole('button', {name:'Edit values for Apex sinew'})).toBeVisible();
  await expect(page.getByRole('button', {name:'Collapse Reading', exact:true})).toHaveCount(0);
  await page.getByLabel('Clear search').click();
  await page.getByLabel('Backup options').click();
  const downloadPromise = page.waitForEvent('download'); await page.getByRole('button', {name:'Export JSON'}).click();
  const download = await downloadPromise; const path = await download.path();
  await add(page, null, 'group', 'Disposable');
  await page.locator('input[type=file]').setInputFiles(path);
  await expect(page.getByRole('alertdialog', {name:'Confirm import'})).toBeVisible();
  await page.getByRole('button', {name:'Replace & import'}).click();
  await expect(page.getByRole('button', {name:'Collapse Disposable'})).toHaveCount(0);
  await page.locator('input[type=file]').setInputFiles({name:'bad.json', mimeType:'application/json', buffer:Buffer.from('{"version":1,"items":[{"type":"no"}]}')});
  await expect(page.getByRole('status')).toContainText('Import failed');
  await page.getByLabel('Dismiss notification').click();
  await page.screenshot({path:'artifacts/desktop.png', fullPage:true});
  await page.setViewportSize({width:390, height:844});
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('checkbox', {name:'Episode 8', exact:true}).click();
  await page.getByRole('button', {name:'Increase Apex sinew'}).click();
  await expect(page.getByRole('button', {name:'Edit values for Apex sinew'})).toContainText('116');
  await page.screenshot({path:'artifacts/mobile.png', fullPage:true});
});
test('standalone HTML loads tracker without JS assets and preserves local progress', async ({page}) => {
  const requests = [];
  page.on('request', request => requests.push(request.url()));
  await page.route('**/standalone.html', route => route.fulfill({contentType:'text/html', body:readFileSync('dist/bar-app.html', 'utf8')}));
  await page.goto('/standalone.html'); await openLocal(page);
  expect(requests.every(url => url.endsWith('/standalone.html') || url.includes('/tracker.json?'))).toBe(true);
  expect(requests.some(url => url.includes('/tracker.json?'))).toBe(true);
  await page.getByRole('checkbox', {name:'Episode 8', exact:true}).click();
  await page.reload(); await openLocal(page);
  await expect(page.getByRole('checkbox', {name:'Episode 8', exact:true})).toHaveAttribute('aria-checked', 'true');
  await page.setViewportSize({width:390, height:844});
  await page.getByLabel('Actions for checkbox 1', {exact:true}).click();
  await expect(page.getByRole('menuitem', {name:'Edit details'})).toBeInViewport();
  await page.getByRole('menuitem', {name:'Edit details'}).click();
  await page.getByRole('form').getByLabel('Name', {exact:true}).fill('Pilot');
  await page.getByRole('button', {name:'Save changes'}).click();
  await expect(page.getByRole('checkbox', {name:'Pilot', exact:true})).toBeVisible();
});
test('menus stay reachable and the outline fits narrow viewports', async ({page}) => {
  await page.goto('/'); await openLocal(page);
  for (const width of [1280, 768, 390, 320]) {
    await page.setViewportSize({width, height:844});
    await page.getByLabel('Actions for checkbox 1', {exact:true}).click();
    const menu = page.getByRole('menu');
    await expect(menu).toBeVisible();
    const bounds = await menu.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y + bounds.height).toBeLessThanOrEqual(844);
    await page.keyboard.press('Escape');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  const addButton = page.getByRole('button', {name:'Add group', exact:true});
  await addButton.focus();
  await expect(addButton).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('form', {name:'Create item'}).getByLabel('Name', {exact:true})).toBeFocused();
});
