import assert from 'node:assert/strict';
import {preview} from 'vite';
import {chromium,expect} from '@playwright/test';

const server=await preview({configFile:false,root:process.cwd(),build:{outDir:'mobile-www'},preview:{host:'127.0.0.1',port:0}});
const base=`http://127.0.0.1:${server.httpServer.address().port}`;
let browser;
try{
 browser=await chromium.launch({headless:true});
 const context=await browser.newContext({viewport:{width:375,height:812},locale:'en-US',reducedMotion:'reduce'});
 const page=await context.newPage(),errors=[],writes=[];
 page.on('pageerror',error=>errors.push(error.message));
 const me={user:{id:'profile-test',name:'Profile Member',email:'profile@example.invalid',account_type:'individual',role:'member',language:'en',location:'Hong Kong S.A.R. / Central and Western District',phone:'+85251234567',age_band:'65-74',skills:'Calligraphy',preferences:'Teaching',image:null,contributed:5400,received:0,completed_tasks:3,rating:null,reviews:[]},categories:[{id:'teaching',name:'Teaching'}],balance:{available:3600,reserved:0},agreements:[],verification:{canParticipate:true,organizations:[]},serverTime:Date.now()/1000};
 let failSave=true,failAvailability=false;
 let matching={mode:'in_person',days:'["Mon","Thu"]',timezone:'Asia/Hong_Kong',max_minutes:45};
 await page.route('**/api/**',async route=>{
  const endpoint=new URL(route.request().url()).pathname.slice(5);
  let body;
  if(endpoint==='setup')body={configured:true};
  else if(endpoint==='me'){
   if(route.request().method()==='POST'){
    const data=route.request().postDataJSON();writes.push(data);
    if(failSave){failSave=false;return route.fulfill({status:503,json:{error:'Profile storage unavailable'}});}
    Object.assign(me.user,{name:data.name,skills:data.skills,preferences:data.preferences,image:data.image,language:data.language});
   }
   body=me;
  }else if(endpoint==='matching-preferences'){
   if(route.request().method()==='POST'){
    const data=route.request().postDataJSON();
    if(failAvailability)return route.fulfill({status:503,json:{error:'Availability storage unavailable'}});
    matching={...data,days:JSON.stringify(data.days),max_minutes:Number(data.maxMinutes)};
   }
   body=matching;
  }else if(endpoint==='notifications/count')body={unread:0};
  else if(endpoint==='talent-profile')body={skills:me.user.skills,categories:['Teaching'],matching};
  else if(endpoint==='auth/logout')return route.fulfill({status:503,json:{error:'Sign out unavailable'}});
  else if(endpoint==='programs')body={programs:[],badges:[],matches:[]};
  else if(['tasks','recommendations'].includes(endpoint))body=[];
  else throw new Error(`Unexpected profile API request: ${endpoint}`);
  return route.fulfill({json:body});
 });
 await page.goto(base+'/#profile');
 await expect(page.getByRole('heading',{name:'My profile',exact:true})).toBeVisible();
 const summary=page.getByRole('region',{name:'Profile summary'});
 await expect(summary).toContainText('Profile Member');
 await expect(summary).toContainText('1 hr 30 min');
 await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Recent reviews',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Reset saved options',exact:true})).toBeHidden();
 await page.getByText('Agreements',{exact:true}).click();
 await expect(page.getByText('No signed agreements yet.',{exact:true})).toBeVisible();
 await page.getByText('Agreements',{exact:true}).click();
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await expect(page.locator('#profile-editor h2')).toBeFocused();
 await page.getByRole('textbox',{name:'Name',exact:true}).fill('Unsaved name');
 await page.getByLabel('Profile photo (PNG, JPEG or WebP, up to 1 MB)',{exact:true}).setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aL1sAAAAASUVORK5CYII=','base64')});
 await expect(page.getByRole('img',{name:'Profile preview',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await expect(page.getByRole('button',{name:'Edit profile',exact:true})).toBeFocused();
 await expect(summary).toContainText('Profile Member');
 assert.equal(writes.length,0);
 await page.getByRole('button',{name:/^Personal details/}).click();
 await expect(page.getByRole('img',{name:'Profile preview',exact:true})).toHaveCount(0);
 await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Profile Member');
 await page.getByRole('textbox',{name:'Name',exact:true}).fill('Updated Member');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.locator('#profile-editor').getByRole('alert')).toHaveText('Profile storage unavailable');
 await expect(page.getByRole('textbox',{name:'Name',exact:true})).toHaveValue('Updated Member');
 await page.getByRole('button',{name:'Save profile',exact:true}).click();
 await expect(page.locator('#profile-editor')).toHaveCount(0);
 await expect(summary).toContainText('Updated Member');
 assert.equal(writes.length,2);
 assert.equal(writes[1].skills,'Calligraphy');
 assert.equal(writes[1].preferences,'Teaching');
 assert.equal(writes[1].language,'en');
 await page.reload();
 await expect(summary).toContainText('Updated Member');
 await page.getByText('Availability',{exact:true}).click();
 await page.getByRole('spinbutton',{name:'Maximum minutes',exact:true}).fill('60');
 await page.waitForTimeout(1200);
 await expect(page.getByRole('spinbutton',{name:'Maximum minutes',exact:true})).toHaveValue('60');
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();
 await expect(page.locator('.profile-rows .filter')).toContainText('Your change has been saved.');
 assert.equal(matching.max_minutes,60);
 failAvailability=true;
 await page.getByRole('button',{name:'Save preferences',exact:true}).click();
 await expect(page.locator('.profile-rows .filter')).toContainText('Availability storage unavailable');
 await page.getByText('Availability',{exact:true}).click();
 for(const width of [320,375,768,1280]){
  await page.setViewportSize({width,height:812});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,`No horizontal overflow at ${width}px`);
  const row=page.getByRole('button',{name:'Programs & badges',exact:true});
  assert.ok((await row.boundingBox()).height>=44,'Navigation rows need accessible tap targets');
  await row.scrollIntoViewIfNeeded();
  await expect(row).toBeInViewport();
 }
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Sign out unavailable');
 await expect(summary).toBeVisible();
 await page.getByRole('button',{name:'My talents & interests',exact:true}).click();
 await expect(page.getByRole('heading',{name:'My talents',exact:true})).toBeVisible();
 await page.goto(base+'/#profile');
 await page.getByRole('button',{name:'Programs & badges',exact:true}).click();
 await expect(page.getByText('No programs have been published yet.',{exact:true})).toBeVisible();
 me.user.role='admin';
 me.user.account_type='organization';
 me.verification.organizations=[{id:'profile-org',status:'verified',review_due:Date.now()/1000+86400}];
 me.user.reviews=[{id:'review-1',author_name:'Reviewer',rating:5,feedback:'Helpful',created_at:1700000000}];
 await page.goto(base+'/#profile');
 await page.reload();
 await expect(page.getByRole('button',{name:'Community administration',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Community Partner Dashboard',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'My talents & interests',exact:true})).toHaveCount(0);
 await expect(page.getByRole('heading',{name:'Recent reviews',exact:true})).toBeVisible();
 me.user.role='member';
 me.user.account_type='individual';
 me.user.is_guest=1;
 me.needsOnboarding=true;
 me.verification.organizations=[];
 await page.reload();
 await page.getByRole('button',{name:'Edit profile',exact:true}).click();
 await expect(page.getByRole('textbox',{name:'Account email',exact:true})).toHaveCount(0);
 await expect(page.getByText('Guest account: use your recovery code instead of an email and password.',{exact:true})).toBeVisible();
 await expect(page.getByRole('textbox',{name:'Your full name',exact:true})).toBeVisible();
 await expect(page.getByRole('application',{name:'Handwritten signature',exact:true})).toBeVisible();
 me.user.is_guest=0;
 me.needsOnboarding=false;
 me.user.language='zh-Hant';
 await page.reload();
 await expect(page.getByRole('button',{name:'編輯個人檔案',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'我的社區',exact:true})).toBeVisible();
 await expect(page.getByRole('heading',{name:'帳戶',exact:true})).toBeVisible();
 assert.deepEqual(errors,[]);
 await context.close();
 console.log('Profile browser checks passed: overview, edit/photo/cancel/save/retry/reload, availability, role actions, guest onboarding, localization, reviews, navigation, and responsive layouts.');
}finally{
 await browser?.close();
 await server.close();
}
