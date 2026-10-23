import assert from 'node:assert/strict';
import {test} from 'node:test';
import {PineTimeWatch,WATCH_CHANNELS,WATCH_HEART_CONTROL,decodeReading,decodeSensingState} from '../lib/pinetime-watch.ts';
import {WatchStorage} from '../lib/watch-storage.ts';
import {assertReleaseBuild} from '../scripts/package-mobile.mjs';

const packet=(...bytes)=>new DataView(Uint8Array.from(bytes).buffer);
const settle=()=>new Promise(resolve=>setImmediate(resolve));

test('Release packaging accepts normal metadata and rejects diagnostic or unknown build modes',()=>{
  assert.doesNotThrow(()=>assertReleaseBuild({format:1,watchTestMode:false}));
  assert.throws(()=>assertReleaseBuild({format:1,watchTestMode:true},'iOS app'),/iOS app.*diagnostic/);
  for(const metadata of [undefined,null,{}, {format:1}, {format:1,watchTestMode:'false'}, {format:2,watchTestMode:false}])assert.throws(()=>assertReleaseBuild(metadata),/metadata/);
});

function storageFixture(){
  let state,now=Date.now();const uploads=[],revoked=[];
  const transport={
    async enroll(){return {id:'test-adapter',token:'a'.repeat(64)};},
    async upload(owner,token,readings){uploads.push({owner,readings});return {ok:true,received:readings.length};},
    async revoke(owner,id){revoked.push({owner,id});},
  };
  const storage=new WatchStorage(transport,next=>{state=next},()=>now);
  const observation=(value=4200)=>({phase:'connected',device:{deviceId:'test-watch'},readings:{steps:{value,receivedAt:now,deviceId:'test-watch'},heartRate:{value:72,receivedAt:now,deviceId:'test-watch'},battery:{value:86,receivedAt:now,deviceId:'test-watch'}}});
  return {storage,transport,uploads,revoked,observation,get state(){return state},advance(value=15000){now+=value;}};
}

