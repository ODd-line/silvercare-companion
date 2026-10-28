// Verify the exact raw body before parsing or processing provider events.
export async function verifyEmailWebhook(secret:string,headers:Headers,raw:string,now=Date.now()/1000){
 const id=headers.get('svix-id'),stamp=headers.get('svix-timestamp');
 if(!id||!stamp||!/^\d+$/.test(stamp)||Math.abs(now-Number(stamp))>300)return false;
 try{
  const bytes=Uint8Array.from(atob(secret.replace(/^whsec_/,'')),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',bytes,{name:'HMAC',hash:'SHA-256'},false,['verify']);
  for(const signature of (headers.get('svix-signature')||'').split(' ')){
   const [version,value]=signature.split(',');
   if(version!=='v1'||!value)continue;
   try{if(await crypto.subtle.verify('HMAC',key,Uint8Array.from(atob(value),c=>c.charCodeAt(0)),new TextEncoder().encode(`${id}.${stamp}.${raw}`)))return true;}catch{}
  }
 }catch{}
 return false;
}
