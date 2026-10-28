'use client';
import {useId,useState} from 'react';
import {CalendarDays,ChevronDown,Heart,Footprints,NotebookPen,List,Plus,Pencil,Trash2,X} from 'lucide-react';
import {Button} from './ui/button';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import {CareInfo} from './care-info';
import {tr,useLanguage,getLanguage} from '@/lib/i18n';
import {buildTimeline,chartableHeartReading,localDayBounds,localDayKey,type TimelineDay,type TimelineEntry,type TimelineFilter,type TimelineNote,type TimelineReading} from '@/lib/care-timeline';

const timeText=(time:number|null)=>time===null?tr('Time unavailable'):new Date(time*1000).toLocaleTimeString(getLanguage(),{hour:'2-digit',minute:'2-digit'});
const dateText=(key:string)=>{const bounds=localDayBounds(key);return bounds?new Date(bounds[0]*1000).toLocaleDateString(getLanguage(),{day:'numeric',month:'short',year:'numeric'}):tr('Date unavailable');};
const sourceText=(source?:string)=>tr(source==='phone_received'?'Phone receipt time':source==='sensor'?'Sensor-reported time':'Timestamp source unspecified');
const readingName=(kind:string)=>tr(({heart_rate:'Heart rate',steps:'Step counter',activity_minutes:'Activity duration'} as Record<string,string>)[kind]??kind.replaceAll('_',' '));
const readingValue=(reading:TimelineReading)=>Number.isFinite(reading.value)?reading.value.toLocaleString(getLanguage()):tr('Unavailable');
const countText=(readings:number,notes:number)=>[readings?tr(readings===1?'{count} reading':'{count} readings',{count:readings}):'',notes?tr(notes===1?'{count} note':'{count} notes',{count:notes}):''].filter(Boolean).join(' · ');

function DayGraph({day}:{day:TimelineDay}){
 const titleId=useId(),descriptionId=useId();
 const points=day.readings.filter(chartableHeartReading),bounds=localDayBounds(day.date);
 if(!points.length||!bounds)return null;
 const max=Math.max(100,Math.ceil(Math.max(...points.map(point=>point.value))/25)*25);
 const average=points.reduce((sum,point)=>sum+point.value,0)/points.length;
 return <div className="timeline-daily-chart">
  <div className="timeline-daily-stat"><span>{tr('Avg saved heart rate')}</span><strong>{Math.round(average)} <small>bpm</small></strong></div>
  <svg viewBox="0 0 320 96" role="img" aria-labelledby={titleId} aria-describedby={descriptionId}>
   <title id={titleId}>{tr('Heart rate on {date}',{date:dateText(day.date)})}</title>
   <desc id={descriptionId}>{tr('{count} saved readings. Dots show observations; gaps mean no data. Exact values are in the entries below.',{count:points.length})}</desc>
   <line x1="26" x2="302" y1="68" y2="68" stroke="#cdd9df"/>
   <line x1="26" x2="302" y1="12" y2="12" stroke="#e0e7eb" strokeDasharray="3 4"/>
   <text x="20" y="16" textAnchor="end">{max}</text><text x="20" y="72" textAnchor="end">0</text>
   {points.map(point=><circle key={point.id} cx={26+(point.measured_at-bounds[0])/(bounds[1]-bounds[0])*276} cy={68-point.value/max*56} r="3.5" fill="#a64456"><title>{timeText(point.measured_at)} · {readingValue(point)} bpm</title></circle>)}
   <text x="26" y="89">00:00</text><text x="164" y="89" textAnchor="middle">{new Date((bounds[0]+bounds[1])*500).toLocaleTimeString(getLanguage(),{hour:'2-digit',minute:'2-digit',hour12:false})}</text><text x="302" y="89" textAnchor="end">24:00</text>
  </svg>
  <p>{tr('Saved observations · gaps mean no data')}</p>
 </div>;
}