test('Watch storage requires selected categories and never sends battery or another account data',async()=>{
  const fixture=storageFixture();fixture.storage.observe('member',fixture.observation());assert.equal(fixture.uploads.length,0);
  await assert.rejects(fixture.storage.start('member','PineTime',[]),/category/);
  await fixture.storage.start('member','PineTime',['steps']);fixture.storage.observe('other-member',fixture.observation());assert.equal(fixture.uploads.length,0);
  fixture.storage.observe('member',fixture.observation());await settle();
  assert.equal(fixture.state.phase,'saved');assert.deepEqual(fixture.uploads[0].readings.map(reading=>reading.kind),['steps']);
  assert.equal(fixture.uploads[0].readings[0].timestampSource,'phone_received');
  fixture.storage.stop();assert.equal(fixture.state.phase,'off');assert.equal(fixture.revoked.length,1);
});
test('Watch upload retries reuse IDs and three failures pause automatic retries',async()=>{
  const fixture=storageFixture();fixture.transport.upload=async(owner,token,readings)=>{fixture.uploads.push({owner,readings});throw Error('Offline');};
  await fixture.storage.start('member','PineTime',['steps']);fixture.storage.observe('member',fixture.observation());await settle();
  const firstId=fixture.uploads[0].readings[0].id;
  for(let count=0;count<4;count++){fixture.advance();fixture.storage.observe('member',fixture.observation());await settle();}
  assert.equal(fixture.uploads.length,3);assert.equal(fixture.uploads[1].readings[0].id,firstId);assert.equal(fixture.state.phase,'error');
  fixture.transport.upload=async(owner,token,readings)=>({ok:true,received:readings.length});await fixture.storage.retry();
  assert.equal(fixture.state.phase,'saved');assert.equal(fixture.state.pending,0);
});
test('Stopped watch storage ignores late enrollment and upload responses',async()=>{
  const fixture=storageFixture();let complete;
  fixture.transport.enroll=()=>new Promise(resolve=>{complete=resolve});const starting=fixture.storage.start('member','PineTime',['steps']);
  fixture.storage.stop();complete({id:'late-adapter',token:'a'.repeat(64)});await starting;assert.equal(fixture.state.phase,'off');assert.equal(fixture.revoked.length,1);
  fixture.transport.enroll=async()=>({id:'test-adapter',token:'a'.repeat(64)});
  fixture.transport.upload=()=>new Promise(resolve=>{complete=resolve});await fixture.storage.start('member','PineTime',['steps']);
  fixture.storage.observe('member',fixture.observation());fixture.storage.stop();complete({ok:true,received:1});await settle();assert.equal(fixture.state.phase,'off');assert.equal(fixture.state.lastSavedAt,undefined);
});
test('Private watch enrollment and upload abort after a bounded network wait',async context=>{
  context.mock.timers.enable({apis:['setTimeout']});
  const fixture=storageFixture();
  fixture.transport.enroll=(owner,name,permissions,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Network timeout')),{once:true}));
  const opening=fixture.storage.start('member','PineTime',['steps']);context.mock.timers.tick(15000);await opening;
  assert.equal(fixture.state.phase,'error');
  fixture.transport.enroll=async()=>({id:'test-adapter',token:'a'.repeat(64)});
  fixture.transport.upload=(owner,token,readings,signal)=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('Network timeout')),{once:true}));
  await fixture.storage.start('member','PineTime',['steps']);fixture.storage.observe('member',fixture.observation());
  context.mock.timers.tick(15000);await settle();assert.equal(fixture.state.phase,'error');assert.equal(fixture.state.pending,1);
  fixture.storage.stop();
});
test('Watch storage rejects stale heart rate and oversized counters and bounds unsaved memory',async()=>{
  const fixture=storageFixture();await fixture.storage.start('member','PineTime',['steps','heart_rate']);
  const stale=fixture.observation(200001);fixture.advance(16000);fixture.storage.observe('member',stale);await settle();assert.equal(fixture.uploads.length,0);
  fixture.transport.upload=async()=>{throw Error('Offline');};
  for(let count=0;count<70;count++){fixture.advance();fixture.storage.observe('member',fixture.observation());await settle();}
  assert.ok(fixture.state.pending<=60);assert.ok(fixture.state.discarded>0);
  fixture.advance(300001);await fixture.storage.retry();assert.equal(fixture.state.pending,0);assert.equal(fixture.state.phase,'ready');
});
function fixture() {
  let state,disconnected,selected=0,disconnects=0;
  const listeners=new Map(),stopped=[];
  const bluetooth={
    async initialize(){},
    async requestDevice(){selected++;return {deviceId:'test-watch',name:'PineTime'}},
    async connect(id,callback){disconnected=callback},
    async disconnect(){disconnects++},
    async read(id,service,characteristic){return characteristic===WATCH_CHANNELS.battery.characteristic?packet(86):characteristic===WATCH_CHANNELS.steps.characteristic?packet(104,16,0,0):packet(0,0)},
    async startNotifications(id,service,characteristic,callback){listeners.set(characteristic,callback)},
    async stopNotifications(id,service,characteristic){stopped.push(characteristic)},
  };
  const watch=new PineTimeWatch(bluetooth,next=>{state=next},()=>123456);
  return {watch,bluetooth,listeners,stopped,get state(){return state},get selected(){return selected},get disconnects(){return disconnects},lost(){disconnected()}};
}

