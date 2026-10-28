'use client';
import {useEffect,useRef,useState} from 'react';
import type {DailyChart} from '../lib/care-email-core';
import {Mail,CheckCircle2} from 'lucide-react';
import {Button} from './ui/button';
import {Input} from './silver/input';
import {CareInfo} from './care-info';

const sections=[['checkins','Check-ins'],['heart','Heart rate'],['notes','Health notes']] as const;
export function CareEmailSettings({api,userId}:{api:(path:string,body?:unknown)=>Promise<any>;userId:string}){
 const apiRef=useRef(api);apiRef.current=api;
 const [settings,setSettings]=useState<any>(null),[selected,setSelected]=useState<string[]>([]),[enabled,setEnabled]=useState(false),[consent,setConsent]=useState(false);
 const [code,setCode]=useState(''),[preview,setPreview]=useState<{label:string;metrics:{label:string;value:string}[];charts:DailyChart[]}|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const load=async()=>{const s=await api('care/email-settings');setSettings(s);setSelected(s.sections);setEnabled(s.enabled);};
 useEffect(()=>{let active=true;apiRef.current('care/email-settings').then(s=>{if(active){setSettings(s);setSelected(s.sections);setEnabled(s.enabled);}}).catch(e=>{if(active)setError(e.message);});return()=>{active=false;};},[userId]);
 async function act(path:string,body?:unknown){setBusy(true);setError('');setNotice('');try{const r=await api('care/'+path,body);return r;}catch(e){setError(e instanceof Error?e.message:'Please try again.');return null;}finally{setBusy(false);}}
 return <section className="care-card care-form care-email-settings" aria-labelledby="weekly-email-title">
  <div className="care-section-heading"><div className="care-title-group"><Mail size={26}/><h2 id="weekly-email-title">Weekly email</h2></div><CareInfo title="Weekly email"><p>Your health statistics and daily graphs, covering the previous week.</p><p>Statistics only. Note text, chats and contacts stay private.</p><p>Turn off emails here or unsubscribe in any report.</p></CareInfo></div>
  {error&&<p className="error" role="alert">{error}</p>}{notice&&<p className="success" role="status">{notice}</p>}
  {!settings?<Button variant="outline" onClick={()=>load().catch(e=>setError(e.message))}>Load email settings</Button>:<>
   <p><strong>Mondays, 9 AM Hong Kong time.</strong></p>
   {!settings.ready&&<p className="care-email-status" role="status">Email delivery is being set up. Preview your report below.</p>}
   {settings.guest?<p>Register with an email to receive reports.</p>:<>
    <p><strong>Send to:</strong> {settings.email} {settings.verified&&<span><CheckCircle2 size={16} aria-hidden="true"/> Verified</span>}</p>
    {!settings.verified&&<fieldset disabled={busy||!settings.ready}><legend>Verify your email</legend><p>We’ll email a code, with no health information.</p><Button variant="outline" type="button" onClick={async()=>{if(await act('email-request-code',{}))setNotice('Verification code sent. Check your inbox or spam folder. It expires in 10 minutes.');}}>Send code</Button><form onSubmit={async e=>{e.preventDefault();if(await act('email-verify',{code})){await load();setCode('');setNotice('Email verified. Choose your sections and enable weekly reports below.');}}}><label className="field"><span>Six-digit code</span><Input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label><Button type="submit">Verify email</Button></form></fieldset>}
    <form onSubmit={async e=>{e.preventDefault();const s=await act('email-settings',{enabled,sections:selected,consent});if(s){setSettings(s);setConsent(false);setPreview(null);setNotice(s.enabled?'Weekly reports enabled.':'Email preferences saved. Weekly delivery is off.');}}}>
     <fieldset disabled={busy}><legend>Include in report</legend>{sections.map(([id,label])=><label className="care-check" key={id}><input type="checkbox" checked={selected.includes(id)} onChange={e=>setSelected(e.target.checked?[...selected,id]:selected.filter(s=>s!==id))}/>{label}</label>)}
      <label className="care-check"><input type="checkbox" checked={enabled} disabled={!settings.enabled&&(!settings.ready||!settings.verified)} onChange={e=>setEnabled(e.target.checked)}/>Email me weekly</label>
      {enabled&&<label className="care-check"><input type="checkbox" required checked={consent} onChange={e=>setConsent(e.target.checked)}/>I agree to send my selected health statistics to my verified inbox. Email copies leave SilverCare and cannot be recalled.</label>}
      <Button type="submit" disabled={!selected.length}>Save email settings</Button>
     </fieldset>
    </form>
    {settings.enabled&&<p>Next report: {new Date(settings.nextDelivery*1000).toLocaleString('en-GB',{timeZone:'Asia/Hong_Kong'})} (Hong Kong).</p>}
    {settings.lastDelivery&&<p>Last report: {settings.lastDelivery.status==='sent'?'Accepted by email provider':settings.lastDelivery.status==='pending'?'Waiting to retry':settings.lastDelivery.status}.</p>}
   </>}
   <Button disabled={busy} variant="outline" onClick={async()=>{const p=await act('email-preview');if(p)setPreview(p);}}>Preview report</Button>
   {preview&&<article className="care-email-preview"><p className="care-email-eyebrow">SILVERCARE · EMAIL PREVIEW</p><h3>Small check-ins. A clearer picture.</h3><p>{preview.label} · Hong Kong time</p>{preview.charts.map(chart=><section key={chart.id} style={{marginBlock:24}}><h4>{chart.title}</h4><p>{chart.id==='heart'?`Daily averages · 0–${chart.maximum} bpm · Gaps mean no saved reading`:chart.id==='checkins'?'One marker per day with a saved check-in':`Saved note counts · 0–${chart.maximum}`}</p><table style={{width:'100%'}} aria-label={chart.title}><tbody>{chart.days.map(day=><tr key={day.date}><th scope="row" style={{textAlign:'left',fontWeight:400,paddingBlock:6}}>{day.label}</th><td style={{width:'55%'}}><div style={{background:'#edf1e8',height:18}}>{day.value!==null&&day.value>0&&<div style={{background:'#63816b',height:18,width:`${day.value/chart.maximum*100}%`}}/>}</div></td><td style={{textAlign:'right',fontSize:13}}>{day.value===null?'No reading':chart.id==='checkins'?(day.value?'Saved':'Not saved'):`${day.value} ${chart.unit}`}</td></tr>)}</tbody></table></section>)}<dl>{preview.metrics.map((m:any)=><div key={m.label}><dt>{m.label}</dt><dd>{m.value}</dd></div>)}</dl><p>Saved observations only. This is not continuous monitoring or a medical assessment.</p><p><strong>Preview only — no email was sent.</strong></p></article>}
  </>}
 </section>;
}
