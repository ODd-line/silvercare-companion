import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createServer,preview} from 'vite';
import {chromium,expect} from '@playwright/test';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const database=new DatabaseSync(':memory:');
let failBatch=false;
globalThis.__guestTestEnvironment={DB:{
 prepare(sql){return {bind(...values){return {
  async first(){return database.prepare(sql).get(...values)??null;},
  async all(){return {results:database.prepare(sql).all(...values)};},
  async run(){return {meta:{changes:Number(database.prepare(sql).run(...values).changes)}};},
 };}};},
 async batch(statements){
  database.exec('BEGIN');
  try{
   const results=[];
   for(const statement of statements){
    results.push(await statement.run());
    if(failBatch){failBatch=false;throw Error('Injected guest transaction failure');}
   }
   database.exec('COMMIT');return results;
  }catch(error){database.exec('ROLLBACK');throw error;}
 },
}};
const modules=await createServer({configFile:false,root,resolve:{alias:{'@':root}},server:{middlewareMode:true},plugins:[{
 name:'guest-test-environment',
 resolveId(id){if(id==='cloudflare:workers')return '\0guest-test-environment';},
 load(id){if(id==='\0guest-test-environment')return 'export const env=globalThis.__guestTestEnvironment;';},
}]});
let web,browser;
try{
 for(const file of fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')).sort())database.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
 const {GET,POST}=await modules.ssrLoadModule('/app/api/[...path]/route.ts');
 const {hash,password}=await modules.ssrLoadModule('/lib/bank.ts');
 async function call(endpoint,body,token,extra={}){
  const headers={'X-Timebank-Client':'native',...extra};
  if(body!==undefined)headers['Content-Type']='application/json';
  if(token)headers.Authorization='Bearer '+token;
  const response=await (body===undefined?GET:POST)(new Request('https://example.invalid/api/'+endpoint,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}));
  return {status:response.status,headers:response.headers,data:await response.json()};
 }
 const create={guestConsent:true,language:'en'};
 assert.equal((await call('auth/guest')).status,405);
 assert.equal((await call('auth/guest',create)).status,503);
 database.exec("INSERT INTO settings VALUES('configured','1'); INSERT INTO settings VALUES('onboarding_seconds','3600')");
 assert.equal((await call('auth/guest',{...create,guestConsent:false})).status,400);
 assert.equal((await call('auth/guest',{...create,language:'invalid'})).status,400);
 const first=await call('auth/guest',{...create,role:'admin',accountType:'organization'});
 assert.equal(first.status,200);
 assert.match(first.data.recoveryKey,/^[a-f0-9]{64}$/);
 assert.match(first.data.sessionToken,/^[a-f0-9]{64}$/);
 assert.equal(first.headers.get('Set-Cookie'),null);
 const firstMe=await call('me',undefined,first.data.sessionToken);
 assert.equal(firstMe.status,200);
 const userId=firstMe.data.user.id;
 assert.equal(firstMe.data.user.is_guest,1);
 assert.equal(firstMe.data.user.account_type,'individual');
 assert.equal(firstMe.data.user.role,'member');
 assert.equal(firstMe.data.user.password,undefined);
 assert.equal(firstMe.data.user.recovery,undefined);
 assert.equal(firstMe.data.needsOnboarding,true);
 assert.equal(firstMe.data.verification.canParticipate,false);
 assert.equal(firstMe.data.balance.total,3600);
 assert.equal(database.prepare('SELECT recovery FROM users WHERE id=?').get(userId).recovery,await hash(first.data.recoveryKey));
 assert.equal(database.prepare('SELECT id FROM sessions WHERE user_id=?').get(userId).id,await hash(first.data.sessionToken));
 for(const endpoint of ['tasks','ledger','notifications','recommendations','talent-profile','verification','programs'])assert.equal((await call(endpoint,undefined,first.data.sessionToken)).status,200,endpoint);
 assert.equal((await call('tasks',{},first.data.sessionToken)).status,403);
 assert.equal((await call('admin',undefined,first.data.sessionToken)).status,403);
 assert.equal((await call('me',{name:'Guest'},first.data.sessionToken)).status,400,'Profile rules remain enforced');
 assert.deepEqual((await call('care',undefined,first.data.sessionToken)).data,{needsSetup:true});
 assert.equal((await call('care/connect',{name:'Watch',permissions:['steps']},first.data.sessionToken)).status,428);
 assert.equal((await call('care/setup',{consent:false},first.data.sessionToken)).status,400);
 assert.equal((await call('care/setup',{consent:true},first.data.sessionToken)).status,200);
 const adapter=(await call('care/connect',{name:'Test watch',permissions:['steps']},first.data.sessionToken)).data;
 const measurement={id:'guest-step-test',kind:'steps',value:321,unit:'steps',measuredAt:new Date().toISOString(),timestampSource:'phone_received'};
 const upload=()=>call('care-device',{measurements:[measurement]},undefined,{Authorization:'CareDevice '+adapter.token});
 assert.equal((await upload()).status,200);
 assert.equal((await call('care',undefined,first.data.sessionToken)).data.measurements[0].value,321);

 const other=await call('auth/guest',create);
 assert.equal(other.status,200);
 assert.notEqual(other.data.recoveryKey,first.data.recoveryKey);
 assert.equal((await call('care/setup',{consent:true},other.data.sessionToken)).status,200);
 assert.deepEqual((await call('care',undefined,other.data.sessionToken)).data.measurements,[]);
 assert.equal((await call('care/disconnect',{id:adapter.id},other.data.sessionToken)).status,404);
 assert.equal((await call('care/connect',{ownerId:userId,name:'Other watch',permissions:['steps']},other.data.sessionToken)).status,409);

 database.exec('DELETE FROM rate_limits');
 const beforeCount=database.prepare('SELECT COUNT(*) AS count FROM users').get().count;
 failBatch=true;
 assert.equal((await call('auth/guest',create)).status,500);
 assert.equal(database.prepare('SELECT COUNT(*) AS count FROM users').get().count,beforeCount,'A failed session insert must not leave an orphan guest');
 assert.equal((await call('auth/guest-recover',{recoveryKey:'wrong'})).status,401);
 assert.equal((await call('auth/guest-recover',{recoveryKey:'0'.repeat(64)})).status,401);
 const recovered=await call('auth/guest-recover',{recoveryKey:first.data.recoveryKey});
 assert.equal(recovered.status,200);
 assert.equal(recovered.data.recoveryKey,undefined);
 assert.equal((await call('me',undefined,recovered.data.sessionToken)).data.user.id,userId);
 assert.equal((await call('me',undefined,first.data.sessionToken)).status,401);
 assert.equal((await upload()).status,401,'Recovery revokes old watch-upload credentials');
 assert.equal((await call('care',undefined,recovered.data.sessionToken)).data.measurements[0].value,321);
 assert.equal((await call('auth/logout',{},recovered.data.sessionToken)).status,200);
 assert.equal((await call('me',undefined,recovered.data.sessionToken)).status,401);
 const restored=await call('auth/guest-recover',{recoveryKey:first.data.recoveryKey});
 database.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(userId);
 assert.equal((await call('me',undefined,restored.data.sessionToken)).status,401);
 assert.equal((await call('auth/guest-recover',{recoveryKey:first.data.recoveryKey})).status,200);
 database.prepare('UPDATE users SET suspended=1 WHERE id=?').run(userId);
 assert.equal((await call('auth/guest-recover',{recoveryKey:first.data.recoveryKey})).status,403);
 assert.equal(database.prepare("SELECT COUNT(*) AS count FROM ledger WHERE type='onboarding'").get().count,2);

 const regularKey='1'.repeat(64),regularPassword='a-valid-test-password';
 database.prepare('INSERT INTO users(id,email,name,password,recovery) VALUES(?,?,?,?,?)').run('regular','regular@example.invalid','Regular member',await password(regularPassword),await hash(regularKey));
 assert.equal((await call('auth/guest-recover',{recoveryKey:regularKey})).status,401);
 const regular=await call('auth/login',{email:'regular@example.invalid',password:regularPassword});
 assert.equal(regular.status,200);
 assert.equal((await call('me',undefined,regular.data.sessionToken)).data.user.is_guest,0);
 assert.equal((await call('auth/recover',{email:'regular@example.invalid',password:regularPassword,recoveryKey:regularKey})).status,200);
 assert.equal((await call('me',undefined,regular.data.sessionToken)).status,401);
 const webGuest=await call('auth/guest',create,undefined,{'X-Timebank-Client':'',Origin:'https://example.invalid'});
 assert.equal(webGuest.status,200);
 assert.equal(webGuest.data.sessionToken,undefined);
 for(const attribute of ['HttpOnly','SameSite=Lax','Secure','Max-Age=604800'])assert.ok(webGuest.headers.get('Set-Cookie').includes(attribute));
 assert.equal((await call('auth/guest',create,undefined,{'X-Timebank-Client':'',Origin:'https://unrelated.invalid'})).status,403);
 assert.equal((await call('auth/guest',create,undefined,{Origin:'capacitor://localhost'})).headers.get('Access-Control-Allow-Origin'),'capacitor://localhost');
 for(let index=0;index<6;index++)assert.equal((await call('auth/guest',create,undefined,{'cf-connecting-ip':'guest-rate-test'})).status,index<5?200:429);
 console.log('PASS guest API: consent, atomic creation, hashed credentials, isolation, persistence after recovery, expiry, revocation, rate limiting, native/web sessions and existing member restrictions.');

 database.exec('DELETE FROM rate_limits');
 web=await preview({configFile:false,root,build:{outDir:'mobile-www'},preview:{host:'127.0.0.1',port:0},plugins:[{
  name:'guest-test-api',
  configurePreviewServer(server){
   server.middlewares.use((req,res,next)=>{
    if(!req.url?.startsWith('/api/')){next();return;}
    void (async()=>{
     const chunks=[];for await(const chunk of req)chunks.push(chunk);
     const headers=new Headers();
     for(const [key,value] of Object.entries(req.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(','):value);
     const request=new Request('http://'+req.headers.host+req.url,{method:req.method,headers,body:req.method==='POST'?Buffer.concat(chunks).toString():undefined});
     const response=await (req.method==='POST'?POST:GET)(request);
     res.writeHead(response.status,Object.fromEntries(response.headers));res.end(await response.text());
    })().catch(error=>{console.error(error);res.writeHead(500);res.end('Test API failed');});
   });
  },
 }]});
 const base='http://127.0.0.1:'+web.httpServer.address().port;
 browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:390,height:844},locale:'en-US',reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(base+'/#login');
 await page.getByRole('button',{name:'Continue as guest',exact:true}).click();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Create guest account',exact:true}).click();
 await page.getByRole('heading',{name:'Save your guest recovery code',exact:true}).waitFor();
 const recoveryCode=await page.locator('code.recovery').innerText();
 assert.match(recoveryCode,/^[a-f0-9]{64}$/);
 await expect(page.getByRole('button',{name:'Open app',exact:true})).toBeDisabled();
 await page.getByRole('checkbox').check();
 await page.getByRole('button',{name:'Open app',exact:true}).click();
 await page.getByRole('button',{name:'Allow private storage and continue',exact:true}).waitFor();
 const uiMe=await page.evaluate(async()=>await (await fetch('/api/me')).json());
 assert.equal(uiMe.user.is_guest,1);
 await page.route('**/api/care',route=>route.abort('internetdisconnected'));
 await page.reload();
 await expect(page.getByRole('region',{name:'PineTime Bluetooth connection'})).toBeVisible();
 await expect(page.getByRole('alert').filter({hasText:'Failed to fetch'})).toBeVisible();
 await expect(page.getByLabel('Save selected watch readings to my private Silver Bank account')).toBeDisabled();
 await page.unroute('**/api/care');
 await page.reload();
 await page.getByRole('button',{name:'Allow private storage and continue',exact:true}).click();
 await page.getByText('Not saving watch readings',{exact:true}).waitFor();
 const save=await page.evaluate(async()=>{
  const send=async(path,body)=>await (await fetch('/api/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})).json();
  const adapter=await send('care/connect',{name:'Browser transport fixture',permissions:['steps']});
  return await (await fetch('/api/care-device',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'CareDevice '+adapter.token},body:JSON.stringify({measurements:[{id:'browser-observation',kind:'steps',value:654,unit:'steps',measuredAt:new Date().toISOString(),timestampSource:'phone_received'}]})})).json();
 });
 assert.deepEqual(save,{ok:true,received:1});
 await page.reload();
 await page.getByText('Not saving watch readings',{exact:true}).waitFor();
 await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Care',exact:true}).click();
 await page.getByRole('menuitem',{name:'My Health',exact:true}).click();
 await expect(page.getByRole('group',{name:'Latest saved readings',exact:true}).locator('.care-history-value').last()).toHaveText('654 steps');
 for(const section of ['home','tasks','bank']){
  await page.goto(base+'/#'+section);
  await page.getByText('Guest account: your saved records are private. Keep your recovery code for future sign-ins.',{exact:false}).waitFor();
  await expect(page.getByRole('heading',{name:'Complete your community profile',exact:true})).toHaveCount(0);
 }
 await page.goto(base+'/#profile');
 await page.getByText('Guest account: use your recovery code instead of an email and password.',{exact:true}).waitFor();
 await expect(page.getByLabel('Account email',{exact:true})).toHaveCount(0);
 await expect(page.locator('[name="signature"]')).toBeVisible();
 await page.getByRole('button',{name:'Sign out',exact:true}).click();
 await page.getByRole('button',{name:'Continue as guest',exact:true}).click();
 await page.getByRole('button',{name:'Already have a guest recovery code?',exact:true}).click();
 await page.getByLabel('Guest recovery code',{exact:true}).fill('incorrect');
 await page.getByRole('button',{name:'Return to guest account',exact:true}).click();
 await page.getByRole('alert').filter({hasText:'Guest recovery code is incorrect.'}).waitFor();
 await page.getByLabel('Guest recovery code',{exact:true}).fill(recoveryCode);
 await page.getByRole('button',{name:'Return to guest account',exact:true}).click();
 await page.getByText('Not saving watch readings',{exact:true}).waitFor();
 const restoredUi=await page.evaluate(async()=>({me:await (await fetch('/api/me')).json(),care:await (await fetch('/api/care')).json()}));
 assert.equal(restoredUi.me.user.id,uiMe.user.id);
 assert.equal(restoredUi.care.measurements[0].value,654);
 assert.deepEqual(errors,[]);
 console.log('PASS guest browser: create, recovery-code acknowledgement, consent, database-backed readings across reload/logout/recovery, full navigation and profile setup. Watch radio transport is simulated.');
}finally{
 if(browser)await browser.close();
 if(web)await new Promise((resolve,reject)=>web.httpServer.close(error=>error?reject(error):resolve()));
 await modules.close();database.close();delete globalThis.__guestTestEnvironment;
}
