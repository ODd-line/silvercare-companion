'use client';
import {createContext,useContext,useEffect,useEffectEvent,useRef,useState,type ReactNode} from 'react';
import {Bluetooth,BluetoothConnected,Unplug,RefreshCw,Battery,Footprints,Heart,CloudUpload,ShieldCheck} from 'lucide-react';
import {apiOrigin,isNative} from '../lib/mobile-session';
import {watchBluetooth,watchHistoryScope} from '../lib/watch-history-native';
import {LocalWatchHistory} from './local-watch-history';
import {CareInfo} from './care-info';
import {PineTimeWatch,WATCH_READING_MAX_AGE,type Channel,type Reading,type WatchBluetooth,type WatchState} from '../lib/pinetime-watch';
import {WatchStorage,type StoredWatchKind,type WatchStorageState} from '../lib/watch-storage';
import {Button} from './ui/button';
import {PreferenceError,usePreferences} from './preferences';
import {tr} from '@/lib/i18n';

export function usePineTimeWatch(owner: string, bluetooth: WatchBluetooth = watchBluetooth, supported = isNative(), remember=true) {
  const preferences=usePreferences(remember?owner:null);
  const consent=preferences.value.watch.receive;
  const history=supported&&remember?bluetooth.history:undefined;
  const historyScope=watchHistoryScope(apiOrigin()||(typeof window!=='undefined'?window.location.origin:''),owner);
  const [snapshot,setSnapshot] = useState<{owner:string;state:WatchState}>({owner,state:{phase:'idle',readings:{}}});
  const state:WatchState=snapshot.owner===owner?snapshot.state:{phase:'idle',readings:{}};
  const [pending,setPending] = useState(false),[error,setError] = useState('');
  const alive = useRef(true),allowed = useRef(false),busy = useRef(false),connected = useRef(false),attempts = useRef(0);
  const current = useRef(state),activeOwner=useRef(owner);
  const [watch] = useState(() => new PineTimeWatch(bluetooth,next => {
    current.current = next;
    if (alive.current) setSnapshot({owner:activeOwner.current,state:next});
  }));
  const run = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;setPending(true);setError('');
    try {await action();} catch (failure) {
      if (alive.current && allowed.current) setError(failure instanceof Error ? failure.message : 'Bluetooth connection failed');
    } finally {busy.current = false;if (alive.current) setPending(false);}
  };
  useEffect(() => {
    let active=true;
    activeOwner.current=owner;
    alive.current = true;allowed.current = preferences.store.getSnapshot().value.watch.receive;connected.current = false;attempts.current = 0;
    setSnapshot({owner,state:{phase:'idle',readings:{}}});setError('');
    void watch.disconnect().then(()=>{
      const saved=preferences.store.getSnapshot().value.watch;
      if(active&&supported&&saved.receive&&saved.device&&!document.hidden){
        connected.current=true;
        void run(()=>watch.connect(true,saved.device));
      }
    });
    return () => {active=false;alive.current = false;allowed.current = false;void watch.disconnect();};
  },[owner,watch,supported,preferences.store]);
  useEffect(()=>{
    allowed.current=consent;
    if(!consent){connected.current=false;void watch.disconnect();}
  },[consent,watch]);
  useEffect(()=>{void watch.setAutomaticMeasurement(consent&&preferences.value.watch.autoMeasure);},[consent,preferences.value.watch.autoMeasure,watch]);
  useEffect(()=>{void watch.setBackgroundHistory(consent&&preferences.value.watch.autoMeasure&&preferences.value.watch.backgroundHistory&&history?historyScope:undefined);},[consent,preferences.value.watch.autoMeasure,preferences.value.watch.backgroundHistory,history,historyScope,watch]);
  useEffect(()=>{
    if(current.current.phase!=='connected'||state.phase!=='connected'||!state.device)return;
    const saved=preferences.store.getSnapshot().value.watch.device;
    if(saved?.deviceId!==state.device.deviceId||saved?.name!==state.device.name)preferences.store.updateWatch({device:state.device});
  },[state.phase,state.device,preferences.store]);
  useEffect(() => {
    if (state.phase === 'connected') {connected.current = true;attempts.current = 0;}
    if (!consent || !supported || !connected.current || document.hidden ||
        !['disconnected','error'].includes(state.phase) || attempts.current >= 3) return;
    const timer = setTimeout(() => {
      attempts.current++;
      void run(() => watch.connect(allowed.current,preferences.store.getSnapshot().value.watch.device));
    },1000 * 2 ** attempts.current);
    return () => clearTimeout(timer);
  },[state.phase,consent,supported,watch,preferences.store]);
  useEffect(() => {
    if (state.phase !== 'connected') return;
    const timer = setInterval(() => {if(!document.hidden)void watch.refresh();},15000);
    return () => clearInterval(timer);
  },[state.phase,watch]);
  useEffect(() => {
    let closing = Promise.resolve();
    const visibility = () => {
      if (document.hidden) {
        if(watch.canRunInBackground())watch.clearLiveReadings();
        else closing = watch.disconnect(false);
      } else if (allowed.current&&supported) {
        const saved=preferences.store.getSnapshot().value.watch;
        if(current.current.phase==='connected'){void watch.refresh();return;}
        if(!saved.device)return;
        void run(async () => {
          await closing;
          if (alive.current && allowed.current && !document.hidden) await watch.connect(true,saved.device);
        });
      }
    };
    document.addEventListener('visibilitychange',visibility);
    return () => document.removeEventListener('visibilitychange',visibility);
  },[watch,supported,preferences.store]);
  return {
    state,consent,pending,error,supported,owner,preferences,history,historyScope,
    allow(value: boolean) {
      allowed.current = value;
      preferences.store.updateWatch({receive:value,...(!value?{saveEnabled:false,saveConsent:false,autoMeasure:false,backgroundHistory:false}:{})});
      if (!value) {connected.current = false;setError('');void watch.disconnect();}
    },
    connect() {
      connected.current = false;attempts.current = 0;
      return run(async () => {if (!supported) throw Error('Installed mobile app required');await watch.connect(allowed.current);});
    },
    reconnect() {attempts.current = 0;return run(() => watch.connect(allowed.current,preferences.store.getSnapshot().value.watch.device));},
    disconnect() {allowed.current = false;connected.current = false;preferences.store.updateWatch({receive:false,saveEnabled:false,saveConsent:false,autoMeasure:false,backgroundHistory:false});setError('');return watch.disconnect();},
    retrySensing(){return run(()=>watch.retryAutomaticMeasurement());},
  };
}

