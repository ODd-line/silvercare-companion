import type {WatchState} from './pinetime-watch';
import type {WatchHistoryRepository} from './watch-history-native';

export type StoredWatchKind = 'steps' | 'heart_rate';
export type WatchObservation = {id:string;kind:StoredWatchKind;value:number;unit:'steps'|'bpm';measuredAt:string;timestampSource:'phone_received'};
export type WatchStorageState = {phase:'off'|'enrolling'|'ready'|'pending'|'saved'|'error';pending:number;discarded:number;registered?:boolean;lastSavedAt?:number;error?:string};
export interface WatchStorageTransport {
  enroll(owner:string,name:string,permissions:StoredWatchKind[],signal:AbortSignal):Promise<{id:string;token:string}>;
  upload(owner:string,token:string,measurements:WatchObservation[],signal:AbortSignal):Promise<{ok:boolean;received:number}>;
  revoke(owner:string,id:string):Promise<void>;
}

export class WatchStorage {
  private generation=0;
  private owner='';
  private adapter?:{id:string;token:string};
  private permissions:StoredWatchKind[]=[];
  private queue:WatchObservation[]=[];
  private sampled:Partial<Record<StoredWatchKind,number>>={};
  private deviceId?:string;
  private controller?:AbortController;
  private uploading=false;
  private failures=0;
  private nextRetryAt=0;
  private state:WatchStorageState={phase:'off',pending:0,discarded:0};
  private readonly transport:WatchStorageTransport;
  private readonly changed:(state:WatchStorageState)=>void;
  private readonly now:()=>number;

  constructor(transport:WatchStorageTransport,changed:(state:WatchStorageState)=>void,now:()=>number=Date.now){
    this.transport=transport;this.changed=changed;this.now=now;
  }
  private publish(next:Partial<WatchStorageState>){this.state={...this.state,...next,pending:this.queue.length,registered:!!this.adapter};this.changed({...this.state});}

  async start(owner:string,name:string,permissions:StoredWatchKind[]){
    if(this.state.phase==='enrolling'||this.adapter)throw Error('A private watch connection is already active');
    if(!owner||!permissions.length||permissions.some(kind=>!['steps','heart_rate'].includes(kind)))throw Error('Choose at least one watch data category');
    const generation=++this.generation;
    this.owner=owner;this.permissions=[...new Set(permissions)];this.queue=[];this.sampled={};this.deviceId=undefined;this.failures=0;this.nextRetryAt=0;
    this.controller=new AbortController();
    const controller=this.controller,timeout=setTimeout(()=>controller.abort(),15000);
    this.state={phase:'enrolling',pending:0,discarded:0};this.publish({});
    try{
      const adapter=await this.transport.enroll(owner,name,this.permissions,controller.signal);
      if(generation!==this.generation){void this.transport.revoke(owner,adapter.id).catch(()=>{});return;}
      if(!adapter.id||!/^[a-f0-9]{64}$/.test(adapter.token))throw Error('Invalid private watch connection');
      this.adapter=adapter;this.publish({phase:'ready'});
    }catch(error){if(generation===this.generation)this.publish({phase:'error',error:error instanceof Error?error.message:'Could not register the watch'});}
    finally{clearTimeout(timeout);}
  }

  observe(owner:string,state:WatchState){
    if(owner!==this.owner||!this.adapter)return;
    if(state.phase!=='connected')return;
    const selected=state.device?.deviceId;
    if(!selected)return;
    if(this.deviceId&&this.deviceId!==selected){this.stop();return;}
    this.deviceId=selected;
    for(const kind of this.permissions){
      const channel=kind==='heart_rate'?'heartRate':'steps';
      const reading=state.readings[channel];
      if(!reading||reading.deviceId!==selected||state.refreshErrors?.[channel])continue;
      const age=this.now()-reading.receivedAt;
      if(age<0||age>=(kind==='heart_rate'?15000:30000))continue;
      if(!Number.isSafeInteger(reading.value)||reading.value<0||reading.value>(kind==='steps'?200000:300)||kind==='heart_rate'&&reading.value===0){
        this.publish({error:'A watch value is outside the supported storage range.'});continue;
      }
      const previous=this.sampled[kind];
      if(previous!==undefined&&reading.receivedAt-previous<30000)continue;
      this.sampled[kind]=reading.receivedAt;
      if(this.queue.length>=60){this.queue.shift();this.publish({discarded:this.state.discarded+1});}
      this.queue.push({id:crypto.randomUUID(),kind,value:reading.value,unit:kind==='steps'?'steps':'bpm',measuredAt:new Date(reading.receivedAt).toISOString(),timestampSource:'phone_received'});
    }
    if(this.queue.length)void this.flush();
  }

