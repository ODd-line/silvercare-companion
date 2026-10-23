'use client';
import {useState} from 'react';
import {Button} from './ui/button';
import {Input} from './silver/input';
import {getLanguage,tr} from '@/lib/i18n';
import {copyNativeRecovery,isNative} from '@/lib/mobile-session';

type GuestResponse={ok:boolean;recoveryKey?:string};
export function GuestAccess({api,onEnter,onBack}:{api:(path:string,data:Record<string,unknown>)=>Promise<GuestResponse>;onEnter:()=>Promise<void>;onBack:()=>void}){
 const [restore,setRestore]=useState(false),[consent,setConsent]=useState(false),[key,setKey]=useState(''),[createdKey,setCreatedKey]=useState(''),[saved,setSaved]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 async function attempt(action:()=>Promise<void>){
  setBusy(true);setError('');setNotice('');
  try{await action();}catch(error){setError(error instanceof Error?error.message:tr('Please try again.'));}finally{setBusy(false);}
 }
 async function copyKey(){
  if(isNative())await copyNativeRecovery(createdKey);else await navigator.clipboard.writeText(createdKey);
  setNotice(tr('Recovery code copied. Store it somewhere private.'));
 }
 return <div className="auth-card">
  <h1>{tr(createdKey?'Save your guest recovery code':restore?'Return to your guest account':'Continue as guest')}</h1>
  {error&&<p className="error" role="alert">{tr(error)}</p>}
  {notice&&<p role="status">{notice}</p>}
  {createdKey?<>
   <p>{tr('This code opens your account and private health records. Keep it secret. Without it, you cannot recover access after signing out or session expiry.')}</p>
   <code className="recovery">{createdKey}</code>
   <Button disabled={busy} onClick={()=>void attempt(copyKey)}>{tr('Copy guest recovery code')}</Button>
   <label className="field"><span><input type="checkbox" checked={saved} disabled={busy} onChange={event=>setSaved(event.target.checked)}/> {tr('I have saved my recovery code somewhere private.')}</span></label>
   <Button disabled={busy||!saved} onClick={()=>void attempt(onEnter)}>{tr(busy?'Opening your community…':'Open app')}</Button>
  </>:<>
   <p>{tr('A guest account is a real, separate account, not a shared demo. Explore the full app; community participation still requires profile completion and verification. Watch uploads require separate consent.')}</p>
   <form onSubmit={event=>{event.preventDefault();void attempt(async()=>{
    const response=await api(restore?'auth/guest-recover':'auth/guest',restore?{recoveryKey:key}:{guestConsent:consent,language:getLanguage()});
    if(!response.ok)throw Error(tr('Please try again.'));
    if(restore){await onEnter();return;}
    if(!response.recoveryKey)throw Error(tr('The service did not return a guest recovery code.'));
    setCreatedKey(response.recoveryKey);
   });}}>
    <fieldset disabled={busy}>
     {restore?<><label className="field"><span>{tr('Guest recovery code')}</span><Input type="password" required value={key} onChange={event=>setKey(event.target.value)} autoComplete="off" autoCapitalize="none" spellCheck={false}/></label><p>{tr('Returning signs out other sessions and disconnects previous watch uploads. Your saved records remain.')}</p></>:<label className="field"><span><input type="checkbox" required checked={consent} onChange={event=>setConsent(event.target.checked)}/> {tr('I understand this creates a real account and I must keep its recovery code to regain access.')}</span></label>}
     <Button type="submit">{tr(busy?'Opening your community…':restore?'Return to guest account':'Create guest account')}</Button>
    </fieldset>
   </form>
   <Button variant="link" disabled={busy} onClick={()=>{setRestore(!restore);setError('');setKey('')}}>{tr(restore?'Create a new guest account':'Already have a guest recovery code?')}</Button>
   <Button variant="link" disabled={busy} onClick={onBack}>{tr('Back to sign in')}</Button>
  </>}
 </div>;
}