type StorageApi=(path:string,body?:unknown,options?:{signal?:AbortSignal;deviceToken?:string})=>Promise<any>;

export function OfflineWatch({onBack}:{onBack:()=>void}){
  const watch=usePineTimeWatch('offline-bluetooth-session');
  return <div className="care-shell"><main className="care-main">
    <div className="care-heading"><h1>Watch without internet</h1><Button variant="outline" onClick={onBack}>Back to app</Button></div>
    <p role="status">No sign-in or internet needed. Live readings clear when you leave. Optional history stays on this phone until you delete it.</p>
    <PineTimeWatchPanel watch={watch} showStorage={false}/>
  </main></div>;
}

function useWatchStorage(watch:ReturnType<typeof usePineTimeWatch>,api:StorageApi|undefined,ready:boolean){
  const [state,setState]=useState<WatchStorageState>({phase:'off',pending:0,discarded:0});
  const choices=watch.preferences.value.watch;
  const current=useRef({api});current.current={api};
  const alive=useRef(true),attempted=useRef(false);
  const [retryVersion,setRetryVersion]=useState(0);
  const [storage]=useState(()=>new WatchStorage({
    async enroll(owner,name,permissions,signal){
      if(!current.current.api)throw Error('Private account storage is unavailable');
      return current.current.api('care/connect',{ownerId:owner,name,permissions},{signal});
    },
    async upload(owner,token,measurements,signal){
      if(!current.current.api)throw Error('Private account storage is unavailable');
      return current.current.api('care-device',{ownerId:owner,measurements},{signal,deviceToken:token});
    },
    async revoke(owner,id){await current.current.api?.('care/disconnect',{ownerId:owner,id});},
  },next=>{if(alive.current)setState(next);}));
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;storage.stop();};},[storage]);
  useEffect(()=>{
    storage.stop();attempted.current=false;
  },[watch.owner,watch.consent,ready,storage]);
  const available=ready&&!!api&&watch.supported&&watch.consent;
  const selected={consent:choices.saveConsent,steps:choices.steps,heartRate:choices.heartRate};
  const visible=selected.consent?state:{phase:'off' as const,pending:0,discarded:0};
  useEffect(()=>{
    if(!choices.saveEnabled||!choices.saveConsent){storage.stop();attempted.current=false;return;}
    if(!available||document.hidden||(!watch.history&&watch.state.phase!=='connected')||state.registered||state.phase==='enrolling'||attempted.current)return;
    const permissions:StoredWatchKind[]=[];if(choices.steps)permissions.push('steps');if(choices.heartRate)permissions.push('heart_rate');
    if(!permissions.length)return;
    attempted.current=true;
    void storage.start(watch.owner,watch.state.device?.name||'PineTime',permissions).catch(failure=>{
      if(alive.current)setState({phase:'error',pending:0,discarded:0,error:failure instanceof Error?failure.message:'Could not resume private watch storage'});
    });
  },[choices.saveEnabled,choices.saveConsent,choices.steps,choices.heartRate,available,watch.state.phase,watch.state.device?.name,watch.owner,watch.history,state.registered,state.phase,retryVersion,storage]);
  useEffect(()=>{
    const resume=()=>{if(!document.hidden){attempted.current=false;setRetryVersion(version=>version+1);void storage.retry();}};
    const visibility=()=>{if(document.hidden){storage.stop();attempted.current=false;}else resume();};
    window.addEventListener('online',resume);document.addEventListener('visibilitychange',visibility);
    return()=>{window.removeEventListener('online',resume);document.removeEventListener('visibilitychange',visibility);};
  },[storage]);
  useEffect(()=>{if(available&&selected.consent&&!document.hidden&&!(choices.backgroundHistory&&watch.history))storage.observe(watch.owner,watch.state);},[watch.owner,watch.state,available,selected.consent,choices.backgroundHistory,watch.history,state.registered,storage]);
  useEffect(()=>{
    const history=watch.history;
    if(!available||!selected.consent||!state.registered||!history)return;
    const sync=()=>{if(!document.hidden)void storage.syncHistory(watch.owner,watch.historyScope,history,()=>alive.current&&!document.hidden);};
    sync();const timer=setInterval(sync,15000);
    return()=>clearInterval(timer);
  },[available,selected.consent,state.registered,watch.history,watch.historyScope,watch.owner,retryVersion,storage]);
  return {state:visible,selected,available,
    choose(key:'consent'|'steps'|'heartRate',value:boolean){
      if(key==='consent'&&!value)storage.stop();
      watch.preferences.store.updateWatch(key==='consent'?{saveConsent:value,...(!value?{saveEnabled:false}:{})}:{[key]:value});
    },
    start(){
      if(!available||!selected.consent||(!watch.history&&watch.state.phase!=='connected'))return;
      attempted.current=false;watch.preferences.store.updateWatch({saveEnabled:true});setRetryVersion(version=>version+1);
    },
    stop(){storage.stop();watch.preferences.store.updateWatch({saveConsent:false,saveEnabled:false});},
    retry(){attempted.current=false;setRetryVersion(version=>version+1);void storage.retry();},
  };
}