  async retry(){this.failures=0;this.nextRetryAt=0;await this.flush();}

  async syncHistory(owner:string,scope:string,history:WatchHistoryRepository,active:()=>boolean=()=>true){
    if(!active()||owner!==this.owner||!this.adapter||this.uploading||this.failures>=3||this.now()<this.nextRetryAt)return;
    const generation=this.generation,adapter=this.adapter,permissions=[...this.permissions];
    this.uploading=true;
    try{
      while(active()&&generation===this.generation){
        const page=await history.read(scope,{pendingKinds:permissions,limit:60});
        if(!active()||generation!==this.generation)return;
        if(!page.records.length)return;
        const batch:WatchObservation[]=page.records.map(record=>{
          if(!permissions.includes(record.kind)||!/^sb-local:[a-f0-9-]{36}$/.test(record.id)||
             !Number.isSafeInteger(record.value)||record.value<0||record.value>(record.kind==='heart_rate'?300:200000)||
             record.kind==='heart_rate'&&record.value===0||!Number.isFinite(record.receivedAt)||record.receivedAt<=0||record.receivedAt>this.now()+1000)
            throw Error('Invalid saved watch observation; no history was uploaded.');
          return {id:record.id,kind:record.kind,value:record.value,unit:record.kind==='heart_rate'?'bpm':'steps',
            measuredAt:new Date(record.receivedAt).toISOString(),timestampSource:'phone_received'};
        });
        this.controller=new AbortController();
        const controller=this.controller,timeout=setTimeout(()=>controller.abort(),15000);
        this.publish({phase:'pending',error:undefined});
        try{
          const result=await this.transport.upload(owner,adapter.token,batch,controller.signal);
          if(generation!==this.generation)return;
          if(!result.ok||!Number.isSafeInteger(result.received)||result.received<0||result.received>batch.length)
            throw Error('The server did not confirm the history upload.');
          await history.markUploaded(scope,batch.map(record=>record.id));
          if(generation!==this.generation)return;
          this.failures=0;this.nextRetryAt=0;
          this.publish({phase:'saved',lastSavedAt:this.now()});
        }finally{clearTimeout(timeout);}
      }
    }catch(error){
      if(generation===this.generation){
        this.failures++;this.nextRetryAt=this.now()+1000*2**this.failures;
        this.publish({phase:'error',error:error instanceof Error?error.message:'Could not upload on-phone watch history.'});
      }
    }finally{if(generation===this.generation)this.uploading=false;}
  }

  private async flush(){
    if(this.uploading||!this.adapter||!this.queue.length||this.failures>=3||this.now()<this.nextRetryAt)return;
    const generation=this.generation,adapter=this.adapter,owner=this.owner;
    this.uploading=true;
    const expired=this.queue.filter(reading=>this.now()-Date.parse(reading.measuredAt)>300000).length;
    this.queue=this.queue.filter(reading=>this.now()-Date.parse(reading.measuredAt)<=300000);
    this.publish({discarded:this.state.discarded+expired});
    if(!this.queue.length){this.uploading=false;this.publish({phase:'ready'});return;}
    const batch=this.queue.slice(0,60);
    this.controller=new AbortController();
    const controller=this.controller,timeout=setTimeout(()=>controller.abort(),15000);
    this.publish({phase:'pending',error:undefined});
    try{
      const result=await this.transport.upload(owner,adapter.token,batch,controller.signal);
      if(generation!==this.generation)return;
      if(!result.ok||!Number.isSafeInteger(result.received)||result.received<0||result.received>batch.length)throw Error('The server did not confirm the upload');
      const saved=new Set(batch.map(reading=>reading.id));this.queue=this.queue.filter(reading=>!saved.has(reading.id));
      this.failures=0;this.nextRetryAt=0;this.publish({phase:this.queue.length?'pending':'saved',lastSavedAt:this.now()});
    }catch(error){
      if(generation===this.generation){this.failures++;this.nextRetryAt=this.now()+1000*2**this.failures;this.publish({phase:'error',error:error instanceof Error?error.message:'Watch sync failed'});}
    }finally{clearTimeout(timeout);if(generation===this.generation)this.uploading=false;}
  }

  stop(){
    const adapter=this.adapter,owner=this.owner;
    ++this.generation;this.controller?.abort();this.controller=undefined;this.adapter=undefined;
    this.owner='';this.permissions=[];this.queue=[];this.sampled={};this.deviceId=undefined;this.uploading=false;this.failures=0;this.nextRetryAt=0;
    this.state={phase:'off',pending:0,discarded:0};this.publish({});
    if(adapter)void this.transport.revoke(owner,adapter.id).catch(()=>{});
  }
}