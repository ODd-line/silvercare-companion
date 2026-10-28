// Server-only delivery logic. Dependencies are passed in so tests never send email.
export type EmailEnv = {
 DB: D1Database; RESEND_API_KEY?: string; CARE_EMAIL_ENABLED?: string;
 CARE_EMAIL_FROM?: string; CARE_EMAIL_APP_URL?: string; RESEND_WEBHOOK_SECRET?: string;
};
export const sectionNames = {checkins:'Check-in days',heart:'Heart-rate readings',notes:'Health-note count'};
export type Section = keyof typeof sectionNames;
export type DailyChart = {id:Section; title:string; unit:string; maximum:number; days:{date:string; label:string; value:number|null; samples:number}[]};
const DAY=86400, OFFSET=8*3600;
export const nowSeconds=()=>Math.floor(Date.now()/1000);
export const token=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),n=>n.toString(16).padStart(2,'0')).join('');
export async function digest(value:string){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),n=>n.toString(16).padStart(2,'0')).join('');}
export function emailError(message:string,status=400):never {throw Object.assign(new Error(message),{status});}
export function appUrl(env:EmailEnv){try{const url=new URL(env.CARE_EMAIL_APP_URL||'');if(url.protocol==='https:'&&!url.username&&!url.password)return url.origin;}catch{}return null;}
export function emailReady(env:EmailEnv){return env.CARE_EMAIL_ENABLED==='true'&&!!env.RESEND_API_KEY&&!!appUrl(env)&&!!env.CARE_EMAIL_FROM&&!!env.RESEND_WEBHOOK_SECRET;}
export function reportingWeek(now:number){
 const local=new Date((now+OFFSET)*1000);
 const monday=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate()-(local.getUTCDay()+6)%7)/1000-OFFSET;
 return {start:monday-7*DAY,end:monday,due:monday+9*3600};
}
export function nextDelivery(now:number){const w=reportingWeek(now);return now<w.due?w.due:w.due+7*DAY;}
const escape=(value:unknown)=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const stmt=(db:D1Database,sql:string,...args:unknown[])=>db.prepare(sql).bind(...args);
export async function report(db:D1Database,userId:string,now:number,sections:Section[]){
 const week=reportingWeek(now);
 const counts=await stmt(db,`SELECT COUNT(DISTINCT CASE WHEN kind='checkin' THEN date(occurred_at,'unixepoch','+8 hours') END) AS checkins,
 SUM(CASE WHEN kind='symptom' THEN 1 ELSE 0 END) AS notes FROM care_records WHERE user_id=? AND occurred_at>=? AND occurred_at<?`,userId,week.start,week.end).first<{checkins:number;notes:number|null}>();
 const heart=await stmt(db,`SELECT COUNT(*) AS count, AVG(value) AS average, MIN(value) AS minimum, MAX(value) AS maximum
 FROM care_measurements WHERE user_id=? AND kind='heart_rate' AND unit='bpm' AND value>0 AND value<=400 AND measured_at>=? AND measured_at<?`,userId,week.start,week.end).first<{count:number;average:number|null;minimum:number|null;maximum:number|null}>();
 const date=(n:number)=>new Date((n+OFFSET)*1000).toLocaleDateString('en-GB',{timeZone:'UTC',day:'numeric',month:'short',year:'numeric'});
 const metrics:{label:string;value:string}[]=[];
 if(sections.includes('checkins'))metrics.push({label:'Check-in days',value:`${counts?.checkins||0} of 7 days`});
 if(sections.includes('notes'))metrics.push({label:'Health notes saved',value:String(counts?.notes||0)});
 if(sections.includes('heart')){
  metrics.push({label:'Average heart rate',value:heart?.count?`${Math.round(heart.average!)} bpm`:'No readings saved'});
  metrics.push({label:'Saved heart-rate readings',value:String(heart?.count||0)});
  if(heart?.count)metrics.push({label:'Recorded heart-rate range',value:`${heart.minimum}–${heart.maximum} bpm`});
 }
 const records=await stmt(db,`SELECT date(occurred_at,'unixepoch','+8 hours') AS day,
 SUM(CASE WHEN kind='checkin' THEN 1 ELSE 0 END) AS checkins, SUM(CASE WHEN kind='symptom' THEN 1 ELSE 0 END) AS notes
 FROM care_records WHERE user_id=? AND occurred_at>=? AND occurred_at<? GROUP BY day`,userId,week.start,week.end).all<{day:string;checkins:number;notes:number}>();
 const readings=sections.includes('heart')?await stmt(db,`SELECT date(measured_at,'unixepoch','+8 hours') AS day,AVG(value) AS average,COUNT(*) AS count
 FROM care_measurements WHERE user_id=? AND kind='heart_rate' AND unit='bpm' AND value>0 AND value<=400 AND measured_at>=? AND measured_at<? GROUP BY day`,userId,week.start,week.end).all<{day:string;average:number;count:number}>():{results:[]};
 const charts:DailyChart[]=sections.map(id=>{
  const days=Array.from({length:7},(_,i)=>{
   const d=new Date((week.start+i*DAY+OFFSET)*1000),key=d.toISOString().slice(0,10),r=records.results.find(r=>r.day===key),h=readings.results.find(h=>h.day===key);
   return {date:key,label:d.toLocaleDateString('en-GB',{timeZone:'UTC',weekday:'short'}),value:id==='heart'?(h?Math.round(h.average):null):id==='checkins'?(r?.checkins?1:0):(r?.notes||0),samples:id==='heart'?(h?.count||0):id==='checkins'?(r?.checkins||0):(r?.notes||0)};
  });
  return {id,title:id==='heart'?'Daily heart-rate average':id==='checkins'?'Your daily check-ins':'Health notes by day',unit:id==='heart'?'bpm':id==='checkins'?'check-in':'notes',maximum:id==='heart'?Math.max(100,Math.ceil(Math.max(...days.map(d=>d.value||0))/20)*20):id==='checkins'?1:Math.max(1,...days.map(d=>d.value||0)),days};
 });
 return {...week,label:`${date(week.start)} – ${date(week.end-1)}`,metrics,charts};
}
export function chartValue(chart:DailyChart,day:DailyChart['days'][number]){
 return day.value===null?'No reading':chart.id==='checkins'?(day.value?'Saved':'Not saved'):`${day.value} ${chart.unit}`;
}
function renderChart(chart:DailyChart){
 return `<h2 style="font-size:20px;margin:28px 0 8px">${escape(chart.title)}</h2><p style="font-size:13px;color:#617367">${chart.id==='heart'?`Daily averages of saved readings. Scale: 0–${chart.maximum} bpm. Missing days have no bar.`:chart.id==='checkins'?'One marker per day with a saved check-in.':`Saved note counts. Scale: 0–${chart.maximum}.`}</p><table width="100%" cellpadding="0" cellspacing="0" aria-label="${escape(chart.title)}">${chart.days.map(d=>`<tr><th align="left" scope="row" style="font-size:13px;padding:7px 8px 7px 0;width:45px">${escape(d.label)}</th><td style="width:60%;padding:7px 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#edf1e8"><tr>${d.value?`<td width="${Math.round(d.value/chart.maximum*100)}%" height="18" bgcolor="#63816b" style="height:18px;background:#63816b;font-size:1px;line-height:18px">&nbsp;</td>`:''}${d.value!==chart.maximum?'<td height="18" style="height:18px;font-size:1px;line-height:18px">&nbsp;</td>':''}</tr></table></td><td align="right" style="font-size:13px;padding-left:8px;white-space:nowrap">${escape(chartValue(chart,d))}</td></tr>`).join('')}</table>`;
}
export function renderReport(name:string,summary:Awaited<ReturnType<typeof report>>,base:string,unsubscribeToken:string){
 const stop=`${base}/api/care-email-unsubscribe?token=${encodeURIComponent(unsubscribeToken)}`;
 const health=`${base}/#care/health`;
 const note='This summary counts saved records only. Watch readings are separate observations, not continuous monitoring or a medical assessment. Health-note text is never included.';
 const chartHtml=summary.charts.map(renderChart).join('');
 const chartText=summary.charts.map(c=>`${c.title}\n${c.days.map(d=>`${d.date} (${d.label}): ${chartValue(c,d)}${c.id==='heart'?` (${d.samples} saved readings)`:''}`).join('\n')}`).join('\n\n');
 const html=`<!doctype html><html lang="en"><body style="margin:0;background:#f6f7f2;color:#315447;font-family:Arial,sans-serif"><table role="presentation" width="100%"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="100%" style="max-width:600px;background:#fff;border-radius:20px"><tr><td style="padding:32px;background:#e9efe4"><p style="font-size:24px;font-weight:bold">SilverCare</p><p>YOUR WEEK IN WELLBEING</p><h1>Small check-ins.<br>A clearer picture.</h1><p>${escape(summary.label)} · Hong Kong time</p><p>Hi ${escape(name)}, here is your private weekly summary.</p></td></tr><tr><td style="padding:32px">${chartHtml}<h2 style="font-size:20px;margin-top:28px">Weekly totals</h2><table width="100%">${summary.metrics.map(m=>`<tr><th align="left" style="padding:14px 0;border-bottom:1px solid #e9efe4">${escape(m.label)}</th><td align="right" style="padding:14px 0;border-bottom:1px solid #e9efe4">${escape(m.value)}</td></tr>`).join('')}</table><p style="line-height:1.6">${note}</p><p><a href="${escape(health)}" style="display:inline-block;background:#315447;color:white;padding:16px 24px;border-radius:8px">Open My Health →</a></p></td></tr><tr><td style="padding:24px 32px;background:#f0f3ec;font-size:13px;line-height:1.6">You enabled weekly SilverCare emails. <a href="${escape(stop)}">Stop weekly emails</a> or manage your selected sections in SilverCare Settings.</td></tr></table></td></tr></table></body></html>`;
 return {subject:'Your SilverCare weekly health summary',html,text:`SilverCare\n${summary.label} (Hong Kong time)\nHi ${name},\n\n${summary.metrics.map(m=>`${m.label}: ${m.value}`).join('\n')}\n\n${chartText}\n\n${note}\n\nMy Health: ${health}\nStop weekly emails: ${stop}`,headers:{'List-Unsubscribe':`<${stop}>`,'List-Unsubscribe-Post':'List-Unsubscribe=One-Click'}};
}
export async function sendEmail(env:EmailEnv,payload:object,key:string,transport:typeof fetch=fetch){
 const response=await transport('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':key},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});
 if(!response.ok)throw new Error('Email provider unavailable');
 const result=await response.json() as {id?:string};if(!result.id)throw new Error('Email provider response invalid');return result.id;
}
export async function emailSettings(env:EmailEnv,user:{id:string;email:string;is_guest?:number},now=nowSeconds()){
 const p=await stmt(env.DB,'SELECT * FROM care_email_preferences WHERE user_id=?',user.id).first<any>();
 const verified=!!p?.verified_at&&p.email===user.email;
 const last=await stmt(env.DB,'SELECT status,sent_at FROM care_email_deliveries WHERE user_id=? ORDER BY created_at DESC LIMIT 1',user.id).first<any>();
 return {ready:emailReady(env),email:user.email,guest:!!user.is_guest,verified,enabled:!!p?.enabled&&verified,sections:p?JSON.parse(p.sections):Object.keys(sectionNames),nextDelivery:nextDelivery(now),lastDelivery:last,schedule:'Mondays at 09:00, Asia/Hong_Kong'};
}
export async function emailAction(env:EmailEnv,user:{id:string;email:string;is_guest?:number},action:string,b:any,post:boolean,now=nowSeconds(),transport:typeof fetch=fetch){
 const db=env.DB;
 if(action==='email-settings'&&!post)return emailSettings(env,user,now);
 if(action==='email-preview'&&!post){const p=await emailSettings(env,user,now);return report(db,user.id,now,p.sections);}
 if(!post)emailError('Not found.',404);
 if(user.is_guest)emailError('Use a registered account with an email address for weekly summaries.',403);
 if(action==='email-settings'){
  if(typeof b.enabled!=='boolean'||!Array.isArray(b.sections)||b.sections.length<1||b.sections.length>3||b.sections.some((s:string)=>!Object.hasOwn(sectionNames,s)))emailError('Choose at least one report section.');
  const p=await stmt(db,'SELECT * FROM care_email_preferences WHERE user_id=?',user.id).first<any>();
  if(b.enabled&&(!p?.verified_at||p.email!==user.email))emailError('Verify your account email first.');
  if(b.enabled&&b.consent!==true)emailError('Confirm that you want these health statistics sent by email.');
  if(b.enabled&&!emailReady(env))emailError('Email delivery is still being configured. Your report preview is available.',503);
  await stmt(db,`INSERT INTO care_email_preferences(user_id,email,enabled,sections,unsubscribe_token,updated_at) VALUES(?,?,?,?,?,?)
   ON CONFLICT(user_id) DO UPDATE SET enabled=excluded.enabled,sections=excluded.sections,revision=revision+1,updated_at=excluded.updated_at`,user.id,user.email,b.enabled?1:0,JSON.stringify([...new Set(b.sections)]),token(),now).run();
  return emailSettings(env,user,now);
 }
 if(action==='email-request-code'){
  if(!emailReady(env))emailError('Email delivery is still being configured. Please try again after setup is complete.',503);
  const code=String(crypto.getRandomValues(new Uint32Array(1))[0]%1000000).padStart(6,'0');
  const result=await stmt(db,`INSERT INTO care_email_challenges(user_id,email,code_hash,expires,requested_at) VALUES(?,?,?,?,?)
   ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,code_hash=excluded.code_hash,expires=excluded.expires,attempts=0,requested_at=excluded.requested_at
   WHERE care_email_challenges.requested_at<=?`,user.id,user.email,await digest(user.id+':'+code),now+600,now,now-900).run();
  if(!result.meta.changes)emailError('Please wait 15 minutes before requesting another code.',429);
  try{await sendEmail(env,{from:env.CARE_EMAIL_FROM,to:[user.email],subject:'Verify your SilverCare email',text:`Your SilverCare verification code is ${code}. It expires in 10 minutes. Enter it in SilverCare Settings. This does not enable weekly reports.`,html:`<p>Your SilverCare verification code is <strong>${code}</strong>.</p><p>It expires in 10 minutes. Enter it in SilverCare Settings. This does not enable weekly reports.</p>`},`care-verify-${user.id}-${now}`,transport);}catch{emailError('The verification email could not be sent. Please try again in 15 minutes.',503);}
  return {ok:true};
 }
 if(action==='email-verify'){
  if(!/^\d{6}$/.test(b.code||''))emailError('Enter the six-digit code.');
  const c=await stmt(db,`UPDATE care_email_challenges SET attempts=attempts+1 WHERE user_id=? AND email=? AND expires>? AND attempts<5 RETURNING *`,user.id,user.email,now).first<any>();
  if(!c||c.code_hash!==await digest(user.id+':'+b.code))emailError('The code is incorrect or expired. You can try up to five times.');
  // Consume the challenge and verify in one transaction; verification never opts in.
  await db.batch([stmt(db,`INSERT INTO care_email_preferences(user_id,email,verified_at,unsubscribe_token,updated_at)
   SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM care_email_challenges WHERE user_id=? AND code_hash=? AND expires>?)
   ON CONFLICT(user_id) DO UPDATE SET email=excluded.email,verified_at=excluded.verified_at,enabled=0,revision=revision+1,updated_at=excluded.updated_at`,user.id,user.email,now,token(),now,user.id,c.code_hash,now),stmt(db,'DELETE FROM care_email_challenges WHERE user_id=? AND code_hash=?',user.id,c.code_hash)]);
  return emailSettings(env,user,now);
 }
 emailError('Not found.',404);
}
export async function unsubscribe(env:EmailEnv,value:string){
 if(!/^[a-f0-9]{64}$/.test(value))emailError('This unsubscribe link is invalid.',400);
 await stmt(env.DB,'UPDATE care_email_preferences SET enabled=0,revision=revision+1,updated_at=? WHERE unsubscribe_token=?',nowSeconds(),value).run();
}
export async function deliverWeekly(env:EmailEnv,now=nowSeconds(),transport:typeof fetch=fetch){
 if(!emailReady(env))return {sent:0,ready:false};
 const db=env.DB,week=reportingWeek(now);let sent=0;
 // Retry for less than Resend's 24-hour idempotency window; discard old payloads.
 await stmt(db,"UPDATE care_email_deliveries SET status='expired',payload='{}' WHERE status IN ('pending','sending') AND created_at<=?",now-23*3600).run();
 await stmt(db,"UPDATE care_email_deliveries SET payload='{}' WHERE created_at<?",now-7*DAY).run();
 if(now>=week.due&&now<week.due+23*3600){
  const users=await stmt(db,`SELECT p.*,u.name FROM care_email_preferences p JOIN users u ON u.id=p.user_id JOIN care_preferences c ON c.user_id=u.id
   WHERE p.enabled=1 AND p.verified_at IS NOT NULL AND p.email=u.email AND u.suspended=0 AND u.is_guest=0 AND u.account_type='individual'
   AND p.updated_at<=? AND NOT EXISTS(SELECT 1 FROM care_email_deliveries d WHERE d.user_id=p.user_id AND d.week_start=?) LIMIT 25`,week.due,week.start).all<any>();
  for(const p of users.results){
   const summary=await report(db,p.user_id,now,JSON.parse(p.sections));
   const payload={from:env.CARE_EMAIL_FROM,to:[p.email],...renderReport(p.name,summary,appUrl(env)!,p.unsubscribe_token)};
   await stmt(db,`INSERT INTO care_email_deliveries(id,user_id,week_start,revision,payload,created_at)
    SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM care_email_preferences WHERE user_id=? AND enabled=1 AND revision=?)
    ON CONFLICT(user_id,week_start) DO NOTHING`,crypto.randomUUID(),p.user_id,week.start,p.revision,JSON.stringify(payload),now,p.user_id,p.revision).run();
  }
 }
 const pending=await stmt(db,"SELECT id FROM care_email_deliveries WHERE status IN ('pending','sending') AND lease_until<=? AND created_at>? ORDER BY created_at LIMIT 25",now,now-23*3600).all<{id:string}>();
 for(const item of pending.results){
  const d=await stmt(db,`UPDATE care_email_deliveries SET status='sending',lease_until=?,attempts=attempts+1 WHERE id=? AND status IN ('pending','sending') AND lease_until<=? RETURNING *`,now+300,item.id,now).first<any>();
  if(!d)continue;
  const allowed=await stmt(db,`SELECT p.user_id FROM care_email_preferences p JOIN users u ON u.id=p.user_id JOIN care_preferences c ON c.user_id=u.id
   WHERE p.user_id=? AND p.revision=? AND p.enabled=1 AND p.verified_at IS NOT NULL AND p.email=u.email AND u.suspended=0 AND u.is_guest=0 AND u.account_type='individual'`,d.user_id,d.revision).first();
  if(!allowed){await stmt(db,"UPDATE care_email_deliveries SET status='cancelled',payload='{}' WHERE id=?",d.id).run();continue;}
  try{
   const id=await sendEmail(env,JSON.parse(d.payload),`care-weekly-${d.id}`,transport);
   await stmt(db,"UPDATE care_email_deliveries SET status='sent',provider_id=?,sent_at=?,payload='{}' WHERE id=?",id,now,d.id).run();sent++;
  }catch{await stmt(db,"UPDATE care_email_deliveries SET status='pending' WHERE id=?",d.id).run();}
 }
 return {sent,ready:true};
}
