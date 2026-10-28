import {env} from 'cloudflare:workers';
import {type EmailEnv} from '@/lib/care-email-core';
import {verifyEmailWebhook} from '@/lib/care-email-webhook';
export const dynamic='force-dynamic';
export async function POST(req:Request){
 const config=env as unknown as EmailEnv;
 if(!config.RESEND_WEBHOOK_SECRET)return new Response(null,{status:503});
 if(Number(req.headers.get('content-length')||0)>65536)return new Response(null,{status:413});
 const raw=await req.text();if(raw.length>65536)return new Response(null,{status:413});
 if(!await verifyEmailWebhook(config.RESEND_WEBHOOK_SECRET,req.headers,raw))return new Response(null,{status:401});
 try{
  const event=JSON.parse(raw);
  if(['email.bounced','email.complained'].includes(event.type)&&typeof event.data?.email_id==='string'){
   const d=await config.DB.prepare('SELECT user_id,revision FROM care_email_deliveries WHERE provider_id=?').bind(event.data.email_id).first<{user_id:string;revision:number}>();
   if(d)await config.DB.batch([
    config.DB.prepare('UPDATE care_email_preferences SET enabled=0,verified_at=NULL,revision=revision+1 WHERE user_id=? AND revision=?').bind(d.user_id,d.revision),
    config.DB.prepare("UPDATE care_email_deliveries SET status='bounced',payload='{}' WHERE provider_id=?").bind(event.data.email_id),
   ]);
  }
  return new Response(null,{status:204});
 }catch{return new Response(null,{status:400});}
}
