import {z} from 'zod';

export const rememberedPages=['home','tasks','bank','profile','notifications','talents','programs','verification','admin','care/overview','care/health','care/record','care/timeline','care/watch','care/appointments','care/family','care/settings','partner/overview','partner/needs','partner/programs','partner/training','partner/tasks','partner/support','partner/participants','partner/insights','partner/organization'] as const;
const watchSchema=z.object({
 receive:z.boolean().default(false),
 autoMeasure:z.boolean().default(false),
 backgroundHistory:z.boolean().default(false),
 device:z.object({deviceId:z.string().min(1).max(200),name:z.string().max(200).optional()}).strict().optional(),
 goal:z.string().max(20).default(''),
 saveConsent:z.boolean().default(false),
 steps:z.boolean().default(false),
 heartRate:z.boolean().default(false),
 saveEnabled:z.boolean().default(false),
}).strict();
export const preferenceSchema=z.object({
 page:z.enum(rememberedPages).default('home'),
 taskView:z.enum(['available','recommended','requested','helping']).default('available'),
 taskFilters:z.object({category:z.string().max(100).default(''),mode:z.enum(['','remote','in_person']).default(''),maxMinutes:z.string().max(10).default(''),date:z.string().max(10).default(''),location:z.string().max(200).default('')}).strict().default({}),
 homeSearch:z.string().max(500).default(''),
 historyDays:z.union([z.literal(0),z.literal(1),z.literal(7)]).default(1),
 voiceEnabled:z.boolean().default(true),
 voiceLanguage:z.enum(['en-US','zh-HK','zh-CN']).default('en-US'),
 partnerOrganization:z.string().max(100).default(''),
 verificationOrganization:z.string().max(100).default(''),
 adminTab:z.enum(['tasks','users','ledger','rules','audit']).default('tasks'),
 watch:watchSchema.default({}),
}).strict();
export type Preferences=z.infer<typeof preferenceSchema>;
export type WatchPreferences=Preferences['watch'];
type StorageAccess=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export type PreferenceSnapshot={value:Preferences;error:string};
const defaults=():Preferences=>preferenceSchema.parse({});
const envelope=z.object({version:z.literal(1),options:preferenceSchema}).strict();

export class PreferenceStore{
 private readonly key:string|null;
 private readonly storage?:StorageAccess;
 private snapshot:PreferenceSnapshot={value:defaults(),error:''};
 private readonly initial:PreferenceSnapshot={value:defaults(),error:''};
 private readonly listeners=new Set<()=>void>();
 constructor(key:string|null,storage?:StorageAccess,loadError=''){
  this.key=key;this.storage=storage;
  if(loadError){this.snapshot={value:defaults(),error:loadError};return;}
  if(!key||!storage)return;
  try{
   const raw=storage.getItem(key);
   if(raw!==null){
    if(raw.length>32000)throw Error('Saved options are too large');
    const parsed=envelope.safeParse(JSON.parse(raw));
    if(!parsed.success)throw Error('Saved options have an unsupported format');
    this.snapshot={value:parsed.data.options,error:''};
   }
  }catch{this.snapshot={value:defaults(),error:'Could not read saved options. Automatic watch activity is off. Use Reset saved options to repair this device’s preferences.'};}
 }
 subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener)};};
 getSnapshot=()=>this.snapshot;
 getServerSnapshot=()=>this.initial;
 private publish(snapshot:PreferenceSnapshot){this.snapshot=snapshot;this.listeners.forEach(listener=>listener());}
 update<K extends keyof Preferences>(name:K,value:Preferences[K]){
  const parsed=preferenceSchema.safeParse({...this.snapshot.value,[name]:value});
  if(!parsed.success){this.publish({...this.snapshot,error:'This option could not be saved because its value is invalid.'});return false;}
  let error='';
  if(this.key&&this.storage){
   try{this.storage.setItem(this.key,JSON.stringify({version:1,options:parsed.data}));}
   catch{error='Could not save options on this device. Changes apply only now; older permissions may return after restart. Keep Bluetooth off if you cannot save a permission change.';}
  }else if(this.key){error='Device storage is unavailable. Options cannot be remembered across restarts.';}
  this.publish({value:parsed.data,error});
  return !error;
 }
 updateWatch=(change:Partial<WatchPreferences>)=>this.update('watch',{...this.snapshot.value.watch,...change});
 reset=()=>{
  try{if(this.key){if(!this.storage)throw Error('Storage unavailable');this.storage.removeItem(this.key);}}
  catch{this.publish({value:defaults(),error:'Could not reset saved options. Automatic watch activity is stopped for now, but older permissions may return after restart. Keep Bluetooth off until the reset succeeds.'});return false;}
  this.publish({value:defaults(),error:''});return true;
 };
}

export function preferenceKey(server:string,owner:string){return 'silverbank-options:v1:'+JSON.stringify([server,owner]);}
export function taskFilterQuery(filters:Preferences['taskFilters']){
 const entries=Object.entries(filters).filter(([,value])=>value);
 return entries.length?'&'+new URLSearchParams(entries).toString():'';
}
