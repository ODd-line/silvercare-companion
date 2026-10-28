'use client';

import {useState} from 'react';
import {usePreferences} from './preferences';
import {Activity,Footprints,RefreshCw} from 'lucide-react';
import {ResponsiveContainer,ScatterChart,Scatter,XAxis,YAxis,CartesianGrid,Tooltip} from 'recharts';
import {Button} from './ui/button';
import {CareInfo} from './care-info';
import {tr,useLanguage} from '@/lib/i18n';

type Reading={id:string;kind:string;value:number;unit:string;measured_at:number;timestamp_source?:string;device_name:string;demo?:boolean};
const timeLabel=(time:number)=>new Date(time*1000).toLocaleString(undefined,{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'});
const provenance=(source?:string)=>source==='phone_received'?'Phone receipt time':source==='sensor'?'Sensor-reported time':'Timestamp source unspecified';

export function WatchHistory({measurements,onRefresh,title='Watch history',allowAllTime=false,emptyMessage,compact=false}:{measurements:Reading[];onRefresh:()=>Promise<void>;title?:string;allowAllTime?:boolean;emptyMessage?:string;compact?:boolean}){
 useLanguage();
 const preferences=usePreferences();
 const range=preferences.value.historyDays===0&&!allowAllTime?7:preferences.value.historyDays;
 const setRange=(days:0|1|7)=>preferences.store.update('historyDays',days);
 const now=Date.now()/1000;
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const valid=measurements.filter(reading=>Number.isFinite(reading.measured_at)&&reading.measured_at>0&&reading.measured_at<=now&&Number.isFinite(reading.value)&&(reading.timestamp_source!=='phone_received'||Number.isSafeInteger(reading.value))&&((reading.kind==='heart_rate'&&reading.unit==='bpm'&&reading.value>0&&reading.value<=400)||(reading.kind==='steps'&&reading.unit==='steps'&&reading.value>=0&&reading.value<=200000)));
 const start=range===0?Math.min(now-1,...valid.map(reading=>reading.measured_at)):now-range*86400;
 const readings=valid.filter(reading=>reading.measured_at>=start).sort((first,second)=>first.measured_at-second.measured_at);
 const ticks=Array.from({length:5},(_,index)=>start+index*(now-start)/4);
 const refresh=async()=>{setRefreshing(true);setError('');try{await onRefresh()}catch{setError('Could not refresh readings. Previously loaded observations are still shown. Please try again.')}finally{setRefreshing(false)}};
 return <section className="care-watch-history" aria-label="Saved watch readings">
  <div className="care-history-heading"><h2>{title}</h2><div className="care-history-tools">{compact&&<CareInfo title={title}><p>Saved readings, not continuous monitoring. Gaps mean no data. Times are local.</p><p>Choose a time range, or refresh to load saved readings. Exact values and their sources are in the readings table.</p></CareInfo>}<Button variant="outline" className={compact?'care-info-button':undefined} aria-label="Refresh readings" title="Refresh readings" aria-busy={refreshing} disabled={refreshing} onClick={refresh}><RefreshCw className="size-5" aria-hidden="true"/>{!compact&&'Refresh readings'}</Button></div></div>
  {error&&<p role="alert">{error}</p>}
  {measurements.some(reading=>reading.demo)&&<p className="care-history-demo" role="status">Sample watch readings, not received from a real watch.</p>}
  <div className="care-history-range" role="group" aria-label="Reading time range">{(allowAllTime?[1,7,0] as const:[1,7] as const).map(days=><button key={days} type="button" aria-label={days===0?'All dates (this page)':days===1?'Last 24 hours':'Last 7 days'} aria-pressed={range===days} onClick={()=>setRange(days)}>{compact?(days===0?'All dates':days===1?'24 hours':'7 days'):(days===0?'All dates (this page)':days===1?'Last 24 hours':'Last 7 days')}</button>)}</div>
  {!compact&&<p className="care-muted">Saved readings, not continuous monitoring. Gaps mean no data. Times are local.</p>}
  {compact&&<div className="care-saved-summary" role="group" aria-label={tr('Latest saved readings')}>{(['heart_rate','steps'] as const).map(kind=>{
   const latest=readings.filter(reading=>reading.kind===kind).at(-1),heart=kind==='heart_rate';
   return <section key={kind} className="care-reading-card"><h3>{tr(heart?'Heart rate':'Step counter')}</h3><span className="care-muted">{tr('Saved reading')}</span><p className="care-history-value">{latest?latest.value.toLocaleString():'—'} <span>{latest?(heart?'bpm':tr('steps')):''}</span></p>{latest?<time className="care-summary-time" dateTime={new Date(latest.measured_at*1000).toISOString()}>{timeLabel(latest.measured_at)}</time>:<p className="care-muted">{tr('No saved reading')}</p>}{!heart&&<p className="care-summary-note">{tr('Counter, not daily total.')}</p>}</section>;
  })}</div>}
  <div className="care-history-plots">{(['heart_rate','steps'] as const).map(kind=>{
   const points=readings.filter(reading=>reading.kind===kind),latest=points.at(-1),isHeart=kind==='heart_rate',title=isHeart?'Heart rate':'Step counter',unit=isHeart?'bpm':'steps',Icon=isHeart?Activity:Footprints;
   return <section key={kind} className="care-history-metric" aria-label={title+' history'}>
    <div className="care-section-heading"><h3><Icon size={20}/>{title}</h3>{compact&&<CareInfo title={title}><p>{isHeart?'Heart rate is measured in beats per minute (bpm). Saved watch readings are not a medical assessment.':'Counter readings, not daily totals. Counts may reset.'}</p>{latest&&<p>Latest saved: {timeLabel(latest.measured_at)} · {provenance(latest.timestamp_source)} · {latest.device_name}</p>}</CareInfo>}</div>
    {latest?compact?<p className="care-muted">{tr(points.length===1?'{count} reading':'{count} readings',{count:points.length})}</p>:<><p className="care-history-value">{latest.value.toLocaleString()} <span>{unit}</span></p><p className="care-muted">Latest saved: {timeLabel(latest.measured_at)} · {provenance(latest.timestamp_source)} · {latest.device_name}</p><p>{points.length} saved observations</p></>:<p className="care-empty">No saved {isHeart?'heart-rate':'step-counter'} readings in this period.</p>}
    {points.length>0&&<div className="care-history-chart" role="img" aria-label={`${title}: ${points.length} saved observations. Exact values are available in the readings table.`}>
    <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{width:1,height:240}}><ScatterChart margin={{top:12,right:12,bottom:12,left:0}} accessibilityLayer>
      <CartesianGrid stroke="#d9e1e5" strokeDasharray="3 3"/>
      <XAxis type="number" dataKey="measured_at" domain={[start,now]} ticks={ticks} tickFormatter={time=>new Date(time*1000).toLocaleString(undefined,range===1?{hour:'2-digit',minute:'2-digit'}:{month:'short',day:'numeric'})} tick={{fontSize:11}} minTickGap={24}/>
      <YAxis type="number" dataKey="value" width={48} domain={[0,'auto']} allowDecimals={false} tick={{fontSize:11}}/>
      <Tooltip cursor={{strokeDasharray:'3 3'}} content={({active,payload})=>{const reading=payload?.[0]?.payload as Reading|undefined;return active&&reading?<div className="care-history-tooltip"><strong>{reading.value.toLocaleString()} {unit}</strong><span>{timeLabel(reading.measured_at)}</span><span>{reading.device_name}</span><span>{provenance(reading.timestamp_source)}</span></div>:null}}/>
      <Scatter name={title} data={points} fill={isHeart?'#b64759':'#287b60'} isAnimationActive={false}/>
     </ScatterChart></ResponsiveContainer>
    </div>}
    {!isHeart&&!compact&&<p className="care-muted">Counter readings, not daily totals. Counts may reset.</p>}
   </section>;
  })}</div>
  {!readings.length&&<p>{emptyMessage??'Enable saving in My Watch to keep readings. Connecting alone does not save them.'}</p>}
  {readings.length>0&&<details className="care-history-table"><summary>Saved readings table ({readings.length})</summary><div className="care-history-table-scroll"><table><caption>Observations in the selected period</caption><thead><tr><th scope="col">Time</th><th scope="col">Reading</th><th scope="col">Source</th></tr></thead><tbody>{[...readings].reverse().map(reading=><tr key={reading.id}><td><time dateTime={new Date(reading.measured_at*1000).toISOString()}>{timeLabel(reading.measured_at)}</time></td><td>{reading.kind==='heart_rate'?'Heart rate':'Step counter'}: {reading.value.toLocaleString()} {reading.unit}</td><td>{reading.device_name}<br/>{provenance(reading.timestamp_source)}</td></tr>)}</tbody></table></div></details>}
 </section>;
}
