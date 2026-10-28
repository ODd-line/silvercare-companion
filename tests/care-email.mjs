import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import {reportingWeek,nextDelivery,report,renderReport,emailAction,deliverWeekly,digest,unsubscribe} from '../lib/care-email-core.ts';
import {verifyEmailWebhook} from '../lib/care-email-webhook.ts';

// In-memory SQLite with the D1 interface; transport is always mocked.
function fixture(){
 const sql=new DatabaseSync(':memory:');
 sql.exec(`CREATE TABLE users(id TEXT PRIMARY KEY,email TEXT,name TEXT,suspended INTEGER DEFAULT 0,is_guest INTEGER DEFAULT 0,account_type TEXT DEFAULT 'individual');
 CREATE TABLE care_preferences(user_id TEXT PRIMARY KEY);
 CREATE TABLE care_records(id TEXT,user_id TEXT,kind TEXT,occurred_at INTEGER);
 CREATE TABLE care_measurements(user_id TEXT,kind TEXT,value REAL,unit TEXT,measured_at INTEGER);
 INSERT INTO users(id,email,name) VALUES('alice','alice@example.test','Alice <script>'),('bob','bob@example.test','Bob');
 INSERT INTO care_preferences VALUES('alice'),('bob');`);
 sql.exec(readFileSync(new URL('../drizzle/0018_care_weekly_email.sql',import.meta.url),'utf8'));
 const db={prepare(query){let args=[];const s={bind(...values){args=values;return s;},async first(){return sql.prepare(query).get(...args)||null;},async all(){return {results:sql.prepare(query).all(...args)};},async run(){const r=sql.prepare(query).run(...args);return {meta:{changes:Number(r.changes)}};}};return s;},async batch(items){sql.exec('BEGIN');try{const values=[];for(const i of items)values.push(await i.run());sql.exec('COMMIT');return values;}catch(e){sql.exec('ROLLBACK');throw e;}}};
 const env={DB:db,CARE_EMAIL_ENABLED:'true',RESEND_API_KEY:'test-not-a-real-key',RESEND_WEBHOOK_SECRET:'test',CARE_EMAIL_FROM:'SilverCare <updates@silvercare.care>',CARE_EMAIL_APP_URL:'https://app.example.test'};
 return {sql,db,env,user:{id:'alice',email:'alice@example.test',is_guest:0}};
}
const monday=Date.parse('2026-10-26T01:00:00Z')/1000;
test('daily graphs honor Hong Kong midnight, ownership, units and missing days',async()=>{
 const {sql,db}=fixture(),w=reportingWeek(monday);
 for(const [u,v,unit,t] of [['alice',70,'bpm',w.start],['alice',90,'bpm',w.start+86399],['alice',60,'bpm',w.start+86400],['bob',200,'bpm',w.start],['alice',0,'bpm',w.start],['alice',401,'bpm',w.start],['alice',100,'steps',w.start],['alice',100,'bpm',w.end]])sql.prepare("INSERT INTO care_measurements VALUES(?,'heart_rate',?,?,?)").run(u,v,unit,t);
 const r=await report(db,'alice',monday,['heart']);
 assert.equal(r.charts.length,1);assert.equal(r.charts[0].id,'heart');
 assert.deepEqual(r.charts[0].days.map(d=>d.value),[80,60,null,null,null,null,null]);
 assert.deepEqual(r.charts[0].days.map(d=>d.samples),[2,1,0,0,0,0,0]);
 assert.equal(r.charts[0].days[0].date,'2026-10-19');
 const mail=renderReport('Alice',r,'https://app.example.test','a'.repeat(64));
 assert.match(mail.html,/Daily heart-rate average/);assert.match(mail.html,/width="80%"/);assert.match(mail.html,/No reading/);
 assert.match(mail.text,/2026-10-19 \(Mon\): 80 bpm \(2 saved readings\)/);
 assert(!/<svg|<canvas|<script|<img/i.test(mail.html));assert(!mail.html.includes('Health notes by day'));
 assert.equal((await report(db,'alice',monday,['notes'])).charts[0].days[0].value,0);
});
function enable(sql,now=monday){sql.prepare("INSERT INTO care_email_preferences(user_id,email,enabled,verified_at,unsubscribe_token,updated_at) VALUES('alice','alice@example.test',1,?,?,?)").run(now,'a'.repeat(64),now);}
test('overlapping scheduled invocations claim each report only once',async()=>{
 const {sql,env}=fixture();enable(sql);let calls=0;
 const transport=async()=>{calls++;await new Promise(r=>setTimeout(r,15));return Response.json({id:'concurrent-report'});};
 await Promise.all([deliverWeekly(env,monday,transport),deliverWeekly(env,monday,transport)]);
 assert.equal(calls,1);assert.equal(sql.prepare('SELECT COUNT(*) AS n FROM care_email_deliveries').get().n,1);
});
test('enabling after Monday cutoff starts the following week',async()=>{
 const {sql,env}=fixture();enable(sql,monday+1);let calls=0;
 const transport=async()=>{calls++;return Response.json({id:'next-week'});};
 await deliverWeekly(env,monday+3600,transport);assert.equal(calls,0);
 await deliverWeekly(env,monday+7*86400,transport);assert.equal(calls,1);
});
test('webhook rejects tampering, wrong secrets, missing headers and stale timestamps',async()=>{
 const secret=btoa('synthetic-webhook-key-for-tests'),raw=JSON.stringify({type:'email.bounced',data:{email_id:'report-1'}});
 const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(atob(secret)),{name:'HMAC',hash:'SHA-256'},false,['sign']);
 const signature=btoa(String.fromCharCode(...new Uint8Array(await crypto.subtle.sign('HMAC',key,new TextEncoder().encode(`event-1.${monday}.${raw}`)))));
 const headers=new Headers({'svix-id':'event-1','svix-timestamp':String(monday),'svix-signature':`v1,invalid v1,${signature}`});
 assert(await verifyEmailWebhook('whsec_'+secret,headers,raw,monday));
 assert(!await verifyEmailWebhook('whsec_'+secret,headers,raw+' ',monday));
 assert(!await verifyEmailWebhook(btoa('wrong'),headers,raw,monday));
 assert(!await verifyEmailWebhook(secret,new Headers(),raw,monday));
 assert(!await verifyEmailWebhook(secret,headers,raw,monday+301));
});
test('week boundaries and first scheduled delivery use Hong Kong time',()=>{
 const w=reportingWeek(monday);assert.equal(w.start,Date.parse('2026-10-18T16:00:00Z')/1000);assert.equal(w.end,Date.parse('2026-10-25T16:00:00Z')/1000);
 assert.equal(w.due,monday);assert.equal(nextDelivery(monday-1),monday);assert.equal(nextDelivery(monday),monday+7*86400);
});
test('owner-scoped aggregates deduplicate check-in days, exclude zero heart rate and honor boundaries',async()=>{
 const {sql,db}=fixture(),w=reportingWeek(monday);
 for(const [id,u,k,t] of [['1','alice','checkin',w.start],['2','alice','checkin',w.start+1],['3','alice','checkin',w.start+86400],['4','alice','symptom',w.start],['5','bob','symptom',w.start],['6','alice','symptom',w.end]])sql.prepare('INSERT INTO care_records VALUES(?,?,?,?)').run(id,u,k,t);
 for(const [u,v,t] of [['alice',70,w.start],['alice',80,w.start],['alice',0,w.start],['bob',200,w.start],['alice',100,w.end]])sql.prepare("INSERT INTO care_measurements VALUES(?,'heart_rate',?,'bpm',?)").run(u,v,t);
 const r=await report(db,'alice',monday,['checkins','notes','heart']);assert.deepEqual(r.metrics.map(m=>m.value),['2 of 7 days','1','75 bpm','2','70–80 bpm']);
 assert.equal((await report(db,'alice',monday,['notes'])).metrics.length,1);
});
test('no readings stay missing; HTML escapes member names and has unsubscribe headers',async()=>{
 const {db}=fixture(),r=await report(db,'alice',monday,['heart']);assert.equal(r.metrics[0].value,'No readings saved');
 const email=renderReport('<script>alert(1)</script>',r,'https://app.example.test','a'.repeat(64));assert(!email.html.includes('<script>'));assert(email.html.includes('&lt;script&gt;'));assert(email.headers['List-Unsubscribe-Post']);assert(email.text.includes('No readings saved'));
});
test('disabled service sends nothing and rejects enabling unverified email',async()=>{
 const {env,user}=fixture();let calls=0;assert.equal((await deliverWeekly({...env,CARE_EMAIL_ENABLED:'false'},monday,async()=>{calls++;})).ready,false);assert.equal(calls,0);
 await assert.rejects(emailAction(env,user,'email-settings',{enabled:true,consent:true,sections:['heart']},true,monday),/Verify/);
});
test('verification code, attempt limit, cooldown, and verification without automatic opt-in',async()=>{
 const {sql,env,user}=fixture();let payload;
 const transport=async(_url,req)=>{payload=JSON.parse(req.body);return Response.json({id:'verification'});};
 await emailAction(env,user,'email-request-code',{},true,monday,transport);
 const code=payload.text.match(/code is (\d{6})/)[1];assert.equal(payload.to[0],user.email);assert(!payload.text.includes('bpm'));
 await assert.rejects(emailAction(env,user,'email-request-code',{},true,monday+10,transport),/15 minutes/);
 for(let i=0;i<5;i++)await assert.rejects(emailAction(env,user,'email-verify',{code:code==='000000'?'000001':'000000'},true,monday+20),/incorrect/);
 await assert.rejects(emailAction(env,user,'email-verify',{code},true,monday+20),/incorrect/);
 sql.prepare('UPDATE care_email_challenges SET attempts=0').run();
 const s=await emailAction(env,user,'email-verify',{code},true,monday+30);assert(s.verified);assert(!s.enabled);
 assert.equal(sql.prepare('SELECT count(*) AS n FROM care_email_challenges').get().n,0);
 await assert.rejects(emailAction(env,user,'email-verify',{code},true,monday+40),/incorrect/);
});
test('changed recipient, guest status and consent are enforced',async()=>{
 const {sql,env,user}=fixture();enable(sql);
 await assert.rejects(emailAction(env,{...user,email:'other@example.test'},'email-settings',{enabled:true,consent:true,sections:['heart']},true,monday),/Verify/);
 await assert.rejects(emailAction(env,{...user,is_guest:1},'email-request-code',{},true,monday),/registered/);
 await assert.rejects(emailAction(env,user,'email-settings',{enabled:true,sections:['heart']},true,monday),/Confirm/);
});
test('scheduled report sends once with immutable retry payload and stable idempotency key',async()=>{
 const {sql,env}=fixture();enable(sql);const requests=[];
 const transport=async(_url,r)=>{requests.push(r);if(requests.length===1)throw Error('ambiguous timeout');return Response.json({id:'report-1'});};
 await deliverWeekly(env,monday-1,transport);assert.equal(requests.length,0);
 await deliverWeekly(env,monday,transport);await deliverWeekly(env,monday+1,transport);assert.equal(requests.length,1);
 await deliverWeekly(env,monday+3600,transport);await deliverWeekly(env,monday+7200,transport);
 assert.equal(requests.length,2);assert.equal(requests[0].body,requests[1].body);assert.equal(requests[0].headers['Idempotency-Key'],requests[1].headers['Idempotency-Key']);
 assert.equal(sql.prepare('SELECT payload FROM care_email_deliveries').get().payload,'{}');
});
test('opt-out cancels retries, changing sections cancels stale payloads, and retries expire before 24 hours',async()=>{
 for(const mode of ['unsubscribe','revision','expired','suspended']){
  const {sql,env}=fixture();enable(sql);let calls=0;const transport=async()=>{calls++;throw Error('offline');};
  await deliverWeekly(env,monday,transport);
  if(mode==='unsubscribe')await unsubscribe(env,'a'.repeat(64));
  if(mode==='revision')sql.exec('UPDATE care_email_preferences SET revision=revision+1');
  if(mode==='suspended')sql.exec('UPDATE users SET suspended=1');
  await deliverWeekly(env,monday+(mode==='expired'?24:1)*3600,transport);assert.equal(calls,1,mode);
 }
});
