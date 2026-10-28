import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'vite';
import {WELCOME_CREDIT_SECONDS} from '../lib/credit-policy.mjs';

const migrations=fs.readdirSync('drizzle').filter(file=>file.endsWith('.sql')).sort();
const legacy=new DatabaseSync(':memory:');legacy.exec('PRAGMA foreign_keys=ON');
for(const file of migrations.slice(0,-1))legacy.exec(fs.readFileSync('drizzle/'+file,'utf8'));
legacy.exec(`INSERT INTO settings VALUES('onboarding_seconds','10800');
INSERT INTO users(id,email,name,password,recovery,role) VALUES('admin','admin@invalid.test','Admin','test','test','admin');
INSERT INTO users(id,email,name,password,recovery) VALUES('old-credit','old-credit@invalid.test','Old member','test','test'),('old-zero','old-zero@invalid.test','Old zero','test','test');
INSERT INTO identity_verifications(user_id,legal_name,birth_date,status) VALUES('old-credit','Old member','1990-01-01','under_review');
UPDATE identity_verifications SET status='verified',age_eligible=1,duplicate_status='clear',identity_key='old-identity',reviewer_id='admin',verified_at=unixepoch(),evidence_reference='Synthetic original review' WHERE user_id='old-credit';`);
const priorLedger=legacy.prepare('SELECT * FROM ledger ORDER BY id').all();assert.equal(priorLedger[0].amount,10800);
legacy.exec(fs.readFileSync('drizzle/'+migrations.at(-1),'utf8'));
assert.deepEqual(legacy.prepare('SELECT * FROM ledger ORDER BY id').all(),priorLedger,'Migration must preserve existing balances/history');
assert.equal(legacy.prepare("SELECT total FROM balances WHERE user_id='old-zero'").get().total,0);
legacy.exec("UPDATE settings SET value='0' WHERE id='onboarding_seconds'; INSERT INTO users(id,email,name,password,recovery) VALUES('new','new@invalid.test','New','test','test')");
assert.equal(legacy.prepare("SELECT total FROM balances WHERE user_id='new'").get().total,3600,'Legacy zero setting cannot disable the fixed grant');
assert.throws(()=>legacy.exec("INSERT INTO ledger(id,destination_id,amount,type,metadata) VALUES('duplicate','new',3600,'onboarding','duplicate')"),/UNIQUE/);
assert.throws(()=>legacy.exec("INSERT INTO ledger(id,destination_id,amount,type,metadata) VALUES('wrong','old-zero',7200,'onboarding','wrong amount')"),/invalid_signup_credit/);
legacy.close();

