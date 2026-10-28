import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {startAppDemo} from '../scripts/preview-app.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.join(root,'mobile-build/timeline-tests');fs.mkdirSync(output,{recursive:true});
const server=await startAppDemo({port:0}),base=`http://127.0.0.1:${server.httpServer.address().port}`;
const at=text=>Date.parse(text)/1000;
const now='2026-10-26T04:00:00Z';
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:390,height:844},locale:'en-US',timezoneId:'Asia/Hong_Kong',reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],writes=[];
 page.on('pageerror',error=>errors.push(error.message));
 await page.clock.install({time:new Date(now)});
 const sample=await (await page.request.get(base+'/api/care')).json();
 let notes=[{id:'today-note',kind:'symptom',occurred_at:at('2026-10-26T02:05:00Z'),data:{description:'A short walk felt tiring.',area:'Legs',notes:'Rested afterwards.'},version:3},{id:'old-note',kind:'checkin',occurred_at:at('2026-10-25T02:00:00Z'),data:{feeling:'Resting today'},version:1}];
 const reading={id:'heart',device_id:'watch-a',device_name:'Same watch name',kind:'heart_rate',value:72,unit:'bpm',measured_at:at('2026-10-26T03:35:00Z'),timestamp_source:'phone_received'};
 const measurements=[reading,{...reading,id:'steps',kind:'steps',value:240,unit:'steps'},{...reading,id:'other-watch',device_id:'watch-b',value:76,timestamp_source:'sensor'},...Array.from({length:8},(_,index)=>({...reading,id:'older-'+index,measured_at:at(`2026-10-${25-index}T02:00:00Z`),value:70+index}))];
 let failDelete=true;
 await page.route('**/api/care',route=>route.fulfill({json:{...sample,records:notes,measurements}}));
 await page.route('**/api/care/record',async route=>{
  const body=route.request().postDataJSON();writes.push({path:'record',body});
  const index=notes.findIndex(note=>note.id===body.id);assert.ok(index>=0);assert.equal(body.version,notes[index].version);assert.equal(body.confirmed,true);
  notes[index]={...notes[index],data:body.data,occurred_at:Date.parse(body.occurredAt)/1000,version:body.version+1};await route.fulfill({json:{id:body.id}});
 });
 await page.route('**/api/care/delete-record',async route=>{
  const body=route.request().postDataJSON();writes.push({path:'delete',body});
  if(failDelete){failDelete=false;await route.fulfill({status:503,json:{error:'Test deletion unavailable'}});return;}
  notes=notes.filter(note=>note.id!==body.id);await route.fulfill({json:{ok:true}});
 });
 await page.goto(base+'/#care/timeline');
 const history=page.getByRole('region',{name:'Saved history',exact:true}),today=page.locator('.timeline-day[data-date="2026-10-26"]');
 await expect(today).toHaveAttribute('open','');
 await expect(page.locator('.timeline-day[open]')).toHaveCount(1);
 await expect(page.locator('.timeline-day')).toHaveCount(7);
 await expect(today.locator('.timeline-entries>article')).toHaveCount(3);
 await expect(today.locator('.timeline-entries>article').last()).toHaveClass(/timeline-note-entry/);
 await expect(today.locator('.timeline-reading-entry').first().locator('.timeline-values>span')).toHaveCount(2);
 await expect(today.locator('.timeline-daily-stat strong')).toHaveText('74 bpm');
 assert.equal(await today.locator('.timeline-daily-chart circle').count(),2);
 assert.equal(await today.locator('.timeline-daily-chart path, .timeline-daily-chart polyline').count(),0);
 await today.locator('.timeline-reading-entry').first().getByRole('button',{name:'About Reading details',exact:true}).click();
 await expect(page.getByRole('dialog',{name:'Reading details',exact:true})).toContainText('Phone receipt time');
 await page.keyboard.press('Escape');
 await expect(today.locator('.timeline-reading-entry').first().getByRole('button',{name:'About Reading details',exact:true})).toBeFocused();
 await today.getByRole('button',{name:'View note',exact:true}).click();await expect(today.getByText('Rested afterwards.',{exact:true})).toBeVisible();await today.getByRole('button',{name:'Hide note',exact:true}).click();
 await history.getByRole('button',{name:'Steps',exact:true}).click();await expect(today.locator('.timeline-reading-entry')).toHaveCount(1);await expect(page.locator('.timeline-daily-chart')).toHaveCount(0);await expect(today).toContainText('240');await expect(today.locator('.care-record')).toHaveCount(0);
 await history.getByRole('button',{name:'Heart',exact:true}).click();await expect(today.locator('.timeline-reading-entry')).toHaveCount(2);await expect(today.locator('.timeline-values')).not.toContainText(['240','240']);
 await history.getByRole('button',{name:'Notes',exact:true}).click();await expect(page.locator('.timeline-day')).toHaveCount(2);
 await history.getByRole('button',{name:'Choose date',exact:true}).click();let calendar=page.getByRole('dialog',{name:'Choose date',exact:true});await calendar.locator('input').fill('2026-10-25');await calendar.getByRole('button',{name:'View date',exact:true}).click();await expect(page.locator('.timeline-day')).toHaveCount(1);await expect(page.locator('.timeline-day[open]')).toHaveAttribute('data-date','2026-10-25');await expect(page.getByText('Resting today',{exact:true})).toBeVisible();
 await history.getByRole('button',{name:'Choose date',exact:true}).click();calendar=page.getByRole('dialog',{name:'Choose date',exact:true});await calendar.locator('input').fill('2000-01-01');await calendar.getByRole('button',{name:'View date',exact:true}).click();await expect(page.getByText('No saved entries for this date in the loaded history.',{exact:true})).toBeVisible();await history.getByRole('button',{name:'Show all history',exact:true}).click();await history.getByRole('button',{name:'More days',exact:true}).click();await expect(page.locator('.timeline-day')).toHaveCount(9);
 assert.deepEqual(writes,[],'Filters, expansion and dates must not write records');
 for(const [width,height] of [[320,844],[390,844],[430,932],[1280,900]]){
  await page.setViewportSize({width,height});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(output,`timeline-${width}.png`),fullPage:true});
 }
 await page.setViewportSize({width:320,height:844});await page.evaluate(()=>document.documentElement.style.fontSize='32px');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'large text must fit');await page.evaluate(()=>document.documentElement.style.fontSize='16px');
 await today.getByRole('button',{name:'Edit record',exact:true}).click();await page.getByLabel('What you experienced',{exact:true}).fill('Updated after resting.');await page.getByRole('button',{name:'Review my record',exact:true}).click();await page.getByRole('button',{name:'Confirm and save privately',exact:true}).click();await expect(today.getByText('Updated after resting.',{exact:true})).toBeVisible();assert.equal(writes.length,1);assert.equal(writes[0].body.id,'today-note');assert.equal(writes[0].body.version,3);
 await today.getByRole('button',{name:'Delete record',exact:true}).click();assert.equal(writes.length,1);await today.getByRole('button',{name:'Cancel',exact:true}).click();assert.equal(writes.length,1);
 await today.getByRole('button',{name:'Delete record',exact:true}).click();await today.getByRole('button',{name:'Confirm deletion',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Test deletion unavailable');await expect(today.getByText('Updated after resting.',{exact:true})).toBeVisible();await today.getByRole('button',{name:'Confirm deletion',exact:true}).click();await expect(today.locator('.care-record')).toHaveCount(0);assert.equal(notes.length,1);assert.equal(notes[0].id,'old-note');assert.equal(writes.length,3);
 assert.deepEqual(errors,[]);
 console.log('PASS: grouped timeline, daily chart, source details, dates, filters, older days, layout, note editing and confirmed deletion/retry.');
}catch(failure){
 if(browser)for(const context of browser.contexts())for(const page of context.pages())console.error('Timeline failure state:',page.url(),await page.locator('body').innerText());
 throw failure;
}finally{if(browser)await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