function sensingFixture(){
 const base=fixture(),writes=[];
 let now=100000,state,phase=0,nextAt=0,fail=false;
 const read=base.bluetooth.read;
 base.bluetooth.read=async(id,service,characteristic)=>{
  if(characteristic!==WATCH_HEART_CONTROL)return read(id,service,characteristic);
  if(fail)throw Error('Characteristic not found');
  const remaining=Math.max(0,Math.ceil((nextAt-now)/1000));
  return packet(1,phase,remaining&255,remaining>>8);
 };
 base.bluetooth.write=async(id,service,characteristic,bytes)=>{
  assert.equal(characteristic,WATCH_HEART_CONTROL);
  assert.deepEqual([...new Uint8Array(bytes.buffer)],bytes.getUint8(1)===1?[1,1]:[1,0]);
  writes.push(bytes.getUint8(1));
  if(bytes.getUint8(1)===1){phase=2;nextAt=now+900000;}else phase=6;
 };
 const watch=new PineTimeWatch(base.bluetooth,value=>{state=value},()=>now);
 return {watch,bluetooth:base.bluetooth,writes,get state(){return state},advance(milliseconds){now+=milliseconds;},finish(){phase=4;},fail(value){fail=value;},cooldown(seconds){nextAt=now+seconds*1000;}};
}
test('Automatic sensing is opt-in and requests exactly every 15 minutes, not on every refresh',async()=>{
 const f=sensingFixture();await f.watch.connect(true);
 assert.deepEqual(f.writes,[]);
 await f.watch.setAutomaticMeasurement(true);
 assert.deepEqual(f.writes,[1]);assert.equal(f.state.sensing.phase,'queued');
 f.finish();f.advance(899999);await f.watch.refresh();assert.deepEqual(f.writes,[1]);
 f.advance(1);await f.watch.refresh();assert.deepEqual(f.writes,[1,1]);
 await f.watch.setAutomaticMeasurement(false);assert.deepEqual(f.writes,[1,1,0]);
 f.advance(900000);await f.watch.refresh();assert.deepEqual(f.writes,[1,1,0]);
 await f.watch.disconnect();
});
test('Firmware cooldown survives reconnection and stop/disconnect cancels remote sensing',async()=>{
 const f=sensingFixture();await f.watch.setAutomaticMeasurement(true);await f.watch.connect(true);
 assert.deepEqual(f.writes,[1]);await f.watch.disconnect(false);assert.deepEqual(f.writes,[1,0]);
 f.advance(60000);await f.watch.reconnect(true);assert.deepEqual(f.writes,[1,0]);
 assert.equal(f.state.sensing.phase,'cancelled');
 await f.watch.disconnect();
});
test('Unavailable old firmware is explicit, preserves live BLE, and does not retry-loop',async()=>{
 const f=sensingFixture();f.fail(true);await f.watch.setAutomaticMeasurement(true);await f.watch.connect(true);
 assert.equal(f.state.phase,'connected');assert.equal(f.state.sensing.phase,'unavailable');assert.match(f.state.sensing.error,/Characteristic not found/);
 for(let count=0;count<10;count++){f.advance(15000);await f.watch.refresh();}
 assert.deepEqual(f.writes,[]);assert.equal(f.state.readings.steps.value,4200);
 f.fail(false);await f.watch.retryAutomaticMeasurement();assert.deepEqual(f.writes,[1]);
 await f.watch.disconnect();
});
test('Sensing capability rejects invalid versions, phases, lengths and schedules',()=>{
 assert.equal(decodeSensingState(packet(1,5,132,3),100).phase,'no-reading');
 assert.equal(decodeSensingState(packet(2,4,132,3,1),100).periodic,true);
 for(const p of [packet(),packet(1,0),packet(2,0,0,0),packet(1,7,0,0),packet(1,0,133,3),packet(2,0,0,0,2),packet(2,7,0,0,1)])assert.throws(()=>decodeSensingState(p,100),/Unsupported/);
});
test('Native receipt timestamps cannot relabel delayed notifications as fresh',async()=>{
 const f=fixture();await f.watch.connect(true);
 const notify=f.listeners.get(WATCH_CHANNELS.heartRate.characteristic);
 notify(packet(0,72),123000);assert.equal(f.state.readings.heartRate.receivedAt,123000);
 notify(packet(0,90),100000);assert.equal(f.state.readings.heartRate.value,72);
 notify(packet(0,90),NaN);assert.equal(f.state.readings.heartRate,undefined);assert.match(f.state.error,/Invalid/);
 await f.watch.disconnect();
});
test('Background sensing arms the watch once and stops on opt-out or disconnect',async()=>{
 const f=fixture(),writes=[],permissions=[];let scheduled=false;
 const read=f.bluetooth.read;
 f.bluetooth.read=async(id,service,characteristic)=>characteristic===WATCH_HEART_CONTROL?packet(2,4,132,3,Number(scheduled)):read(id,service,characteristic);
 f.bluetooth.write=async(id,service,characteristic,bytes)=>{writes.push([...new Uint8Array(bytes.buffer)]);scheduled=bytes.getUint8(1)===2;};
 f.bluetooth.configureHistory=async options=>permissions.push(options);
 await f.watch.setBackgroundHistory('account-one');await f.watch.setAutomaticMeasurement(true);await f.watch.connect(true);await settle();
 assert.deepEqual(writes,[[2,2]]);assert.equal(f.watch.canRunInBackground(),true);
 for(let i=0;i<5;i++)await f.watch.refresh();
 assert.deepEqual(writes,[[2,2]]);assert.equal(permissions.filter(value=>value.enabled).length,1);
 await f.watch.setBackgroundHistory(undefined);assert.equal(f.watch.canRunInBackground(),false);
 assert.deepEqual(writes,[[2,2],[1,0]]);assert.equal(permissions.at(-1).enabled,false);
 await f.watch.setBackgroundHistory('account-one');assert.equal(f.watch.canRunInBackground(),true);
 await f.watch.disconnect();assert.equal(permissions.at(-1).enabled,false);assert.equal(f.watch.canRunInBackground(),false);
});
test('Old firmware cannot claim background readiness or start private recording',async()=>{
 const f=sensingFixture(),permissions=[];
 f.bluetooth.configureHistory=async options=>permissions.push(options);
 await f.watch.setBackgroundHistory('account-one');await f.watch.setAutomaticMeasurement(true);await f.watch.connect(true);await settle();
 assert.equal(f.watch.canRunInBackground(),false);assert.match(f.state.sensing.error,/0.1.13/);
 assert.deepEqual(permissions,[]);assert.deepEqual(f.writes,[]);
 await f.watch.disconnect();
});
test('Durable history retains old receipt times and uploads only selected categories',async()=>{
 const f=storageFixture(),marks=[],reads=[];
 const record={id:'sb-local:00000000-0000-0000-0000-000000000001',kind:'heart_rate',value:72,receivedAt:946684800000};
 let pending=true;
 const source={
  async read(scope,options){reads.push({scope,options});return {records:pending?[record]:[],total:1,pending:Number(pending)};},
  async markUploaded(scope,ids){marks.push({scope,ids});pending=false;},
 };
 await f.storage.syncHistory('member','scope',source);assert.equal(reads.length,0);
 await f.storage.start('member','PineTime',['heart_rate']);
 await f.storage.syncHistory('other','scope',source);assert.equal(reads.length,0);
 await f.storage.syncHistory('member','scope',source);
 assert.deepEqual(reads[0].options.pendingKinds,['heart_rate']);
 assert.equal(f.uploads[0].readings[0].measuredAt,'2000-01-01T00:00:00.000Z');
 assert.deepEqual(marks,[{scope:'scope',ids:[record.id]}]);assert.equal(f.state.phase,'saved');
 f.storage.stop();
});
test('Unconfirmed history uploads remain on the phone and a stopped session never acknowledges them',async()=>{
 const f=storageFixture(),record={id:'sb-local:00000000-0000-0000-0000-000000000002',kind:'steps',value:42,receivedAt:946684800000};
 let marked=0,complete;
 const source={async read(){return {records:[record]};},async markUploaded(){marked++;}};
 await f.storage.start('member','PineTime',['steps']);
 f.transport.upload=async()=>{throw Error('Offline');};
 await f.storage.syncHistory('member','scope',source);assert.equal(marked,0);assert.match(f.state.error,/Offline/);
 await f.storage.retry();
 f.transport.upload=()=>new Promise(resolve=>{complete=resolve;});
 const syncing=f.storage.syncHistory('member','scope',source);await settle();f.storage.stop();
 complete({ok:true,received:1});await syncing;assert.equal(marked,0);
});
test('Locking the phone during native history loading cannot initiate a cloud upload',async()=>{
 const f=storageFixture();let active=true,finish;
 const source={read:()=>new Promise(resolve=>{finish=resolve;}),async markUploaded(){throw Error('Must not acknowledge');}};
 await f.storage.start('member','PineTime',['steps']);
 const syncing=f.storage.syncHistory('member','scope',source,()=>active);
 await settle();active=false;
 finish({records:[{id:'sb-local:00000000-0000-0000-0000-000000000003',kind:'steps',value:42,receivedAt:946684800000}]});
 await syncing;assert.equal(f.uploads.length,0);f.storage.stop();
});
test('Revoking permission during capability discovery cannot send a late start',async()=>{
 const f=sensingFixture();await f.watch.connect(true);let finish;
 f.bluetooth.read=()=>new Promise(resolve=>{finish=resolve;});
 const enabling=f.watch.setAutomaticMeasurement(true);await settle();
 await f.watch.setAutomaticMeasurement(false);finish(packet(1,0,0,0));await enabling;
 assert.deepEqual(f.writes,[]);await f.watch.disconnect();
});

