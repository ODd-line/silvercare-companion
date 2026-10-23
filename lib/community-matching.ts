type MatchingTask={title:string;description:string;category:string;category_id:string;location:string;remote:boolean|number;requested_at:number;estimated_seconds:number};
type MatchingUser={location?:string;skills?:string;preferences?:string};
type MatchingPreferences={mode:string;days?:string;timezone?:string;max_minutes?:number|null};
const norm=(value:string)=>value.normalize('NFKC').toLowerCase().trim();

export function rankTask(task:MatchingTask,user:MatchingUser,preferences:MatchingPreferences,history:Set<string>){
 let score=0;
 const reasons:string[]=[];
 if(user.location&&norm(task.location)===norm(user.location)&&!task.remote){score+=4;reasons.push('Same service area');}
 const content=norm(task.title+' '+task.description+' '+task.category);
 const skills=norm(user.skills||'').split(/[\s,，、;；]+/).filter(skill=>skill.length>1);
 if(skills.some(skill=>content.includes(skill))){score+=3;reasons.push('Matches your skills');}
 if(norm(user.preferences||'').split(/[,，、;；]+/).filter(Boolean).some(category=>content.includes(category.trim()))){score+=3;reasons.push('Matches your preferences');}
 if(history.has(task.category_id)){score+=2;reasons.push('Similar to tasks you helped with');}
 if(preferences.mode!=='any'&&(task.remote?'remote':'in_person')===preferences.mode){score++;reasons.push('Matches how you prefer to meet');}
 const days:string[]=JSON.parse(preferences.days||'[]');
 const day=new Intl.DateTimeFormat('en',{weekday:'short',timeZone:preferences.timezone||'UTC'}).format(new Date(task.requested_at*1000));
 if(days.includes(day)){score++;reasons.push('Matches your preferred days');}
 if(preferences.max_minutes&&task.estimated_seconds<=preferences.max_minutes*60){score++;reasons.push('Matches your preferred duration');}
 return {score,reasons};
}