const WatchSessionContext=createContext<{watch:ReturnType<typeof usePineTimeWatch>;storage:ReturnType<typeof useWatchStorage>}|null>(null);
export function WatchSessionProvider({owner,api,enabled,remember=true,bluetooth=watchBluetooth,supported=isNative(),children}:{owner:string;api:StorageApi;enabled:boolean;remember?:boolean;bluetooth?:WatchBluetooth;supported?:boolean;children:ReactNode}){
  const watch=usePineTimeWatch(owner,bluetooth,enabled&&remember&&supported,remember);
  const storage=useWatchStorage(watch,enabled&&remember?api:undefined,enabled&&remember);
  return <WatchSessionContext.Provider value={{watch,storage}}>{children}</WatchSessionContext.Provider>;
}
export const useSharedWatch=()=>useContext(WatchSessionContext)?.watch;
type PanelProps={watch:ReturnType<typeof usePineTimeWatch>;storageApi?:StorageApi;storageReady?:boolean;onSaved?:()=>void;onManageData?:()=>void;showStorage?:boolean};
export function PineTimeWatchPanel(props:PanelProps){
  const session=useContext(WatchSessionContext);
  return session?.watch===props.watch?<WatchPanel {...props} storage={session.storage}/>:<StandaloneWatchPanel {...props}/>;
}
function StandaloneWatchPanel(props:PanelProps){
  const storage=useWatchStorage(props.watch,props.storageApi,props.storageReady??false);
  return <WatchPanel {...props} storage={storage}/>;
}
function WatchPanel({watch,storage,storageReady=false,onSaved,onManageData,showStorage=true}:PanelProps&{storage:ReturnType<typeof useWatchStorage>}) {
  const {state,consent,pending,error,supported} = watch;
  const [now,setNow] = useState(Date.now);
  const goal=watch.preferences.value.watch.goal;
  useEffect(() => {const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const notifySaved=useEffectEvent(()=>onSaved?.());
  useEffect(()=>{if(storage.state.lastSavedAt&&storage.selected.consent)notifySaved();},[storage.state.lastSavedAt,storage.selected.consent]);
  const active = state.phase === 'connected';
  const goalValue = Number(goal);
  const validGoal = goal !== '' && Number.isInteger(goalValue) && goalValue > 0 && goalValue <= 100000;
  const steps = active ? state.readings.steps : undefined;
  const heartRate = active ? state.readings.heartRate : undefined;
  const isFresh = (channel:Channel,reading:Reading|undefined) => {
    const age=reading?Math.max(now,Date.now())-reading.receivedAt:Infinity;
    return !!reading && !state.refreshErrors?.[channel] && age>=0 && age<WATCH_READING_MAX_AGE[channel];
  };
  const freshSteps = isFresh('steps',steps),freshHeartRate = isFresh('heartRate',heartRate);
  const progress = validGoal && steps && freshSteps ? Math.min(100,Math.round(steps.value/goalValue*100)) : undefined;
  const summary = !active ? 'No watch readings are available.' : [
    steps ? `${freshSteps?'Watch step count':'Last received step count'}: ${steps.value.toLocaleString()}.${freshSteps?'':' Awaiting an update.'}` : 'No step reading received.',
    validGoal && steps && freshSteps && steps.value >= goalValue ? 'Your watch counter has reached your goal.' : '',
    freshHeartRate && heartRate ? `Recent heart rate: ${heartRate.value.toLocaleString()} bpm.` : 'No recent heart-rate reading.',
  ].filter(Boolean).join(' ');
  const receivedAgo = (receivedAt: number) => {
    const seconds = Math.max(0,Math.floor((now-receivedAt)/1000));
    return seconds < 1 ? 'just now' : seconds < 60 ? `${seconds}s ago` : seconds < 3600 ? `${Math.floor(seconds/60)}m ago` : `${Math.floor(seconds/3600)}h ago`;
  };
  const stages = {initializing:'Starting Bluetooth',selecting:'Selecting a watch',discovering:'Connecting and discovering services',subscribing:'Enabling watch notifications',reading:'Reading watch data'};
  const status = !supported ? 'Installed mobile app required' : state.phase === 'connecting' ? stages[state.connectionStage??'initializing'] :
    active ? 'Connected' : state.phase === 'disconnected' ? 'Connection lost' : state.phase === 'error' ? 'Connection failed' : 'Not connected';
  return <section className="care-watch" aria-label="PineTime Bluetooth connection">
    <header className="care-watch-heading"><div><div className="care-title-group"><h2>PineTime</h2><CareInfo title="Watch connection"><p>{tr('Keep your watch nearby and Bluetooth on. No internet needed. Disconnect to stop reconnection.')}</p><p>{tr('These choices and the selected watch are remembered separately on this device. Receiving resumes while the app is open. Disconnect or uncheck this option to stop automatic reconnection.')}</p><p>{watch.preferences.value.watch.backgroundHistory?'On-phone history and cloud saving are separate permissions.':storage.selected.consent?'Private uploads require internet access.':'Live readings are session only unless you enable on-phone history.'} Device readings are not medically verified.</p></CareInfo></div><span role="status">{active?<BluetoothConnected size={18}/>:<Bluetooth size={18}/>} {status}</span></div>
      {(active||pending)?<Button variant="outline" onClick={()=>void watch.disconnect()}><Unplug size={18}/>Disconnect</Button>:
        <Button disabled={!supported||!consent||pending} onClick={()=>void watch.connect()}><Bluetooth size={18}/>Connect watch</Button>}
    </header>
    <PreferenceError store={watch.preferences.store}/>
    <label className="care-check"><input type="checkbox" checked={consent} disabled={!supported} onChange={event=>watch.allow(event.target.checked)}/>{tr('Allow watch readings and automatic reconnection on this device')}</label>
    <dl className="care-watch-readings">{([
      ['heartRate','Recent heart rate','bpm',Heart],['steps','Watch step count','steps',Footprints],['battery','Battery','%',Battery],
    ] as const).map(([channel,label,unit,Icon])=>{
      const reading=active?state.readings[channel]:undefined;
      const fresh=isFresh(channel,reading),visible=!!reading&&(channel!=='heartRate'||fresh);
      return <div key={channel} data-channel={channel}><dt><Icon size={18}/>{label}</dt><dd>{visible?reading.value.toLocaleString():'—'} <small>{visible?unit:''}</small></dd>
        {channel==='battery'&&reading&&fresh&&<progress className="care-watch-meter" aria-label="Watch battery level" value={reading.value} max={100}/>}
        {state.refreshErrors?.[channel]&&<span role="status">Update failed</span>}
        <span>{reading?<>{!fresh&&(channel==='heartRate'?'No recent reading · ':'Stale reading · ')}<time dateTime={new Date(reading.receivedAt).toISOString()} title={new Date(reading.receivedAt).toLocaleString()}>{fresh?'Received':'Last received'} {receivedAgo(reading.receivedAt)}</time></>:'No reading received'}</span></div>;
    })}</dl>
    <div className="care-option-info"><label className="care-check"><input type="checkbox" checked={watch.preferences.value.watch.autoMeasure} disabled={!supported||!consent} onChange={event=>watch.preferences.store.updateWatch({autoMeasure:event.target.checked,...(!event.target.checked?{backgroundHistory:false}:{})})}/>{tr('Automatically measure heart rate every 15 minutes')}</label><CareInfo title="Automatic measurements">{watch.preferences.value.watch.backgroundHistory?<p>Each session allows warm-up and ten seconds of readings, up to 60 seconds total. Periodic readings are not continuous or medical monitoring.</p>:<p>{tr('Allow warm-up, then collect 10 seconds of usable readings, with a 60-second total limit. Requires compatible Mastro firmware and Bluetooth pairing. The phone app must stay open; the watch display may sleep. This is periodic observation, not continuous or medical monitoring.')}</p>}</CareInfo></div>
    {!watch.preferences.value.watch.backgroundHistory&&<p className="care-private">{tr('Keep the app open for readings. Your watch screen can sleep.')}</p>}
    {watch.history&&<>
      <div className="care-option-info"><label className="care-check"><input type="checkbox" checked={watch.preferences.value.watch.backgroundHistory} disabled={!consent||!watch.preferences.value.watch.autoMeasure} onChange={event=>watch.preferences.store.updateWatch({backgroundHistory:event.target.checked})}/>{tr('Continue sensing when my iPhone locks and keep private on-phone history')}</label><CareInfo title="Background readings"><p>{tr('Requires Mastro 0.1.13 or newer. Keep Bluetooth on and the watch nearby. The watch runs the 15-minute schedule while iOS receives readings in the background. Force-quitting, system termination or losing Bluetooth can stop reception; reopen the app to resume.')}</p><p>{tr('On-phone history keeps up to one observation per category every 30 seconds, with original receipt times and no automatic age-based deletion. Steps are recorded when read, not continuously in the background. Upload happens only with separate cloud-saving permission while the app is open. Deleting the app or losing this phone can lose local-only history.')}</p></CareInfo></div>
      <p className="care-private">{tr('Requires Mastro 0.1.13+. If readings stop, reopen the app. Cloud saving needs separate permission.')}</p>
      {watch.preferences.value.watch.backgroundHistory&&<p role="status">{state.sensing?.periodic?tr('Background sensing is armed. You may lock your phone.'):tr('Keep Silver Bank open until background sensing is armed.')}</p>}
    </>}
    {watch.preferences.value.watch.autoMeasure&&<p role="status">{!active?'Automatic sensing waits for a watch connection.':({
      idle:'Waiting for the next sensing session.',
      queued:'Sensing request accepted; waiting for the watch.',
      warming:'Warming up the heart sensor…',
      collecting:'Collecting 10 seconds of usable readings.',
      complete:'Measurement complete.',
      'no-reading':'No usable reading. Try again.',
      cancelled:'Sensing session stopped.',
      unavailable:'Automatic sensing is unavailable.',
    }[state.sensing?.phase??'idle'])}</p>}
    {watch.preferences.value.watch.autoMeasure&&active&&state.sensing?.nextAt&&<p>Next reading: {new Date(state.sensing.nextAt).toLocaleTimeString()}.</p>}
    {state.sensing?.error&&<p className="error" role="alert">{state.sensing.error}</p>}
    {watch.preferences.value.watch.autoMeasure&&state.sensing?.phase==='unavailable'&&<Button variant="outline" disabled={!active||pending} onClick={()=>void watch.retrySensing()}>Retry automatic sensing</Button>}
    {state.device&&<p>{state.device.name||'Selected watch'}</p>}
    {(error||state.error)&&<p className="error" role="alert">{error||state.error}</p>}
    {state.phase==='disconnected'&&<Button variant="outline" disabled={!consent||pending} onClick={()=>void watch.reconnect()}><RefreshCw size={18}/>Reconnect</Button>}

    <div className="care-watch-goal">
      <label htmlFor="watch-step-goal"><Footprints size={18}/>Step-count goal <small>{tr('Remembered on this device')}</small></label>
      <input id="watch-step-goal" type="number" inputMode="numeric" min="1" max="100000" step="1" placeholder="Not set" value={goal} disabled={!consent||!supported} aria-invalid={goal!==''&&!validGoal} aria-describedby={goal!==''&&!validGoal?'watch-goal-error':undefined} onChange={event=>watch.preferences.store.updateWatch({goal:event.target.value})}/>
      {goal!==''&&!validGoal&&<p id="watch-goal-error" className="error">Enter a whole number from 1 to 100,000.</p>}
      {progress!==undefined&&steps&&<div className="care-watch-goal-progress"><progress className="care-watch-meter" aria-label="Step-count goal progress" value={Math.min(steps.value,goalValue)} max={goalValue}/><span>{steps.value.toLocaleString()} / {goalValue.toLocaleString()} steps</span><output aria-label="Step-count goal percentage">{progress}%</output></div>}
    </div>
    <section className="care-watch-summary" aria-label="Watch reading summary"><h3>At a glance</h3><p>{summary}</p></section>
    {showStorage&&<section className="care-watch-storage" aria-label="Private watch storage"><div className="care-section-heading"><h3><ShieldCheck size={18}/>Private account storage</h3><CareInfo title="Private account storage"><p>{tr('Tap Start saving to upload while the app is open and online. Stop saving turns off uploads.')}</p><p>Stopping uploads keeps existing records. Watch readings do not affect Time Credits or recommendations.</p></CareInfo></div>
      {!storageReady&&<p>To save online, connect to the internet and complete Care privacy setup.</p>}
      <label className="care-check"><input type="checkbox" checked={storage.selected.consent} disabled={!storage.selected.consent&&(!storage.available||!storageReady)} onChange={event=>storage.choose('consent',event.target.checked)}/>Save selected watch readings to my private Silver Bank account</label>
      <div className="care-watch-categories">{(['steps','heartRate'] as const).map(kind=><label className="care-check" key={kind}><input type="checkbox" checked={storage.selected[kind]} disabled={!storage.selected.consent||!!storage.state.registered||storage.state.phase==='enrolling'} onChange={event=>storage.choose(kind,event.target.checked)}/>{kind==='steps'?'Save step-counter observations':'Save recent heart-rate observations'}</label>)}</div>
      <p role="status">{storage.state.phase==='enrolling'?'Registering private connection':storage.state.phase==='pending'?'Waiting to sync':storage.state.phase==='saved'?'Saved to your private account':storage.state.phase==='error'?'Sync failed':storage.state.phase==='ready'?'Waiting for watch readings':'Not saving watch readings'}</p>
      {storage.state.lastSavedAt&&<p>Last confirmed {new Date(storage.state.lastSavedAt).toLocaleTimeString()}</p>}
      {storage.state.error&&<p className="error" role="alert">{storage.state.error}</p>}
      {storage.state.discarded>0&&<p>{storage.state.discarded} older observations were not saved.</p>}
      <div className="care-actions">
        {(watch.preferences.value.watch.saveEnabled||storage.state.registered||storage.state.phase==='enrolling')&&<Button variant="outline" onClick={storage.stop}><Unplug size={18}/>Stop saving</Button>}
        {storage.state.phase==='error'&&storage.state.registered&&<Button variant="outline" onClick={storage.retry}><RefreshCw size={18}/>Retry sync</Button>}
        {!storage.state.registered&&storage.state.phase!=='enrolling'&&<Button disabled={!storageReady||!storage.available||!storage.selected.consent||(!storage.selected.steps&&!storage.selected.heartRate)||(!active&&!watch.history)} onClick={storage.start}><CloudUpload size={18}/>Start saving</Button>}
        {onManageData&&<Button variant="ghost" onClick={onManageData}>Manage saved data</Button>}
      </div>
    </section>}
    {watch.history&&<LocalWatchHistory key={watch.historyScope} repository={watch.history} scope={watch.historyScope} preferences={watch.preferences.store}/>}
  </section>;
}
