import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {preview} from 'vite';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');

export async function startAppDemo({port=3042}={}){
 if(!existsSync(path.join(root,'mobile-www/index.html')))throw new Error('Run npm run mobile:build before starting the demo.');
 const user={id:'demo-member',name:'Demo Member',email:'demo@example.invalid',account_type:'individual',role:'member',language:'en',location:'Hong Kong',skills:'Calligraphy and Cantonese storytelling',preferences:'Teaching',contributed:0,received:0,completed_tasks:0};
 const categories=[{id:'teaching',name:'Teaching'},{id:'companionship',name:'Companionship'},{id:'technology',name:'Technology assistance'}];
 const balance={available:0,reserved:0};
 let matching={mode:'in_person',days:'["Mon","Thu"]',timezone:'Asia/Hong_Kong',max_minutes:45};
 let records=[];
 const sampleNow=Math.floor(Date.now()/1000);
 const sampleHours=[1,3,6,12,30,54,96,144];
 const measurements=sampleHours.flatMap((hours,index)=>[
  {id:'demo-heart-'+index,device_id:'demo-watch',device_name:'Sample PineTime',kind:'heart_rate',value:[72,78,84,69,76,81,74,70][index],unit:'bpm',measured_at:sampleNow-hours*3600,timestamp_source:'phone_received',demo:true},
  {id:'demo-steps-'+index,device_id:'demo-watch',device_name:'Sample PineTime',kind:'steps',value:[240,4150,3200,1650,5800,4700,6200,3900][index],unit:'steps',measured_at:sampleNow-hours*3600,timestamp_source:'phone_received',demo:true},
 ]);
 let preferences={activity:[],notifications:1,bank_consent:0,reminder_hour:null};
 const talent=()=>({skills:user.skills,categories:user.preferences.split(',').map(value=>value.trim()).filter(Boolean),matching});
 return preview({configFile:false,root,build:{outDir:'mobile-www'},preview:{host:'127.0.0.1',port,strictPort:true},plugins:[{
  name:'local-app-demo',
  configurePreviewServer(server){server.middlewares.use(async(req,res,next)=>{
   const url=new URL(req.url,'http://'+req.headers.host);
   if(!url.pathname.startsWith('/api/'))return next();
   res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
   const reply=(data,status=200)=>{res.statusCode=status;res.end(JSON.stringify(data));};
   try{
    const endpoint=url.pathname.slice(5),post=req.method==='POST';
    if(!['GET','POST'].includes(req.method))return reply({error:'Demo method unavailable.'},405);
    let body={};
    if(post){
     if(req.headers.origin!==url.origin)return reply({error:'Use this demo from its own local page.'},403);
     let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)return reply({error:'Demo request too large.'},413);}
     body=JSON.parse(raw);
     if(!body||typeof body!=='object'||Array.isArray(body))return reply({error:'Invalid demo request.'},400);
     if(endpoint==='talent-profile'){
      if(body.ownerId!==user.id||typeof body.skills!=='string'||!body.skills.trim()||!Array.isArray(body.categories))return reply({error:'Review your sample talent profile.'},400);
      user.skills=body.skills;user.preferences=body.categories.join(', ');
      matching={mode:body.mode,days:JSON.stringify(body.days),timezone:body.timezone,max_minutes:Number(body.maxMinutes)||null};
      return reply(talent());
     }
     if(endpoint==='care/record'){
      const occurredAt=Date.parse(body.occurredAt);
      if(body.confirmed!==true||!['checkin','symptom'].includes(body.kind)||!Number.isFinite(occurredAt)||!body.data)return reply({error:'Review and confirm your sample record.'},400);
      const record={id:crypto.randomUUID(),kind:body.kind,occurred_at:occurredAt/1000,data:body.data,version:1};
      records=[record,...records].slice(0,50);return reply({id:record.id});
     }
     if(endpoint==='care/preferences'){
      preferences={...preferences,activity:body.activity||[],notifications:body.notifications?1:0,bank_consent:body.bankConsent?1:0,reminder_hour:body.reminderHour===''?null:Number(body.reminderHour)};
      return reply({ok:true});
     }
     if(endpoint==='care/delete-record'){records=records.filter(record=>record.id!==body.id);return reply({ok:true});}
     return reply({error:'Unavailable in this demo. No account, booking, sharing or notification was changed.'},409);
    }
    if(endpoint==='setup')return reply({configured:true});
    if(endpoint==='me')return reply({demoPreview:true,user,balance,categories,agreements:[],verification:{canParticipate:true,organizations:[]},serverTime:Date.now()/1000});
    if(endpoint==='talent-profile')return reply(talent());
    if(endpoint==='matching-preferences')return reply(matching);
    if(endpoint==='care')return reply({records,measurements,devices:[],summaries:[],received:[],shares:[],audit:[],preferences});
    if(endpoint==='care/family')return reply({contacts:[]});
    if(endpoint==='notifications/count')return reply({unread:0});
    if(endpoint==='ledger')return reply({balance,entries:[]});
    if(['tasks','programs','recommendations','notifications'].includes(endpoint))return reply([]);
    return reply({error:'This screen is unavailable in the local demo.'},404);
   }catch{return reply({error:'Invalid local demo request.'},400);}
  });},
 }]});
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const server=await startAppDemo();
 server.printUrls();
 console.log('Sample-data app preview: http://localhost:3042/#care/overview');
 console.log('Setup skipped only in this loopback demo. Changes stay in memory; no real account or delivery.');
}