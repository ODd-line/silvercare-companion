import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {createServer} from 'vite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const database=new DatabaseSync(':memory:');
let beforeBatch;
const environment={DB:{
  prepare(sql){return {bind(...values){return {
    async first(){return database.prepare(sql).get(...values)??null;},
    async all(){return {results:database.prepare(sql).all(...values)};},
    async run(){const result=database.prepare(sql).run(...values);return {meta:{changes:Number(result.changes)}};},
  };}};},
  async batch(statements){
    if(beforeBatch){const action=beforeBatch;beforeBatch=undefined;await action();}
    database.exec('BEGIN');
    try{const results=[];for(const statement of statements)results.push(await statement.run());database.exec('COMMIT');return results;}
    catch(error){database.exec('ROLLBACK');throw error;}
  },
}};
globalThis.__watchCareEnvironment=environment;
const server=await createServer({configFile:false,root,server:{middlewareMode:true},plugins:[{
  name:'watch-care-test-environment',
  resolveId(id){if(id==='cloudflare:workers')return '\0watch-care-environment';},
  load(id){if(id==='\0watch-care-environment')return 'export const env=globalThis.__watchCareEnvironment;';},
}]});
try{
  const migrations=fs.readdirSync(path.join(root,'drizzle')).filter(file=>file.endsWith('.sql')).sort();
  for(const file of migrations)database.exec(fs.readFileSync(path.join(root,'drizzle',file),'utf8'));
  const {careRoute,ingestCare}=await server.ssrLoadModule('/lib/care.ts');
  const member={id:'watch-test-member',account_type:'individual'},other={id:'other-test-member',account_type:'individual'};
  for(const account of [member,other])database.prepare('INSERT INTO users(id,email,name,password,recovery) VALUES(?,?,?,?,?)').run(account.id,account.id+'@example.invalid','Test member','test-only','test-only');
  await assert.rejects(careRoute(member,'connect',{name:'PineTime',permissions:['steps']},true),/privacy setup/);
  await careRoute(member,'setup',{consent:true},true);await careRoute(other,'setup',{consent:true},true);
  const adapter=await careRoute(member,'connect',{name:'PineTime test adapter',permissions:['steps','heart_rate']},true);
  const request=()=>new Request('https://example.invalid/api/care-device',{method:'POST',headers:{Authorization:'CareDevice '+adapter.token}});
  await assert.rejects(careRoute(other,'connect',{ownerId:member.id,name:'Wrong account',permissions:['steps']},true),/account changed/);
  const observation={id:'stable-test-observation',kind:'steps',value:4200,unit:'steps',measuredAt:new Date().toISOString(),timestampSource:'phone_received'};
  assert.deepEqual(await ingestCare(request(),{measurements:[observation]}),{ok:true,received:1});
  assert.deepEqual(await ingestCare(request(),{measurements:[observation]}),{ok:true,received:0});
  await assert.rejects(ingestCare(request(),{ownerId:other.id,measurements:[observation]}),/another account/);
  const stored=await careRoute(member,undefined,{},false),privateRecords=await careRoute(other,undefined,{},false);
  assert.equal(stored.measurements.length,1);assert.equal(stored.measurements[0].timestamp_source,'phone_received');
  assert.equal(stored.measurements[0].measured_at,Math.floor(Date.parse(observation.measuredAt)/1000));
  assert.equal(privateRecords.measurements.length,0);
  const local={...observation,id:'sb-local:00000000-0000-0000-0000-000000000001',measuredAt:'2000-01-01T00:00:00.000Z'};
  assert.deepEqual(await ingestCare(request(),{measurements:[local]}),{ok:true,received:1});
  const reopened=await careRoute(member,'connect',{name:'Reopened phone session',permissions:['steps']},true);
  assert.deepEqual(await ingestCare(new Request('https://example.invalid',{headers:{Authorization:'CareDevice '+reopened.token}}),{measurements:[local]}),{ok:true,received:0});
  const otherAdapter=await careRoute(other,'connect',{name:'Other account',permissions:['steps']},true);
  assert.deepEqual(await ingestCare(new Request('https://example.invalid',{headers:{Authorization:'CareDevice '+otherAdapter.token}}),{measurements:[local]}),{ok:true,received:1});
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM care_measurements WHERE user_id=? AND external_id=?').get(member.id,local.id).count,1);
  const receiptPlan=database.prepare("EXPLAIN QUERY PLAN SELECT 1 FROM care_measurements WHERE user_id=? AND external_id=? AND timestamp_source='phone_received'").all(member.id,local.id);
  assert.match(JSON.stringify(receiptPlan),/care_measure_receipt_owner/);
  await assert.rejects(ingestCare(request(),{measurements:[{...local,id:'sb-local:invalid'}]}),/identifier/);
  for(const change of [{kind:'battery',unit:'%'},{value:200001},{unit:'bpm'},{timestampSource:'invented'},{value:1.5},{measuredAt:Date.now()}])await assert.rejects(ingestCare(request(),{measurements:[{...observation,...change,id:crypto.randomUUID()}]}));
  await ingestCare(request(),{measurements:[{...observation,id:'legacy-test',timestampSource:undefined}]});
  assert.equal(database.prepare("SELECT timestamp_source FROM care_measurements WHERE external_id='legacy-test'").get().timestamp_source,'unknown');
  await assert.rejects(careRoute(other,'disconnect',{id:adapter.id},true),/unavailable/);
  beforeBatch=()=>database.prepare('UPDATE care_devices SET active=0,token_hash=NULL WHERE id=?').run(adapter.id);
  await assert.rejects(ingestCare(request(),{measurements:[{...observation,id:'revoked-in-flight'}]}),/unavailable/);
  assert.equal(database.prepare("SELECT COUNT(*) AS count FROM care_measurements WHERE external_id='revoked-in-flight'").get().count,0);
  await assert.rejects(ingestCare(request(),{measurements:[observation]}),/unavailable/);
  const suspended=await careRoute(member,'connect',{name:'Second test adapter',permissions:['steps']},true);
  beforeBatch=()=>database.prepare('UPDATE users SET suspended=1 WHERE id=?').run(member.id);
  await assert.rejects(ingestCare(new Request('https://example.invalid',{headers:{Authorization:'CareDevice '+suspended.token}}),{measurements:[{...observation,id:'suspended-in-flight'}]}),/unavailable/);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM ledger').get().count,0);
  console.log('Care ingestion checks passed: migrations, privacy setup, account isolation, provenance, deduplication, validation, revocation and suspension; ledger unchanged.');
}finally{await server.close();database.close();delete globalThis.__watchCareEnvironment;}