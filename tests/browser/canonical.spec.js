import {readFileSync} from 'node:fs';
import {createServer} from 'node:http';
import {test, expect} from '@playwright/test';
const fixture = () => JSON.parse(readFileSync('tests/fixtures/starter.json','utf8'));
test.beforeEach(async ({page}) => {
  await page.route('**/tracker.json?*', route => route.fulfill({contentType:'application/json', body:JSON.stringify(fixture())}));
});
const find = (items, name) => {for(const item of items){if(item.name===name)return item;const child=item.children&&find(item.children,name);if(child)return child;}};

test('canonical mode wins over preserved local progress; local edits never become central', async ({page}) => {
  const old = fixture().items; find(old,'Apex sinew').current = 999;
  await page.addInitScript(items => { if (!localStorage.getItem('bar-app.v1')) localStorage.setItem('bar-app.v1', JSON.stringify(items)); }, old);
  await page.goto('/');
  const value = page.getByRole('button',{name:'Edit values for Apex sinew'});
  await expect(value).toContainText('115'); await expect(value).toBeDisabled();
  await expect(page.getByRole('checkbox',{name:'Episode 1',exact:true})).toBeChecked();
  await expect(page.getByRole('checkbox',{name:'Episode 1',exact:true})).toBeDisabled();
  await expect(page.getByText('Your saved local progress differs', {exact:false})).toBeVisible();
  const saved = await page.evaluate(()=>localStorage.getItem('bar-app.v1'));
  const downloaded = page.waitForEvent('download'); await page.getByRole('button',{name:'Export local backup',exact:true}).click();
  const file = await (await downloaded).path();
  expect(JSON.parse(readFileSync(file,'utf8')).items).toEqual(old);
  await page.getByRole('button',{name:'Collapse RuneScape',exact:true}).click();
  await expect(page.getByRole('button',{name:'Expand RuneScape',exact:true})).toBeVisible();
  expect(await page.evaluate(()=>localStorage.getItem('bar-app.v1'))).toEqual(saved);
  await page.getByRole('button',{name:'Open local-only mode'}).click();
  await expect(value).toContainText('999');
  await page.getByRole('button',{name:'Increase Apex sinew'}).click();
  await expect(value).toContainText('1,000');
  await page.getByRole('button',{name:'Back to GitHub data'}).click();
  await page.getByRole('button',{name:'Expand RuneScape',exact:true}).click();
  await expect(value).toContainText('115');
  await page.reload(); await expect(value).toContainText('115');
  expect(find(JSON.parse(await page.evaluate(()=>localStorage.getItem('bar-app.v1'))),'Apex sinew').current).toBe(1000);
});

