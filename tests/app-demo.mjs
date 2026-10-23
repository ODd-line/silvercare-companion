import assert from 'node:assert/strict';
import {test} from 'node:test';
import {createAppDemo} from '../lib/app-demo.ts';

test('Demo profile supplies the same review collection as a real member',async()=>{
 const api=createAppDemo();
 const me=await api('me');
 assert.deepEqual(me.user.reviews,[]);
});

test('Demo programs provides every collection used by the member program screen',async()=>{
 const programs=await createAppDemo()('programs');
 assert.deepEqual(programs,{programs:[],enrollments:[],support:[],badges:[],matches:[]});
});

test('Editing a demo note updates the original and rejects stale or missing records',async()=>{
 const api=createAppDemo();
 const body={kind:'symptom',occurredAt:new Date().toISOString(),data:{description:'Sample concern'},confirmed:true};
 const created=await api('care/record',body);
 const original=(await api('care')).records[0];
 await api('care/record',{...body,id:created.id,version:original.version,data:{description:'Updated sample concern'}});
 const records=(await api('care')).records;
 assert.equal(records.length,1);
 assert.equal(records[0].id,created.id);
 assert.equal(records[0].data.description,'Updated sample concern');
 assert.equal(records[0].version,original.version+1);
 await assert.rejects(api('care/record',{...body,id:created.id,version:original.version}),/changed/);
 await api('care/delete-record',{id:created.id});
 await assert.rejects(api('care/record',{...body,id:created.id,version:records[0].version}),/not found/);
 assert.equal((await api('care')).records.length,0);
});
