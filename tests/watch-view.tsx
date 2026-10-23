import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PineTimeWatchPanel,usePineTimeWatch,WatchSessionProvider,useSharedWatch} from '../components/pinetime-watch';
import {WATCH_CHANNELS,WATCH_HEART_CONTROL,type WatchBluetooth} from '../lib/pinetime-watch';
import type {LocalWatchRecord,WatchHistoryPermission} from '../lib/watch-history-native';
import {SilverLanding} from '../components/silver-landing';
import '../app/globals.css';
import '../app/silver-care.css';
import '../app/silver-landing.css';

const listeners=new Map<string,(packet:DataView)=>void>();
const bytes=(...values:number[])=>new DataView(Uint8Array.from(values).buffer);
let disconnected=()=>{},requests=0,connections=0,steps=4200;
let syncFailure=false,syncRequests:{path:string;body:any}[]=[];
let enrollmentFailure=location.search.includes('fail-enrollment');
let sensingPhase=0,sensingNext=Number(sessionStorage.getItem('fixture-sensing-next')||0);
let scheduled=false,historyPermission:WatchHistoryPermission|undefined;
const historyRecords=new Map<string,LocalWatchRecord[]>();
const sensingWrites:number[]=[];
const failedReads=new Set<string>();
let discoveryHeld=false,finishDiscovery:(()=>void)|undefined,connectionFailure='';
async function storageApi(path:string,body:any){
  syncRequests.push({path,body});
  if(path==='care/connect'){if(enrollmentFailure)throw Error('Test enrollment offline');return {id:'fixture-adapter',token:'a'.repeat(64)};}
  if(path==='care-device'){
    if(syncFailure)throw Error('Test server offline');
    return {ok:true,received:body.measurements.length};
  }
  return {ok:true};
}
const bluetooth:WatchBluetooth={
  ...(location.search.includes('background')?{
    async configureHistory(options:WatchHistoryPermission){historyPermission=options;},
    history:{
      async read(scope:string,options:{before?:number;pendingKinds?:('steps'|'heart_rate')[];limit?:number}={}){
        const records=historyRecords.get(scope)??[];
        const filtered=records.filter(record=>(options.before===undefined||record.sequence<options.before)&&(!options.pendingKinds||!record.uploaded&&options.pendingKinds.includes(record.kind)));
        filtered.sort((a,b)=>options.pendingKinds?a.sequence-b.sequence:b.sequence-a.sequence);
        return {records:filtered.slice(0,options.limit??200),total:records.length,pending:records.filter(record=>!record.uploaded).length};
      },
      async markUploaded(scope:string,ids:string[]){for(const record of historyRecords.get(scope)??[])if(ids.includes(record.id))record.uploaded=true;},
      async deleteAll(scope:string){historyRecords.delete(scope);},
    },
  }:{}),
  async initialize(){},
  async requestDevice(){requests++;return {deviceId:'fixture-watch',name:'PineTime test transport'};},
  async connect(id,callback){connections++;disconnected=callback;if(discoveryHeld)await new Promise<void>(resolve=>{finishDiscovery=resolve;});if(connectionFailure)throw Error(connectionFailure);},
  async disconnect(){},
  async read(id,service,characteristic){
    if(characteristic===WATCH_HEART_CONTROL){
      if(location.search.includes('old-firmware'))throw Error('Characteristic not found');
      const remaining=Math.max(0,Math.ceil((sensingNext-Date.now())/1000));
      return location.search.includes('background')?bytes(2,sensingPhase,remaining&255,remaining>>8,Number(scheduled)):bytes(1,sensingPhase,remaining&255,remaining>>8);
    }
    if(failedReads.has(characteristic))throw Error('Test read unavailable');
    if(characteristic===WATCH_CHANNELS.battery.characteristic)return bytes(86);
    if(characteristic===WATCH_CHANNELS.heartRate.characteristic)return bytes(0,0);
    const buffer=new ArrayBuffer(4);const view=new DataView(buffer);view.setUint32(0,steps,true);return view;
  },
  async startNotifications(id,service,characteristic,callback){listeners.set(characteristic,callback);},
  async stopNotifications(){},
  async write(id,service,characteristic,packet){
    if(characteristic!==WATCH_HEART_CONTROL)throw Error('Unexpected fixture command');
    const operation=packet.getUint8(1);sensingWrites.push(operation);
    if(operation===2){scheduled=true;return;}
    if(operation===0)scheduled=false;
    sensingPhase=operation===1?2:6;
    if(operation===1){sensingNext=Date.now()+900000;sessionStorage.setItem('fixture-sensing-next',String(sensingNext));}
  },
};
function Fixture(){
  const [owner,setOwner]=useState('fixture-user');
  const watch=usePineTimeWatch(owner,bluetooth,!location.search.includes('web'));
  (window as any).watchQA={
    notify(channel:keyof typeof WATCH_CHANNELS,packet:number[]){listeners.get(WATCH_CHANNELS[channel].characteristic)?.(bytes(...packet));},
    drop(){disconnected();},
    setSteps(value:number){steps=value;},
    failRead(channel:keyof typeof WATCH_CHANNELS,value:boolean){const characteristic=WATCH_CHANNELS[channel].characteristic;if(value)failedReads.add(characteristic);else failedReads.delete(characteristic);},
    holdDiscovery(value:boolean){discoveryHeld=value;},
    finishDiscovery(){discoveryHeld=false;finishDiscovery?.();finishDiscovery=undefined;},
    failConnect(message:string){connectionFailure=message;},
    changeOwner(){setOwner('other-fixture-user');},
    resetOptions(){watch.preferences.store.reset();},
    sensingStatus(value:number){sensingPhase=value;},
    sensingWrites(){return sensingWrites;},
    addHistory(count=1){
      if(!historyPermission?.enabled)throw Error('History permission is not enabled');
      const records=historyRecords.get(historyPermission.scope)??[];
      for(let index=0;index<count;index++){
        const sequence=records.length+1;
        records.push({sequence,id:'sb-local:'+crypto.randomUUID(),deviceId:'fixture-watch',deviceName:'PineTime test transport',
          kind:'heart_rate',value:72,receivedAt:Date.now()-86400000*365-sequence*900000,uploaded:false});
      }
      historyRecords.set(historyPermission.scope,records);
    },
    counts(){return {requests,connections};},
    storageRequests(){return syncRequests;},
    failSync(value:boolean){syncFailure=value;},
  };
  return <div className="care-shell"><main className="care-main"><img src="/images/brand/silver-plus.jpeg" alt="Silver Plus" width="52" height="52"/><h1>Bluetooth receiver test fixture</h1><PineTimeWatchPanel watch={watch} storageApi={storageApi} storageReady/></main></div>;
}
function SessionContent(){
 const watch=useSharedWatch(),[visible,setVisible]=useState(true);
 if(!watch)throw Error('Missing watch test session');
 (window as any).sessionQA={counts:()=>({requests,connections}),storageRequests:()=>syncRequests,failEnrollment(value:boolean){enrollmentFailure=value;}};
 return <main><button onClick={()=>setVisible(value=>!value)}>Switch screen</button>{visible?<PineTimeWatchPanel watch={watch} storageReady/>:<p>Another app screen</p>}</main>;
}
createRoot(document.getElementById('root')!).render(location.search.includes('landing')?<SilverLanding onStart={()=>{}} onSignIn={()=>{}} onEnter={()=>{}} onCare={()=>{}}/>:location.search.includes('session')?<WatchSessionProvider owner="session-fixture" api={storageApi} enabled bluetooth={bluetooth} supported><SessionContent/></WatchSessionProvider>:<Fixture/>);