test('Retained or refresh-failed observations cannot create fresh private uploads',async()=>{
  const fixture=storageFixture();await fixture.storage.start('member','PineTime',['steps']);
  const retained=fixture.observation();retained.refreshErrors={steps:'Could not refresh steps'};
  fixture.storage.observe('member',retained);await settle();assert.equal(fixture.uploads.length,0);
  delete retained.refreshErrors;fixture.storage.observe('member',retained);await settle();assert.equal(fixture.uploads.length,1);
  fixture.advance();fixture.storage.observe('member',retained);await settle();assert.equal(fixture.uploads.length,1);
  fixture.advance();fixture.storage.observe('member',retained);await settle();assert.equal(fixture.uploads.length,1);
  fixture.storage.observe('member',fixture.observation());await settle();assert.equal(fixture.uploads.length,2);
  fixture.storage.stop();
});
test('Decodes actual PineTime little-endian steps and standard battery/heart packets',()=>{
  assert.equal(decodeReading('steps',packet(255,255,255,255)),4294967295);
  assert.equal(decodeReading('battery',packet(0)),0);
  assert.equal(decodeReading('heartRate',packet(0,72)),72);
  assert.equal(decodeReading('heartRate',packet(1,44,1)),300);
  assert.equal(decodeReading('heartRate',packet(0,0)),null);
  assert.equal(decodeReading('heartRate',packet(2,72)),null);
  assert.equal(decodeReading('heartRate',packet(6,72)),72);
  assert.equal(decodeReading('heartRate',packet(16,72,1,0)),72);
  for(const [kind,data] of [['steps',packet(1)],['battery',packet(101)],['heartRate',packet(1,72)],['heartRate',packet(4,72)],['heartRate',packet(16,72)],['heartRate',packet(1,255,255)]])assert.throws(()=>decodeReading(kind,data));
});
test('Consent is required before opening Bluetooth',async()=>{
  const f=fixture();await assert.rejects(f.watch.connect(false),/consent/);assert.equal(f.selected,0);
});
test('The picker filters by the service advertised by PineTime and uses the iOS list view',async()=>{
  const f=fixture();let options;
  f.bluetooth.requestDevice=async selected=>{options=selected;return {deviceId:'test-watch',name:'PineTime'};};
  await f.watch.connect(true);
  assert.deepEqual(options.services,[WATCH_CHANNELS.heartRate.service]);
  assert.deepEqual(options.optionalServices,Object.values(WATCH_CHANNELS).map(channel=>channel.service));
  assert.equal(options.displayMode,'list');
  await f.watch.disconnect();
});
test('Initial reads and automatic notifications include device identity and received time',async()=>{
  const f=fixture();await f.watch.connect(true);
  assert.equal(f.state.phase,'connected');assert.equal(f.state.readings.steps.value,4200);
  assert.equal(f.state.readings.heartRate,undefined);
  f.listeners.get(WATCH_CHANNELS.heartRate.characteristic)(packet(0,72));
  assert.deepEqual(f.state.readings.heartRate,{value:72,receivedAt:123456,deviceId:'test-watch'});
  const read=f.bluetooth.read;
  f.bluetooth.read=async(id,service,characteristic)=>characteristic===WATCH_CHANNELS.steps.characteristic?packet(105,16,0,0):read(id,service,characteristic);
  await f.watch.refresh();assert.equal(f.state.readings.steps.value,4201);
  await f.watch.disconnect();assert.equal(f.stopped.length,2);assert.deepEqual(f.state.readings,{});
});
test('Connection discovery has a bounded 30-second deadline and timeout cleans up before retry',async()=>{
  const f=fixture();let options,reads=0;
  const read=f.bluetooth.read;
  f.bluetooth.read=async(...args)=>{reads++;return read(...args);};
  f.bluetooth.connect=async(id,callback,selected)=>{options=selected;throw Error('Connection timeout');};
  await assert.rejects(f.watch.connect(true),/Failed while connecting to the selected watch and discovering services: Connection timeout/);
  assert.deepEqual(options,{timeout:30000});assert.equal(f.disconnects,1);assert.equal(reads,0);assert.deepEqual(f.state.readings,{});
  f.bluetooth.connect=async()=>{};
  await f.watch.connect(true);assert.equal(f.state.phase,'connected');await f.watch.disconnect();
});
test('Connection stages do not report connected or accept readings before discovery completes',async()=>{
  const watchFixture=fixture();let complete;const stages=[];
  const watch=new PineTimeWatch(watchFixture.bluetooth,state=>stages.push(state));
  watchFixture.bluetooth.connect=()=>new Promise(resolve=>{complete=resolve;});
  const opening=watch.connect(true);await settle();
  assert.equal(stages.at(-1).connectionStage,'discovering');assert.equal(stages.at(-1).phase,'connecting');
  assert.deepEqual(stages.at(-1).readings,{});
  complete();await opening;
  assert.ok(['initializing','selecting','discovering','subscribing','reading'].every(stage=>stages.some(state=>state.connectionStage===stage)));
  assert.equal(stages.at(-1).phase,'connected');assert.equal(stages.at(-1).connectionStage,undefined);
  await watch.disconnect();
});
test('Disconnect during discovery ignores late completion and permits a clean retry',async()=>{
  const watchFixture=fixture();let complete,drop;
  watchFixture.bluetooth.connect=(id,callback)=>{drop=callback;return new Promise(resolve=>{complete=resolve;});};
  const opening=watchFixture.watch.connect(true);await settle();drop();
  assert.equal(watchFixture.state.phase,'disconnected');assert.deepEqual(watchFixture.state.readings,{});
  complete();await assert.rejects(opening,/cancelled/);assert.deepEqual(watchFixture.state.readings,{});assert.equal(watchFixture.disconnects,1);
  watchFixture.bluetooth.connect=async()=>{};await watchFixture.watch.connect(true);assert.equal(watchFixture.state.phase,'connected');await watchFixture.watch.disconnect();
});
test('Disconnect clears health data, ignores late callbacks, and reconnects to the selected watch',async()=>{
  const f=fixture();await f.watch.connect(true);f.lost();assert.equal(f.state.phase,'disconnected');
  f.listeners.get(WATCH_CHANNELS.heartRate.characteristic)(packet(0,72));assert.deepEqual(f.state.readings,{});
  await f.watch.reconnect(true);assert.equal(f.selected,1);assert.equal(f.state.phase,'connected');
  await f.watch.disconnect();await assert.rejects(f.watch.reconnect(true),/Select/);
});
test('Malformed notification is rejected rather than displayed as health data',async()=>{
  const f=fixture();await f.watch.connect(true);
  f.listeners.get(WATCH_CHANNELS.heartRate.characteristic)(packet(1));assert.equal(f.state.readings.heartRate,undefined);assert.match(f.state.error,/Invalid/);
  await f.watch.disconnect();
});
test('Unsupported devices and subscription errors close partial connections',async()=>{
  const f=fixture();f.bluetooth.read=async()=>{throw Error('Service unavailable')};
  await assert.rejects(f.watch.connect(true),/Failed while reading battery: Service unavailable/);assert.equal(f.state.phase,'error');assert.equal(f.disconnects,1);assert.equal(f.stopped.length,1);assert.deepEqual(f.state.readings,{});
});
test('Cancelling a pending picker cannot create a late connection',async()=>{
  const f=fixture();let choose;f.bluetooth.requestDevice=()=>new Promise(resolve=>{choose=resolve});
  const opening=f.watch.connect(true);await new Promise(resolve=>setImmediate(resolve));
  await f.watch.disconnect();choose({deviceId:'late'});await assert.rejects(opening,/cancelled/);assert.equal(f.state.phase,'idle');
});
test('Initial read cannot overwrite a newer notification',async()=>{
  const f=fixture(),read=f.bluetooth.read;
  f.bluetooth.read=async(id,service,characteristic)=>{
    if(characteristic===WATCH_CHANNELS.battery.characteristic)f.listeners.get(characteristic)(packet(87));
    return read(id,service,characteristic);
  };
  await f.watch.connect(true);assert.equal(f.state.readings.battery.value,87);await f.watch.disconnect();
});
test('Periodic fallback refreshes steps without treating cached heart rate as a new measurement',async()=>{
  const f=fixture();await f.watch.connect(true);
  f.listeners.get(WATCH_CHANNELS.heartRate.characteristic)(packet(0,72));
  const read=f.bluetooth.read;
  f.bluetooth.read=async(id,service,characteristic)=>characteristic===WATCH_CHANNELS.steps.characteristic?packet(136,19,0,0):read(id,service,characteristic);
  await f.watch.refresh();assert.equal(f.state.readings.steps.value,5000);assert.equal(f.state.readings.heartRate.value,72);
  assert.equal(f.state.readings.heartRate.receivedAt,123456);
  f.listeners.get(WATCH_CHANNELS.heartRate.characteristic)(packet(0,0));assert.equal(f.state.readings.heartRate,undefined);
  await f.watch.disconnect();await f.watch.refresh();assert.deepEqual(f.state.readings,{});
});
test('Failed refresh retains original readings and clears only recovered channel warnings',async()=>{
  const watchFixture=fixture();await watchFixture.watch.connect(true);const read=watchFixture.bluetooth.read;
  const original={...watchFixture.state.readings};
  watchFixture.bluetooth.read=async()=>{throw Error('Read unavailable');};
  await watchFixture.watch.refresh();assert.deepEqual(watchFixture.state.readings,original);
  assert.deepEqual(Object.keys(watchFixture.state.refreshErrors).sort(),['battery','steps']);
  watchFixture.listeners.get(WATCH_CHANNELS.heartRate.characteristic)(packet(0,72));
  assert.deepEqual(Object.keys(watchFixture.state.refreshErrors).sort(),['battery','steps']);
  watchFixture.bluetooth.read=async(...args)=>{if(args[2]===WATCH_CHANNELS.steps.characteristic)throw Error('Read unavailable');return read(...args);};
  await watchFixture.watch.refresh();assert.equal(watchFixture.state.refreshErrors.battery,undefined);assert.match(watchFixture.state.refreshErrors.steps,/refresh steps/);
  assert.deepEqual(watchFixture.state.readings.steps,original.steps);
  watchFixture.bluetooth.read=read;await watchFixture.watch.refresh();assert.deepEqual(watchFixture.state.refreshErrors,{});
  await watchFixture.watch.disconnect();assert.deepEqual(watchFixture.state.readings,{});assert.deepEqual(watchFixture.state.refreshErrors,{});
});
test('A failed refresh cannot mark a newer notification as failed',async()=>{
  const watchFixture=fixture();await watchFixture.watch.connect(true);const read=watchFixture.bluetooth.read;
  watchFixture.bluetooth.read=async(...args)=>{
    if(args[2]===WATCH_CHANNELS.battery.characteristic){watchFixture.listeners.get(args[2])(packet(87));throw Error('Late read failure');}
    return read(...args);
  };
  await watchFixture.watch.refresh();assert.equal(watchFixture.state.readings.battery.value,87);assert.equal(watchFixture.state.refreshErrors.battery,undefined);
  await watchFixture.watch.disconnect();
});
test('A second pairing cannot race a cancelled but unresolved picker',async()=>{
  const f=fixture();let choose;f.bluetooth.requestDevice=()=>new Promise(resolve=>{choose=resolve});
  const opening=f.watch.connect(true);await new Promise(resolve=>setImmediate(resolve));await f.watch.disconnect();
  await assert.rejects(f.watch.connect(true),/active/);
  choose({deviceId:'late'});await assert.rejects(opening,/cancelled/);
});
test('Repeated disconnects share cleanup and block pairing until it finishes',async()=>{
  const f=fixture();await f.watch.connect(true);let finish;
  f.bluetooth.stopNotifications=()=>new Promise(resolve=>{finish=resolve});
  const first=f.watch.disconnect(),second=f.watch.disconnect();
  await assert.rejects(f.watch.connect(true),/active/);
  f.bluetooth.stopNotifications=async()=>{};finish();await first;await second;
  assert.equal(f.disconnects,1);await f.watch.connect(true);await f.watch.disconnect();
});
test('Slow refreshes cannot accumulate overlapping reads',async()=>{
  const f=fixture();await f.watch.connect(true);const read=f.bluetooth.read;let finish,count=0;
  f.bluetooth.read=(...args)=>{count++;return new Promise(resolve=>{finish=async()=>resolve(await read(...args))})};
  const refreshing=f.watch.refresh();await f.watch.refresh();assert.equal(count,1);
  f.bluetooth.read=read;await finish();await refreshing;await f.watch.disconnect();
});
test('Cached heart-rate reads are never interpreted as fresh measurement data',async()=>{
  const f=fixture(),read=f.bluetooth.read;let heartReads=0;
  f.bluetooth.read=async(id,service,characteristic)=>{
    if(characteristic===WATCH_CHANNELS.heartRate.characteristic){heartReads++;return packet(0,72)}
    return read(id,service,characteristic);
  };
  await f.watch.connect(true);await f.watch.refresh();assert.equal(heartReads,0);assert.equal(f.state.readings.heartRate,undefined);
  await f.watch.disconnect();
});
test('Existing firmware is protected from unsafe handle-zero step notification allocation',async()=>{
  const f=fixture();await f.watch.connect(true);
  assert.equal(f.listeners.has(WATCH_CHANNELS.steps.characteristic),false);
  assert.equal(f.state.readings.steps.value,4200);await f.watch.disconnect();
});