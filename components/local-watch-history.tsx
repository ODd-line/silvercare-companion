'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {WatchHistoryRepository,LocalWatchPage} from '../lib/watch-history-native';
import type {PreferenceStore} from '../lib/preferences';
import {PreferenceProvider} from './preferences';
import {WatchHistory} from './watch-history';
import {Button} from './ui/button';
import {CareInfo} from './care-info';

export function LocalWatchHistory({repository,scope,preferences}:{repository:WatchHistoryRepository;scope:string;preferences:PreferenceStore}){
  const [page,setPage]=useState<LocalWatchPage>({records:[],total:0,pending:0});
  const [error,setError]=useState(''),[busy,setBusy]=useState(true),[before,setBefore]=useState<number>();
  const [confirmDelete,setConfirmDelete]=useState(false);
  const generation=useRef(0);
  const alive=useRef(true);
  const load=useCallback(async(cursor?:number)=>{
    const current=++generation.current;
    try{
      const next=await repository.read(scope,{before:cursor,limit:200});
      if(alive.current&&current===generation.current){setPage(next);setBefore(cursor);setError(next.error??'');}
    }catch(failure){
      if(alive.current&&current===generation.current)setError(failure instanceof Error?failure.message:'Could not load on-phone history.');
    }finally{if(alive.current&&current===generation.current)setBusy(false);}
  },[repository,scope]);
  useEffect(()=>{
    alive.current=true;
    const current=++generation.current;
    void repository.read(scope,{limit:200}).then(next=>{
      if(alive.current&&current===generation.current){setPage(next);setError(next.error??'');setBusy(false);}
    },failure=>{
      if(alive.current&&current===generation.current){setError(failure instanceof Error?failure.message:'Could not load on-phone history.');setBusy(false);}
    });
    const resume=()=>{if(!document.hidden)void load();};
    document.addEventListener('visibilitychange',resume);
    return()=>{alive.current=false;document.removeEventListener('visibilitychange',resume);};
  },[load,repository,scope]);
  const request=(cursor?:number)=>{setBusy(true);setError('');return load(cursor);};
  const remove=async()=>{
    setBusy(true);setError('');
    try{await repository.deleteAll(scope);setConfirmDelete(false);await load();}
    catch(failure){setError(failure instanceof Error?failure.message:'Could not delete on-phone history.');}
    finally{setBusy(false);}
  };
  const measurements=page.records.map(record=>({id:record.id,kind:record.kind,value:record.value,
    unit:record.kind==='heart_rate'?'bpm':'steps',measured_at:record.receivedAt/1000,
    timestamp_source:'phone_received',device_name:record.deviceName}));
  return <section aria-label="Private on-phone history">
    <p>{page.total.toLocaleString()} observations retained on this phone; {page.pending.toLocaleString()} awaiting upload permission or sync.</p>
    <div className="care-section-heading"><h3>Phone history</h3><CareInfo title="Phone history"><p>Showing up to 200 records. Choose Older records or All dates to see more.</p><p>History stays until you delete it and is separate for each account and server. Cloud uploads need separate permission.</p></CareInfo></div>
    {error&&<p role="alert" className="error">{error}</p>}
    <PreferenceProvider store={preferences}>
      <WatchHistory title="On-phone watch history" compact allowAllTime measurements={measurements} onRefresh={()=>request(before)}
        emptyMessage="No readings for this period on this page. Try All dates, or enable on-phone history."/>
    </PreferenceProvider>
    <div className="care-actions">
      <Button variant="outline" disabled={busy||before===undefined} onClick={()=>void request()}>Latest records</Button>
      <Button variant="outline" disabled={busy||page.records.length<200} onClick={()=>void request(page.records.at(-1)?.sequence)}>Older records</Button>
      <Button variant="outline" disabled={busy||!page.total} onClick={()=>setConfirmDelete(true)}>Delete on-phone history</Button>
    </div>
    {confirmDelete&&<div role="group" aria-label="Confirm local history deletion">
      <p>This deletes the current account history on this phone, not cloud copies. It does not stop future collection or uploads already in progress.</p>
      <Button disabled={busy} onClick={()=>void remove()}>Confirm delete on-phone history</Button>
      <Button variant="outline" disabled={busy} onClick={()=>setConfirmDelete(false)}>Cancel</Button>
    </div>}
  </section>;
}
