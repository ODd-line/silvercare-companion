export function createAppDemo(){
 const now=Math.floor(Date.now()/1000);
 const user={id:'local-demo-member',name:'Demo Member',email:'demo@example.invalid',account_type:'individual',role:'member',language:'en',location:'Hong Kong',skills:'Calligraphy and Cantonese storytelling',preferences:'Teaching',contributed:0,received:0,completed_tasks:0,reviews:[]};
 const balance={available:0,reserved:0};
 const categories=[{id:'teaching',name:'Teaching'},{id:'companionship',name:'Companionship'}];
 let records:any[]=[];
 let preferences:{activity:string[];notifications:number;bank_consent:number;reminder_hour:number|null}={activity:[],notifications:1,bank_consent:0,reminder_hour:null};
 let matching:{mode:string;days:string;timezone:string;max_minutes:number|null}={mode:'in_person',days:'["Mon","Thu"]',timezone:'Asia/Hong_Kong',max_minutes:45};
 const measurements=[1,3,6,12,30,54,96,144].flatMap((hours,index)=>[
  {id:'sample-heart-'+index,device_name:'Sample PineTime',kind:'heart_rate',value:[72,78,84,69,76,81,74,70][index],unit:'bpm',measured_at:now-hours*3600,timestamp_source:'phone_received',demo:true},
  {id:'sample-steps-'+index,device_name:'Sample PineTime',kind:'steps',value:[240,4150,3200,1650,5800,4700,6200,3900][index],unit:'steps',measured_at:now-hours*3600,timestamp_source:'phone_received',demo:true},
 ]);
 const talent=()=>({skills:user.skills,categories:user.preferences.split(',').map(value=>value.trim()),matching});
 return async(path:string,data?:any)=>{
  const endpoint=path.split('?')[0];
  if(data!==undefined){
   if(endpoint==='auth/logout')return {ok:true};
   if(endpoint==='care/record'){
    if(data.confirmed!==true||!['checkin','symptom'].includes(data.kind)||!Number.isFinite(Date.parse(data.occurredAt)))throw new Error('Review and confirm your sample record.');
    const previous=data.id?records.find(record=>record.id===data.id):undefined;
    if(data.id&&!previous)throw new Error('Sample record not found. Return to My Health and try again.');
    if(previous&&previous.version!==data.version)throw new Error('This sample record changed. Open it again before saving.');
    const record={id:previous?.id||crypto.randomUUID(),kind:data.kind,occurred_at:Date.parse(data.occurredAt)/1000,data:data.data,version:(previous?.version||0)+1};
    records=previous?records.map(item=>item.id===record.id?record:item):[record,...records].slice(0,50);return {id:record.id};
   }
   if(endpoint==='care/delete-record'){records=records.filter(record=>record.id!==data.id);return {ok:true};}
   if(endpoint==='talent-profile'){
    if(data.ownerId!==user.id||typeof data.skills!=='string'||!data.skills.trim()||!Array.isArray(data.categories))throw new Error('Review your sample talent profile.');
    user.skills=data.skills;user.preferences=data.categories.join(', ');matching={mode:data.mode,days:JSON.stringify(data.days),timezone:data.timezone,max_minutes:Number(data.maxMinutes)||null};return talent();
   }
   if(endpoint==='care/preferences'){preferences={...preferences,activity:data.activity||[],notifications:data.notifications?1:0,bank_consent:data.bankConsent?1:0,reminder_hour:data.reminderHour===''?null:Number(data.reminderHour)};return {ok:true};}
   throw new Error('Unavailable in demo mode. No real account, booking, watch upload or notification was changed.');
  }
  if(endpoint==='me')return structuredClone({demoPreview:true,user,balance,categories,agreements:[],verification:{canParticipate:true,organizations:[]},serverTime:Date.now()/1000});
  if(endpoint==='setup')return {configured:true};
  if(endpoint==='care')return structuredClone({records,measurements,preferences,devices:[],summaries:[],received:[],shares:[],audit:[]});
  if(endpoint==='care/family')return {contacts:[]};
  if(endpoint==='talent-profile')return structuredClone(talent());
  if(endpoint==='matching-preferences')return structuredClone(matching);
  if(endpoint==='ledger')return {balance,entries:[]};
  if(endpoint==='notifications/count')return {unread:0};
  if(endpoint==='programs')return {programs:[],enrollments:[],support:[],badges:[],matches:[]};
  if(['tasks','recommendations','notifications'].includes(endpoint))return [];
  throw new Error('This screen is unavailable in demo mode.');
 };
}