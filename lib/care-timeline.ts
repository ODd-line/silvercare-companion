export type TimelineFilter='all'|'heart'|'steps'|'notes';
export type TimelineNote={id:string;kind:string;occurred_at:number;data:Record<string,unknown>;version?:number};
export type TimelineReading={id:string;kind:string;value:number;unit:string;measured_at:number;device_id?:string;device_name?:string;timestamp_source?:string;demo?:boolean};
export type TimelineEntry=
 | {type:'note';key:string;time:number|null;note:TimelineNote}
 | {type:'readings';key:string;time:number|null;readings:TimelineReading[]};
export type TimelineDay={date:string;entries:TimelineEntry[];readings:TimelineReading[];noteCount:number};

export function validTimelineTime(value:number){return Number.isFinite(value)&&value>0&&Number.isFinite(new Date(value*1000).getTime());}
export function localDayKey(time:number):string{
 if(!validTimelineTime(time))return '';
 const date=new Date(time*1000);
 return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function localDayBounds(key:string):[number,number]|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(key))return null;
 const [year,month,day]=key.split('-').map(Number);
 const start=new Date(year,month-1,day),end=new Date(year,month-1,day+1);
 if(localDayKey(start.getTime()/1000)!==key)return null;
 return [start.getTime()/1000,end.getTime()/1000];
}
export function chartableHeartReading(reading:TimelineReading){
 return validTimelineTime(reading.measured_at)&&reading.kind==='heart_rate'&&reading.unit==='bpm'&&Number.isFinite(reading.value)&&reading.value>0&&reading.value<=400&&(reading.timestamp_source!=='phone_received'||Number.isSafeInteger(reading.value));
}

export function buildTimeline(notes:TimelineNote[],readings:TimelineReading[],filter:TimelineFilter='all',date=''):TimelineDay[]{
 const entries:TimelineEntry[]=[];
 if(filter==='all'||filter==='notes')for(const note of notes)entries.push({type:'note',key:'note:'+note.id,time:validTimelineTime(note.occurred_at)?note.occurred_at:null,note});
 const groups=new Map<string,Extract<TimelineEntry,{type:'readings'}>>();
 for(const reading of readings){
  if(filter==='notes'||filter==='heart'&&reading.kind!=='heart_rate'||filter==='steps'&&reading.kind!=='steps')continue;
  const time=validTimelineTime(reading.measured_at)?reading.measured_at:null;
  // A friendly name is not device identity. Keep unidentified and undated readings separate.
  const identity=time!==null&&reading.device_id?JSON.stringify([time,reading.device_id,reading.timestamp_source??'unknown',!!reading.demo]):JSON.stringify(['single',reading.id]);
  let entry=groups.get(identity);
  if(!entry){entry={type:'readings',key:'readings:'+identity,time,readings:[]};groups.set(identity,entry);entries.push(entry);}
  entry.readings.push(reading);
 }
 entries.sort((a,b)=>(b.time??-Infinity)-(a.time??-Infinity)||a.key.localeCompare(b.key));
 const days=new Map<string,TimelineDay>();
 for(const entry of entries){
  const key=entry.time===null?'':localDayKey(entry.time);
  if(date&&key!==date)continue;
  let day=days.get(key);
  if(!day){day={date:key,entries:[],readings:[],noteCount:0};days.set(key,day);}
  day.entries.push(entry);
  if(entry.type==='note')day.noteCount++;else day.readings.push(...entry.readings);
 }
 return [...days.values()].sort((a,b)=>b.date.localeCompare(a.date));
}