const database=new DatabaseSync(':memory:');database.exec('PRAGMA foreign_keys=ON');
for(const file of migrations)database.exec(fs.readFileSync('drizzle/'+file,'utf8'));
let failAfter=0;
globalThis.__welcomeTestEnvironment={ADMIN_SETUP_KEY:'welcome-test-only',VERIFICATION_HASH_KEY:'synthetic-test-key-'.repeat(4),DB:{
 prepare(sql){return {bind(...values){return {async first(){return database.prepare(sql).get(...values)??null;},async all(){return {results:database.prepare(sql).all(...values)};},async run(){return {meta:{changes:Number(database.prepare(sql).run(...values).changes)}};}};}};},
 async batch(statements){database.exec('BEGIN');try{const results=[];for(const statement of statements){results.push(await statement.run());if(failAfter&&!--failAfter)throw Error('Injected signup transaction failure');}database.exec('COMMIT');return results;}catch(error){database.exec('ROLLBACK');throw error;}}
}};
const modules=await createServer({configFile:false,root:process.cwd(),resolve:{alias:{'@':process.cwd()}},server:{middlewareMode:true},plugins:[{name:'welcome-test-env',resolveId(id){if(id==='cloudflare:workers')return '\0welcome-test-env';},load(id){if(id==='\0welcome-test-env')return 'export const env=globalThis.__welcomeTestEnvironment;';}}]});
try{
 const {GET,POST}=await modules.ssrLoadModule('/app/api/[...path]/route.ts');
 async function call(endpoint,body,token,extra={}){const headers={'X-Timebank-Client':'native',...extra};if(body!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization='Bearer '+token;const response=await (body===undefined?GET:POST)(new Request('https://example.invalid/api/'+endpoint,{method:body===undefined?'GET':'POST',headers,body:body===undefined?undefined:JSON.stringify(body)}));return {status:response.status,headers:response.headers,data:await response.json()};}
 const pass='synthetic-long-password';
 assert.equal((await call('setup',{email:'admin@invalid.test',password:pass,name:'Admin',location:'Hong Kong S.A.R. / Sha Tin',setupKey:'welcome-test-only',starterMinutes:0})).status,200);
 const admin=(await call('auth/login',{email:'admin@invalid.test',password:pass})).data.sessionToken;
 assert.equal((await call('me',undefined,admin)).data.balance.total,0);
 assert.equal(database.prepare("SELECT value FROM settings WHERE id='onboarding_seconds'").get().value,'3600');
 assert.equal((await call('admin/settings',{starterMinutes:0,reason:'Test fixed policy'},admin)).status,400);
 const policies=(await call('policies')).data.policies;
 const info={email:'member@invalid.test',password:pass,name:'Member',accountType:'individual',birthDate:'1990-01-01',location:'Hong Kong S.A.R. / Sha Tin',countryCode:'+852',phoneNumber:'12345678',language:'en',signature:'Test Member',signatureDrawing:'[[[100,100],[200,50],[350,170]]]',...Object.fromEntries(policies.flatMap(p=>[[p.kind+'Agreed',true],[p.kind+'Version',p.version]]))};
 const signup=await call('auth/register',info);assert.equal(signup.status,200,JSON.stringify(signup.data));
 const token=signup.data.sessionToken,me=(await call('me',undefined,token)).data;
 assert.equal(me.balance.available,WELCOME_CREDIT_SECONDS);assert.equal(me.balance.reserved,0);assert.equal(me.verification.canParticipate,false);
 const ledger=(await call('ledger',undefined,token)).data.entries;assert.equal(ledger.length,1);assert.equal(ledger[0].type,'onboarding');assert.equal(ledger[0].amount,3600);
 assert.equal((await call('auth/register',info)).status,400);assert.equal(database.prepare("SELECT count(*) n FROM ledger WHERE destination_id=?").get(me.user.id).n,1);
 assert.equal((await call('tasks',{},token)).status,403,'Credit must not bypass verification');
 assert.equal((await call('verification/review',{userId:me.user.id,version:0,status:'under_review',reason:'Test review'},admin)).status,200);
 const reviewed=await call('verification/review',{userId:me.user.id,version:1,status:'verified',reason:'Synthetic identity checked',ageChecked:true,identityChecked:true,duplicateChecked:true,identityIssuer:'TEST',identityIdentifier:'welcome-member',evidenceReference:'Synthetic original checked'},admin);assert.equal(reviewed.status,200,JSON.stringify(reviewed.data));
 assert.equal((await call('me',undefined,token)).data.balance.total,3600,'Verification must not issue another grant');
 database.prepare("INSERT INTO ledger(id,source_id,amount,type,metadata) VALUES('spent',?,3600,'adjustment','Synthetic spent-credit fixture')").run(me.user.id);
 assert.equal((await call('auth/logout',{},token)).status,200);const login=await call('auth/login',{email:info.email,password:pass});assert.equal((await call('me',undefined,login.data.sessionToken)).data.balance.total,0);
 const recovery=await call('auth/recover',{email:info.email,password:pass,recoveryKey:signup.data.recoveryKey});assert.equal(recovery.status,200);assert.equal((await call('me',undefined,recovery.data.sessionToken)).data.balance.total,0);
 assert.equal(database.prepare("SELECT count(*) n FROM ledger WHERE destination_id=? AND type='onboarding'").get(me.user.id).n,1);
 const web=await call('auth/register',{...info,email:'web@invalid.test'},undefined,{'X-Timebank-Client':'',Origin:'https://example.invalid'});assert.equal(web.status,200);const cookie=web.headers.get('Set-Cookie').split(';')[0];assert.equal((await call('me',undefined,undefined,{'X-Timebank-Client':'',Cookie:cookie})).data.balance.available,3600);
 const guest=await call('auth/guest',{guestConsent:true,language:'en'});assert.equal(guest.status,200);const guestMe=(await call('me',undefined,guest.data.sessionToken)).data;assert.equal(guestMe.balance.total,3600);assert.equal(guestMe.verification.canParticipate,false);
 const recoveredGuest=await call('auth/guest-recover',{recoveryKey:guest.data.recoveryKey});assert.equal((await call('me',undefined,recoveredGuest.data.sessionToken)).data.balance.total,3600);assert.equal(database.prepare("SELECT count(*) n FROM ledger WHERE destination_id=?").get(guestMe.user.id).n,1);
 const beforeUsers=database.prepare('SELECT count(*) n FROM users').get().n,beforeLedger=database.prepare('SELECT count(*) n FROM ledger').get().n;
 failAfter=2;assert.equal((await call('auth/register',{...info,email:'rollback@invalid.test'})).status,500);assert.equal(database.prepare('SELECT count(*) n FROM users').get().n,beforeUsers);assert.equal(database.prepare('SELECT count(*) n FROM ledger').get().n,beforeLedger,'Failed signup must roll back its credit');
 database.exec("INSERT INTO users(id,email,name,password,recovery,account_type) VALUES('organization','organization@invalid.test','Organization','test','test','organization')");assert.equal(database.prepare("SELECT total FROM balances WHERE user_id='organization'").get().total,0);
 console.log('PASS: migration preserves history; fixed one-hour signup, native/web/guest accounts, rollback, duplicate protection, verification and recovery without top-ups.');
}finally{await modules.close();database.close();delete globalThis.__welcomeTestEnvironment;}