function ReadingEntry({entry}:{entry:Extract<TimelineEntry,{type:'readings'}>}){
 const first=entry.readings[0];
 return <article className="timeline-reading-entry" aria-label={tr('Watch readings at {time}',{time:timeText(entry.time)})}>
  <div className="timeline-entry-heading"><time dateTime={entry.time===null?undefined:new Date(entry.time*1000).toISOString()}>{timeText(entry.time)}</time><CareInfo title={tr('Reading details')}>
   <p>{first.device_name||tr('Unnamed device')}</p><p>{sourceText(first.timestamp_source)}{entry.time!==null&&<> · {new Date(entry.time*1000).toLocaleString(getLanguage(),{dateStyle:'medium',timeStyle:'medium'})}</>}</p>
   {entry.readings.map(reading=><p key={reading.id}>{readingName(reading.kind)}: {readingValue(reading)} {reading.unit}{reading.demo&&<> · {tr('Sample data')}</>}</p>)}
   <p>{tr('Readings are shown as received, not medically verified.')}</p>
  </CareInfo></div>
  <div className="timeline-values">{entry.readings.map(reading=>{const Icon=reading.kind==='heart_rate'?Heart:reading.kind==='steps'?Footprints:List;return <span key={reading.id} aria-label={`${readingName(reading.kind)}: ${readingValue(reading)} ${reading.unit}`}><Icon size={20} aria-hidden="true"/><strong>{readingValue(reading)}</strong><small>{reading.kind==='steps'?tr('steps'):reading.unit}</small></span>;})}</div>
  {entry.readings.some(reading=>reading.kind==='steps')&&<p className="timeline-counter-note">{tr('Counter, not daily total.')}</p>}
 </article>;
}

function NoteEntry({entry,labels,busy,onEdit,onDelete}:{entry:Extract<TimelineEntry,{type:'note'}>;labels:Record<string,string>;busy:boolean;onEdit:(note:TimelineNote)=>void;onDelete:(note:TimelineNote)=>Promise<unknown>}){
 const [expanded,setExpanded]=useState(false),[confirm,setConfirm]=useState(false);
 const detailsId=useId(),note=entry.note;
 const preview=String(note.data.description||note.data.feeling||note.data.notes||tr('Wellbeing check-in'));
 return <article className="care-record timeline-note-entry">
  <div className="timeline-entry-heading"><span><NotebookPen size={18} aria-hidden="true"/>{tr(note.kind==='symptom'?'Note':'Check-in')}</span><time dateTime={entry.time===null?undefined:new Date(entry.time*1000).toISOString()}>{timeText(entry.time)}</time></div>
  {!expanded&&<p className="timeline-note-preview">{preview}</p>}
  <div id={detailsId} hidden={!expanded}>{expanded&&<dl>{Object.entries(note.data).filter(([,value])=>value!==''&&value!==null&&value!==undefined).map(([key,value])=><div key={key}><dt>{tr(labels[key]||key)}</dt><dd>{String(value)}</dd></div>)}</dl>}</div>
  <div className="care-actions timeline-note-actions"><Button variant="ghost" aria-expanded={expanded} aria-controls={detailsId} onClick={()=>setExpanded(!expanded)}>{tr(expanded?'Hide note':'View note')}</Button><Button variant="ghost" aria-label={tr('Edit record')} disabled={busy} onClick={()=>onEdit(note)}><Pencil className="size-4" aria-hidden="true"/>{tr('Edit')}</Button><Button variant="ghost" aria-label={tr('Delete record')} disabled={busy} onClick={()=>setConfirm(!confirm)}><Trash2 className="size-4" aria-hidden="true"/>{tr('Delete')}</Button></div>
  {confirm&&<div className="timeline-delete-confirm" role="group" aria-label={tr('Confirm record deletion')}><p>{tr('This removes this record. Previously shared summary copies are managed separately.')}</p><div className="care-actions"><Button variant="outline" disabled={busy} onClick={()=>void onDelete(note)}>{tr('Confirm deletion')}</Button><Button variant="ghost" disabled={busy} onClick={()=>setConfirm(false)}>{tr('Cancel')}</Button></div></div>}
 </article>;
}

function DaySection({day,initiallyOpen,labels,busy,onEdit,onDelete}:{day:TimelineDay;initiallyOpen:boolean;labels:Record<string,string>;busy:boolean;onEdit:(note:TimelineNote)=>void;onDelete:(note:TimelineNote)=>Promise<unknown>}){
 const [open,setOpen]=useState(initiallyOpen);
 const today=localDayKey(Date.now()/1000),yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
 const relative=day.date===today?tr('Today'):day.date===localDayKey(yesterday.getTime()/1000)?tr('Yesterday'):'';
 return <details className="timeline-day" data-date={day.date} open={open} onToggle={event=>setOpen(event.currentTarget.open)}>
  <summary><span><strong>{relative||dateText(day.date)}</strong>{relative&&<span>{dateText(day.date)}</span>}<small>{countText(day.readings.length,day.noteCount)}</small></span><ChevronDown size={20} aria-hidden="true"/></summary>
  {open&&<div className="timeline-day-body"><DayGraph day={day}/><div className="timeline-entries">{day.entries.map(entry=>entry.type==='note'?<NoteEntry key={entry.key} entry={entry} labels={labels} busy={busy} onEdit={onEdit} onDelete={onDelete}/>:<ReadingEntry key={entry.key} entry={entry}/>)}</div></div>}
 </details>;
}

