import {env} from 'cloudflare:workers';
import {unsubscribe,type EmailEnv} from '@/lib/care-email-core';
export const dynamic='force-dynamic';
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'",'X-Content-Type-Options':'nosniff'};
export async function GET(req:Request){
 const token=new URL(req.url).searchParams.get('token')||'';
 if(!/^[a-f0-9]{64}$/.test(token))return new Response('Invalid unsubscribe link.',{status:400,headers});
 return new Response('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SilverCare email preferences</title><h1>Stop weekly SilverCare emails?</h1><p>Your private health records will stay in SilverCare.</p><form method="post"><button type="submit">Stop weekly emails</button></form></html>',{headers});
}
export async function POST(req:Request){
 try{await unsubscribe(env as unknown as EmailEnv,new URL(req.url).searchParams.get('token')||'');return new Response('<!doctype html><html lang="en"><title>SilverCare emails stopped</title><h1>Weekly emails stopped</h1><p>You can enable them again in SilverCare Settings.</p></html>',{headers});}
 catch{return new Response('Unable to stop emails. Check your link or use SilverCare Settings.',{status:400,headers});}
}
