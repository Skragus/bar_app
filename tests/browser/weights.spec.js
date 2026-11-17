import {readFileSync} from 'node:fs';
import {test,expect} from '@playwright/test';
const dataset = () => ({version:1,items:[
  {id:'weighted',type:'group',name:'Weighted goal',expanded:true,presentation:'tiles',children:[
    {id:'rare',type:'checkbox',name:'Rare drop',complete:true,weight:8},
    {id:'common',type:'counter',name:'Common materials',current:50,target:100,weight:2},
    {id:'assembly',type:'checkbox',name:'Final assembly',complete:false,weight:.1}
  ]},
  {id:'destination',type:'group',name:'Destination',expanded:true,presentation:'list',children:[]}
]});
const value=(page,id)=>page.locator(`[data-item-id="${id}"] > .item-row .group-progress > span`);
async function edit(page,name) {
  await page.getByRole('button',{name:'Actions for '+name,exact:true}).click();
  await page.getByRole('menuitem',{name:'Edit details',exact:true}).click();
}
async function local(page) {await expect(page.getByRole('button',{name:'Reload Data',exact:true})).toBeEnabled();await page.getByRole('button',{name:'Open local-only mode'}).click();}

test('weighted editing is optional and weights survive display, rename, move, export/import and reload', async ({page}) => {
  const data=dataset();
  await page.route('**/tracker.json?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(data)}));
  await page.goto('/');
  await expect(value(page,'weighted')).toHaveText('89%');
  await local(page);
  await edit(page,'Common materials');
  const form=page.getByRole('form');
  await expect(form.getByLabel('Progress weight',{exact:true})).not.toBeVisible();
  await form.getByText('Additional options',{exact:true}).click();
  await expect(form.getByLabel('Progress weight',{exact:true})).toHaveValue('2');
  await form.getByLabel('Progress weight',{exact:true}).fill('0');
  await form.getByRole('button',{name:'Save changes'}).click();
  await expect(value(page,'weighted')).toHaveText('99%');
  await expect(page.getByRole('button',{name:'Edit values for Common materials'})).toContainText('50');
  await edit(page,'Common materials');
  await form.getByLabel('Name',{exact:true}).fill('Common materials renamed');
  await form.getByRole('button',{name:'Save changes'}).click();
  // Switching presentations does not change weighting or checkbox completion.
  await page.getByRole('button',{name:'Actions for Weighted goal',exact:true}).click();
  await page.getByRole('menuitem',{name:'Show checkboxes as list'}).click();
  await expect(page.getByRole('checkbox',{name:'Rare drop',exact:true})).toBeChecked();
  await expect(value(page,'weighted')).toHaveText('99%');
  await page.getByRole('button',{name:'Actions for Common materials renamed',exact:true}).click();
  await page.getByRole('menuitem',{name:'Move or reorder'}).click();
  await page.getByRole('button',{name:'Move up',exact:true}).click();
  await page.getByRole('combobox',{name:'Destination',exact:true}).selectOption('destination');
  await page.getByRole('button',{name:'Move here'}).click();
  await expect(value(page,'destination')).toHaveText('—');
  await page.getByLabel('Backup options').click();
  const downloaded=page.waitForEvent('download');
  await page.getByRole('button',{name:'Export JSON',exact:true}).click();
  const path=await (await downloaded).path();
  const exported=JSON.parse(readFileSync(path,'utf8'));
  expect(exported.items[0].children.find(item=>item.id==='rare').weight).toBe(8);
  expect(exported.items[0].children.find(item=>item.id==='assembly').weight).toBe(.1);
  expect(exported.items[1].children[0]).toMatchObject({id:'common',weight:0,name:'Common materials renamed',current:50});
  await page.locator('input[type=file]').setInputFiles(path);
  await page.getByRole('button',{name:'Replace & import'}).click();
  await page.reload(); await local(page);
  await expect(value(page,'destination')).toHaveText('—');
  await edit(page,'Common materials renamed');
  await form.getByText('Additional options',{exact:true}).click();
  await expect(form.getByLabel('Progress weight',{exact:true})).toHaveValue('0');
});

test('unweighted group edits keep weight optional and new units accept fractional weights', async ({page}) => {
  await page.route('**/tracker.json?*',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(dataset())}));
  await page.goto('/'); await local(page);
  await edit(page,'Destination');
  const form=page.getByRole('form');
  await form.getByText('Additional options',{exact:true}).click();
  await expect(form.getByLabel('Progress weight',{exact:true})).toHaveValue('1');
  await form.getByLabel('Name',{exact:true}).fill('Renamed destination');
  await form.getByRole('button',{name:'Save changes'}).click();
  let saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('bar-app.v1')));
  expect(Object.hasOwn(saved[1],'weight')).toBe(false);
  await page.getByRole('button',{name:'Actions for Renamed destination',exact:true}).click();
  await page.getByRole('menuitem',{name:'Checkbox',exact:true}).click();
  await form.getByLabel('Name',{exact:true}).fill('Informational');
  await form.getByText('Additional options',{exact:true}).click();
  await form.getByLabel('Progress weight',{exact:true}).fill('.1');
  await form.getByRole('button',{name:'Create checkbox',exact:true}).click();
  saved=JSON.parse(await page.evaluate(()=>localStorage.getItem('bar-app.v1')));
  expect(saved[1].children[0].weight).toBe(.1);
  await expect(page.getByRole('checkbox',{name:'Informational',exact:true})).toBeVisible();
  await edit(page,'Informational');
  await form.getByText('Additional options',{exact:true}).click();
  await form.getByLabel('Progress weight',{exact:true}).fill('-1');
  await form.getByRole('button',{name:'Save changes'}).click();
  await expect(form).toBeVisible();
  expect(await form.getByLabel('Progress weight',{exact:true}).evaluate(input=>input.validity.rangeUnderflow)).toBe(true);
  await page.getByRole('button',{name:'Cancel editing'}).click();
  const bad=dataset();bad.items[0].weight=-1;
  await page.locator('input[type=file]').setInputFiles({name:'bad-weight.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(bad))});
  await expect(page.getByRole('status')).toContainText('Progress weight');
  expect(JSON.parse(await page.evaluate(()=>localStorage.getItem('bar-app.v1')))).toEqual(saved);
});

test('the actual canonical tracker loads without altering records',async ({page})=>{
  const data=JSON.parse(readFileSync('public/tracker.json','utf8'));
  await page.goto('/');
  for(const root of data.items) await expect(page.locator(`[data-item-id="${root.id}"] > .item-row .name`)).toHaveText(root.name);
  expect(await page.evaluate(()=>localStorage.getItem('bar-app.v1'))).toBe(null);
});
