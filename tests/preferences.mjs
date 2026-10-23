import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PreferenceStore,preferenceKey,taskFilterQuery} from '../lib/preferences.ts';

function fixture(){
 const records=new Map();
 const storage={getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
 return {records,storage};
}
test('Preferences restore exact choices and separate accounts and backends',()=>{
 const {storage}=fixture(),key=preferenceKey('https://one.invalid','alice');
 const store=new PreferenceStore(key,storage);
 assert.equal(store.getSnapshot().value.watch.receive,false);
 assert.equal(store.getSnapshot().value.watch.backgroundHistory,false);
 store.update('historyDays',7);store.update('page','care/watch');
 store.updateWatch({receive:true,device:{deviceId:'watch-1'},goal:'8000',steps:true,saveConsent:true,saveEnabled:true,backgroundHistory:true});
 const restored=new PreferenceStore(key,storage);
 assert.deepEqual(restored.getSnapshot(),store.getSnapshot());
 for(const other of [preferenceKey('https://one.invalid','bob'),preferenceKey('https://two.invalid','alice')]){
  assert.equal(new PreferenceStore(other,storage).getSnapshot().value.watch.receive,false);
 }
 assert.ok(restored.reset());
 assert.equal(new PreferenceStore(key,storage).getSnapshot().value.watch.receive,false);
});
test('Invalid, oversized and unsupported saved records fail closed with a visible error',()=>{
 for(const raw of ['{',JSON.stringify({version:2,options:{watch:{receive:true}}}),'x'.repeat(32001),JSON.stringify({version:1,options:{watch:{receive:true,token:'not-allowed'}}})]){
  const {storage}=fixture();storage.setItem('options',raw);
  const store=new PreferenceStore('options',storage);
  assert.equal(store.getSnapshot().value.watch.receive,false);
  assert.match(store.getSnapshot().error,/Could not read/);
 }
});
test('Storage failures warn without pretending permissions were saved',()=>{
 const storage={getItem(){throw Error('Denied');},setItem(){throw Error('Quota');},removeItem(){throw Error('Denied');}};
 const store=new PreferenceStore('options',storage);
 assert.match(store.getSnapshot().error,/Could not read/);
 assert.equal(store.updateWatch({receive:true}),false);
 assert.match(store.getSnapshot().error,/older permissions may return/);
 assert.equal(store.reset(),false);
 assert.equal(store.getSnapshot().value.watch.receive,false);
 assert.match(store.getSnapshot().error,/Could not reset/);
});
test('Preference validation excludes health data, credentials and transactional destinations',()=>{
 const {storage,records}=fixture(),store=new PreferenceStore('options',storage);
 for(const change of [{readings:{steps:1234}},{token:'secret'},{receive:'yes'}])assert.equal(store.updateWatch(change),false);
 assert.equal(store.update('page','task/private-task-id'),false);
 assert.equal(store.update('historyDays',99),false);
 assert.equal(records.size,0);
 store.updateWatch({goal:'7500',steps:true});
 assert.deepEqual(Object.keys(JSON.parse(records.get('options')).options.watch).sort(),['autoMeasure','backgroundHistory','goal','heartRate','receive','saveConsent','saveEnabled','steps']);
});
test('Memory-only demo choices never persist and filters keep exact values',()=>{
 const {storage,records}=fixture(),store=new PreferenceStore(null,storage);
 store.update('taskFilters',{category:'help',mode:'remote',maxMinutes:'45',date:'2026-10-16',location:'Hong Kong'});
 assert.equal(records.size,0);
 assert.equal(taskFilterQuery(store.getSnapshot().value.taskFilters),'&category=help&mode=remote&maxMinutes=45&date=2026-10-16&location=Hong+Kong');
 assert.equal(taskFilterQuery(new PreferenceStore(null).getSnapshot().value.taskFilters),'');
});
