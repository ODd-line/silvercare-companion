import test from 'node:test';
import assert from 'node:assert/strict';
import {buildTimeline,localDayKey,localDayBounds,chartableHeartReading} from '../lib/care-timeline.ts';
const at=Date.parse('2026-10-26T03:35:00Z')/1000;
const reading=(id,overrides={})=>({id,kind:'heart_rate',value:72,unit:'bpm',measured_at:at,device_id:'watch-a',device_name:'PineTime',timestamp_source:'phone_received',...overrides});

test('pairing retains every reading and respects device, exact time, provenance and demo status',()=>{
 const readings=[reading('h'),reading('s',{kind:'steps',unit:'steps',value:240}),reading('other-watch',{device_id:'watch-b'}),reading('later',{measured_at:at+1}),reading('sensor',{timestamp_source:'sensor'}),reading('sample',{demo:true}),reading('unnamed-a',{device_id:undefined}),reading('unnamed-b',{device_id:undefined})];
 const [day]=buildTimeline([],readings);
 assert.equal(day.entries.length,7);
 assert.equal(day.readings.length,8);
 assert.deepEqual(day.entries.find(entry=>entry.readings.length===2).readings.map(value=>value.id),['h','s']);
 assert.equal(readings[0].id,'h','input order and objects are not mutated');
});
test('notes and reading groups are interleaved newest first, with local day boundaries',()=>{
 const previous=process.env.TZ;process.env.TZ='Asia/Hong_Kong';
 try{
  const midnight=Date.parse('2026-10-25T16:00:00Z')/1000;
  const days=buildTimeline([{id:'note',kind:'checkin',occurred_at:midnight+60,data:{feeling:'Fine'}}],[reading('new',{measured_at:midnight+120}),reading('old',{measured_at:midnight-1})]);
  assert.deepEqual(days.map(day=>day.date),['2026-10-26','2026-10-25']);
  assert.deepEqual(days[0].entries.map(entry=>entry.type),['readings','note']);
  assert.equal(days[0].noteCount,1);
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
test('filters and selected dates count only visible records; steps are never added together',()=>{
 const notes=[{id:'note',kind:'symptom',occurred_at:at,data:{description:'Tired'}}];
 const readings=[reading('h'),reading('s1',{kind:'steps',unit:'steps',value:4000}),reading('s2',{kind:'steps',unit:'steps',value:20,measured_at:at+10})];
 assert.equal(buildTimeline(notes,readings,'heart')[0].readings.length,1);
 assert.equal(buildTimeline(notes,readings,'notes')[0].readings.length,0);
 assert.equal(buildTimeline(notes,readings,'notes')[0].noteCount,1);
 assert.deepEqual(buildTimeline(notes,readings,'steps')[0].readings.map(reading=>reading.value),[20,4000]);
 assert.equal(buildTimeline(notes,readings,'all',localDayKey(at)).length,1);
 assert.equal(buildTimeline(notes,readings,'all','2000-01-01').length,0);
});
test('unknown dates stay accessible separately and invalid heart values cannot enter the graph',()=>{
 const readings=[reading('nan',{measured_at:NaN}),reading('zero',{measured_at:0}),reading('negative',{value:-1}),reading('units',{unit:'steps'}),reading('decimal',{value:72.5}),reading('sensor',{value:72.5,timestamp_source:'sensor'})];
 const days=buildTimeline([],readings);
 assert.equal(days.at(-1).date,'');assert.equal(days.at(-1).entries.length,2);
 assert.equal(days.reduce((count,day)=>count+day.readings.length,0),6);
 assert.deepEqual(readings.filter(chartableHeartReading).map(reading=>reading.id),['sensor']);
});
test('local calendar bounds handle daylight saving days without inventing 24-hour durations',()=>{
 const previous=process.env.TZ;process.env.TZ='America/New_York';
 try{
  const spring=localDayBounds('2026-03-08'),fall=localDayBounds('2026-11-01');
  assert.equal(spring[1]-spring[0],23*3600);assert.equal(fall[1]-fall[0],25*3600);
  assert.equal(localDayBounds('2026-02-30'),null);assert.equal(localDayBounds('bad'),null);
 }finally{if(previous===undefined)delete process.env.TZ;else process.env.TZ=previous;}
});
