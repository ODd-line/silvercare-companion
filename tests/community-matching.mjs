import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'vite';
import {rankTask} from '../lib/community-matching.ts';

const task={title:'Calligraphy workshop',description:'Share your calligraphy skills',category:'Teaching',category_id:'teaching',location:'Hong Kong',remote:false,requested_at:Date.parse('2026-10-12T01:00:00Z')/1000,estimated_seconds:2700};
const user={location:'Hong Kong',skills:'calligraphy',preferences:'Teaching'};
const preferences={mode:'in_person',days:'["Mon"]',timezone:'Asia/Hong_Kong',max_minutes:60};
const result=rankTask(task,user,preferences,new Set());
assert.equal(result.reasons.length,6);
assert.ok(result.reasons.includes('Matches your preferred duration'));
assert.ok(result.reasons.includes('Matches your preferred days'));
const durationOnly=rankTask(task,{}, {...preferences,mode:'any',days:'[]'},new Set());
assert.deepEqual(durationOnly,{score:1,reasons:['Matches your preferred duration']});
const daysOnly=rankTask(task,{}, {...preferences,mode:'any',max_minutes:30},new Set());
assert.deepEqual(daysOnly,{score:1,reasons:['Matches your preferred days']});
assert.deepEqual(rankTask(task,{}, {mode:'any',days:'[]'},new Set()),{score:0,reasons:[]});
assert.deepEqual(rankTask(task,{...user,heart_rate:180,feeling:'unwell'},preferences,new Set()),result);
assert.equal(rankTask({...task,remote:true},user,preferences,new Set()).reasons.includes('Same service area'),false);
assert.ok(rankTask(task,{skills:'ＣＡＬＬＩＧＲＡＰＨＹ'}, {mode:'any'},new Set()).reasons.includes('Matches your skills'));
assert.ok(rankTask(task,{}, {mode:'any'},new Set(['teaching'])).reasons.includes('Similar to tasks you helped with'));
console.log('PASS: independent matching criteria, duration/day boundaries, Unicode normalization, history, and no health-data influence.');

const database=new DatabaseSync(':memory:');
globalThis.__communityTestEnvironment={DB:{
 prepare(sql){return {bind(...values){return {
  async first(){return database.prepare(sql).get(...values)??null;},
  async all(){return {results:database.prepare(sql).all(...values)};},
  async run(){return {meta:{changes:Number(database.prepare(sql).run(...values).changes)}};},
 };}};},
 async batch(statements){database.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());database.exec('COMMIT');return results;}catch(error){database.exec('ROLLBACK');throw error;}},
}};
const server=await createServer({configFile:false,server:{middlewareMode:true},plugins:[{
 name:'community-test-environment',
 resolveId(id){if(id==='cloudflare:workers')return '\0community-test-environment';},
 load(id){if(id==='\0community-test-environment')return 'export const env=globalThis.__communityTestEnvironment;';},
}]});
try{
 for(const migration of fs.readdirSync(new URL('../drizzle/',import.meta.url)).filter(file=>file.endsWith('.sql')).sort())database.exec(fs.readFileSync(new URL('../drizzle/'+migration,import.meta.url),'utf8'));
 const {communityRoute}=await server.ssrLoadModule('/lib/community.ts');
 const member={id:'talent-member',account_type:'individual'},other={id:'talent-other',account_type:'individual'};
 for(const account of [member,other])database.prepare('INSERT INTO users(id,email,name,password,recovery,location) VALUES(?,?,?,?,?,?)').run(account.id,account.id+'@example.invalid','Unchanged name','test-only','test-only','Unchanged location');
 database.prepare('INSERT INTO categories(id,name) VALUES(?,?)').run('teaching','Teaching');
 const body={ownerId:member.id,skills:'Calligraphy',categories:['Teaching'],mode:'in_person',days:['Mon','Thu'],timezone:'Asia/Hong_Kong',maxMinutes:45};
 const saved=await communityRoute('talent-profile',undefined,member,body,true);
 assert.equal(saved.skills,'Calligraphy');
 assert.deepEqual(saved.categories,['Teaching']);
 assert.equal(saved.matching.max_minutes,45);
 assert.deepEqual(JSON.parse(saved.matching.days),['Mon','Thu']);
 const unrelated=database.prepare('SELECT name,location FROM users WHERE id=?').get(member.id);
 assert.equal(unrelated.name,'Unchanged name');assert.equal(unrelated.location,'Unchanged location');
 assert.equal((await communityRoute('talent-profile',undefined,other,{},false)).skills,'');
 await assert.rejects(communityRoute('talent-profile',undefined,other,body,true),/account changed/);
 await assert.rejects(communityRoute('talent-profile',undefined,{...member,account_type:'organization'},{},false),/individual members/);
 for(const invalid of [{categories:['Unknown']},{maxMinutes:10081},{timezone:'Unknown/Zone'},{days:['Someday']},{skills:''},{mode:'invalid'}])await assert.rejects(communityRoute('talent-profile',undefined,member,{...body,...invalid},true));
 assert.equal((await communityRoute('talent-profile',undefined,member,{},false)).matching.max_minutes,45);
 await communityRoute('matching-preferences',undefined,member,{mode:'remote',days:[],timezone:'UTC',maxMinutes:30},true);
 assert.equal((await communityRoute('talent-profile',undefined,member,{},false)).matching.max_minutes,30);
 assert.equal(database.prepare('SELECT COUNT(*) AS count FROM ledger').get().count,0);
 console.log('PASS: talent profile persistence, validation, account isolation, existing preference compatibility, unchanged account fields and ledger.');
}finally{await server.close();database.close();delete globalThis.__communityTestEnvironment;}