export function CareTimeline({records,measurements,labels,busy,onAdd,onEdit,onDelete}:{records:TimelineNote[];measurements:TimelineReading[];labels:Record<string,string>;busy:boolean;onAdd:()=>void;onEdit:(note:TimelineNote)=>void;onDelete:(note:TimelineNote)=>Promise<unknown>}){
 useLanguage();
 const [filter,setFilter]=useState<TimelineFilter>('all'),[date,setDate]=useState(''),[draftDate,setDraftDate]=useState(''),[calendarOpen,setCalendarOpen]=useState(false),[limit,setLimit]=useState(7);
 const days=buildTimeline(records,measurements,filter,date);
 const initiallyOpenDate=days.find(day=>day.date===localDayKey(Date.now()/1000))?.date??days[0]?.date;
 const dateId=useId();
 const reset=()=>{setFilter('all');setDate('');setLimit(7);};
 return <section className="care-timeline" aria-label={tr('Saved history')}>
  <div className="timeline-toolbar"><Button onClick={onAdd}><Plus className="size-5" aria-hidden="true"/>{tr('Add record')}</Button><div className="timeline-date-tools"><Popover open={calendarOpen} onOpenChange={open=>{setCalendarOpen(open);if(open)setDraftDate(date);}}><PopoverTrigger asChild><Button variant="outline" aria-label={tr('Choose date')}><CalendarDays className="size-5" aria-hidden="true"/>{date?dateText(date):tr('Date')}</Button></PopoverTrigger><PopoverContent className="timeline-calendar" align="end" collisionPadding={16} aria-label={tr('Choose date')}><form onSubmit={event=>{event.preventDefault();if(localDayBounds(draftDate)){setDate(draftDate);setLimit(7);setCalendarOpen(false);}}}><label htmlFor={dateId}>{tr('Choose date')}</label><input id={dateId} type="date" value={draftDate} required onChange={event=>setDraftDate(event.target.value)}/><div className="timeline-calendar-actions"><Button type="submit" disabled={!localDayBounds(draftDate)}>{tr('View date')}</Button><Button type="button" variant="ghost" onClick={()=>setCalendarOpen(false)}>{tr('Cancel')}</Button></div></form></PopoverContent></Popover>{date&&<Button className="care-info-button" size="icon" variant="ghost" aria-label={tr('Clear date')} onClick={()=>{setDate('');setLimit(7);}}><X className="size-5" aria-hidden="true"/></Button>}</div></div>
  <div className="timeline-filters" role="group" aria-label={tr('Filter timeline')}>{([['all','All',List],['heart','Heart',Heart],['steps','Steps',Footprints],['notes','Notes',NotebookPen]] as const).map(([id,label,Icon])=><button key={id} type="button" aria-pressed={filter===id} onClick={()=>{setFilter(id);setLimit(7);}}><Icon size={18} aria-hidden="true"/><span>{tr(label)}</span></button>)}</div>
  {measurements.some(reading=>reading.demo)&&filter!=='notes'&&<p className="timeline-sample" role="status">{tr('Sample watch readings, not received from a real watch.')}</p>}
  {days.length?<div key={filter+date}>{days.slice(0,limit).map(day=><DaySection key={day.date} day={day} initiallyOpen={day.date===initiallyOpenDate} labels={labels} busy={busy} onEdit={onEdit} onDelete={onDelete}/>)}</div>:<div className="care-empty" role="status"><p>{tr(date?'No saved entries for this date in the loaded history.':filter==='all'?'No saved history yet.':'No entries match this filter.')}</p>{(date||filter!=='all')&&<Button variant="outline" onClick={reset}>{tr('Show all history')}</Button>}</div>}
  {days.length>limit&&<Button variant="outline" className="timeline-more" onClick={()=>setLimit(limit+7)}>{tr('More days')}</Button>}
  <p className="care-muted timeline-limit">{tr('Showing recent saved history')}</p>
 </section>;
}