test('invalid or unavailable GitHub data fails safely and reload keeps last valid dataset', async ({page}) => {
  let data = fixture(); let broken = false;
  await page.route('**/tracker.json?*', route => route.fulfill({contentType:'application/json',body:broken ? '{bad' : JSON.stringify(data)}));
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('115');
  broken=true; await page.getByRole('button',{name:'Reload Data',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Could not load GitHub data');
  await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('115');
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('Could not load GitHub data');
  await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toHaveCount(0);
  broken=false; data={version:1,items:[{type:'group',name:'invalid'}]};
  await page.getByRole('button',{name:'Reload Data',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Invalid');
  data=fixture(); await page.getByRole('button',{name:'Reload Data',exact:true}).click();
  await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('115');
  expect(await page.evaluate(()=>localStorage.getItem('bar-app.v1'))).toBe(null);
});

test('built Pages artifact reads runtime JSON at project subpath and reflects data-only updates', async ({page}) => {
  expect(readFileSync('dist/tracker.json','utf8')).toEqual(readFileSync('public/tracker.json','utf8'));
  let data = fixture(); const paths=[];
  const server=createServer((req,res)=>{
    const path=new URL(req.url,'http://localhost').pathname; paths.push(path);
    if(path==='/bar_app/'||path==='/bar_app/index.html') {res.setHeader('Content-Type','text/html'); res.end(readFileSync('dist/bar-app.html'));}
    else if(path==='/bar_app/tracker.json') {res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));}
    else {res.statusCode=404;res.end();}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  try {
    await page.unroute('**/tracker.json?*');
    await page.goto(`http://127.0.0.1:${server.address().port}/bar_app/`);
    const existingId=find(data.items,'Apex sinew').id;
    await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('115');
    find(data.items,'Apex sinew').current=180;
    find(data.items,'RuneScape').children.push({id:'agent-new-grind',type:'group',name:'Agent-added grind',description:'',expanded:true,presentation:'list',children:[{id:'agent-step',type:'checkbox',name:'Complete step',complete:true}]});
    await page.getByRole('button',{name:'Reload Data',exact:true}).click();
    await expect(page.getByRole('button',{name:'Collapse Agent-added grind',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('180');
    await page.reload();
    await expect(page.locator(`[data-item-id="${existingId}"] > .item-row .counter-value`)).toContainText('180');
    await expect(page.getByRole('checkbox',{name:'Episode 1',exact:true})).toBeChecked();
    await expect(page.getByRole('checkbox',{name:'Episode 8',exact:true})).not.toBeChecked();
    expect(paths).toContain('/bar_app/tracker.json'); expect(paths).not.toContain('/tracker.json');
    await page.screenshot({path:'artifacts/github-desktop.png',fullPage:true});
    await page.setViewportSize({width:390,height:844});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:'artifacts/github-mobile.png',fullPage:true});
  } finally {await new Promise(resolve=>server.close(resolve));}
});

test('corrupt legacy storage remains exportable without blocking canonical data', async ({page}) => {
  await page.addInitScript(()=>localStorage.setItem('bar-app.v1','{broken-local-json'));
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('115');
  await expect(page.getByRole('alert')).toContainText('Stored data has not been overwritten');
  const downloaded=page.waitForEvent('download');
  await page.getByRole('alert').getByRole('button',{name:'Export local backup',exact:true}).click();
  const file=await (await downloaded).path();
  expect(readFileSync(file,'utf8')).toBe('{broken-local-json');
  expect(await page.evaluate(()=>localStorage.getItem('bar-app.v1'))).toBe('{broken-local-json');
});

for (const corrupt of [false, true]) {
  test(`explicit GitHub sync replaces ${corrupt ? 'corrupt' : 'different'} local data and clears the warning after reload`, async ({page}) => {
    const old = fixture().items; find(old,'Apex sinew').current=999;
    const raw=corrupt ? '{broken-local-json' : JSON.stringify(old);
    await page.addInitScript(raw => {if(localStorage.getItem('bar-app.v1')===null)localStorage.setItem('bar-app.v1',raw);}, raw);
    let data=fixture();
    await page.route('**/tracker.json?*', route=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)}));
    await page.goto('/');
    await expect(page.getByRole('button',{name:'Sync local from GitHub',exact:true})).toBeEnabled();
    await page.getByRole('button',{name:'Sync local from GitHub',exact:true}).click();
    const dialog=page.getByRole('alertdialog',{name:'Confirm GitHub sync'});
    expect(await page.evaluate(()=>localStorage.getItem('bar-app.v1'))).toBe(raw);
    const downloaded=page.waitForEvent('download');
    await dialog.getByRole('button',{name:'Export local backup',exact:true}).click();
    const file=await (await downloaded).path();
    const exported=readFileSync(file,'utf8');
    if(corrupt) expect(exported).toBe(raw); else expect(JSON.parse(exported).items).toEqual(old);
    await dialog.getByRole('button',{name:'Keep local progress'}).click();
    expect(await page.evaluate(()=>localStorage.getItem('bar-app.v1'))).toBe(raw);
    await page.getByRole('button',{name:'Sync local from GitHub',exact:true}).click();
    find(data.items,'Apex sinew').current=180; // Sync fetches fresh data, not the displayed snapshot.
    await dialog.getByRole('button',{name:'Replace local with GitHub'}).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('180');
    expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('bar-app.v1')))).toEqual(data.items);
    await expect(page.locator('.migration-notice')).toHaveCount(0);
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('180');
    await expect(page.locator('.migration-notice')).toHaveCount(0);
    await page.getByRole('button',{name:'Open local-only mode'}).click();
    await expect(page.getByRole('button',{name:'Edit values for Apex sinew'})).toContainText('180');
  });
}
for (const failure of ['invalid data', 'HTTP error', 'storage error']) {
  test(`GitHub sync preserves local progress on ${failure}`, async ({page}) => {
    const old=fixture().items; find(old,'Apex sinew').current=999;
    await page.addInitScript(items=>localStorage.setItem('bar-app.v1',JSON.stringify(items)),old);
    let fail=false;
    await page.route('**/tracker.json?*', route=>route.fulfill({status:fail && failure==='HTTP error' ? 503 : 200, contentType:'application/json', body: fail && failure==='invalid data' ? '{bad' : JSON.stringify(fixture())}));
    await page.goto('/');
    await expect(page.getByRole('button',{name:'Sync local from GitHub',exact:true})).toBeEnabled();
    fail=true;
    if(failure==='storage error') await page.evaluate(()=>{Storage.prototype.setItem=()=>{throw new Error('Storage unavailable');};});
    await page.getByRole('button',{name:'Sync local from GitHub',exact:true}).click();
    const dialog=page.getByRole('alertdialog',{name:'Confirm GitHub sync'});
    await dialog.getByRole('button',{name:'Replace local with GitHub'}).click();
    await expect(dialog.getByRole('alert')).toContainText('Your existing local data has been kept');
    expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('bar-app.v1')))).toEqual(old);
    await expect(page.locator('.migration-notice')).toBeVisible();
  });
}
