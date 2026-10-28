'use client';
import {useEffect,useRef,type ReactNode} from 'react';
import {Tabs} from 'radix-ui';
import {Search,Sparkles,Clock,HeartHandshake,Plus,ArrowRight,RotateCcw} from 'lucide-react';
import {Button} from './ui/button';
import {tr,useLanguage} from '@/lib/i18n';

type TaskView='available'|'recommended'|'helping'|'requested';
export function CommunityBrowser({view,onChange,children}:{view:TaskView;onChange:(view:TaskView)=>void;children:ReactNode}){
 useLanguage();
 const lastActivity=useRef<TaskView>(view==='requested'?'requested':'helping');
 useEffect(()=>{if(view==='helping'||view==='requested')lastActivity.current=view;},[view]);
 const mainView=view==='helping'||view==='requested'?'activity':view;
 return <Tabs.Root className="community-browser" value={mainView} onValueChange={value=>onChange(value==='activity'?lastActivity.current:value as TaskView)}>
  <Tabs.List className="community-tabs" aria-label={tr('Community views')}>
   {([['available','Browse',Search],['recommended','For you',Sparkles],['activity','My activity',Clock]] as const).map(([id,label,Icon])=><Tabs.Trigger key={id} className="community-tab" value={id}><Icon size={20} aria-hidden="true"/><span>{tr(label)}</span></Tabs.Trigger>)}
  </Tabs.List>
  <Tabs.Content className="community-content" value={mainView}>
   {mainView==='activity'&&<div className="community-activity-switch" role="group" aria-label={tr('Activity type')}>{(['helping','requested'] as const).map(id=><button key={id} type="button" aria-pressed={view===id} onClick={()=>onChange(id)}>{tr(id==='helping'?'Helping':'Requested')}</button>)}</div>}
   {children}
  </Tabs.Content>
 </Tabs.Root>;
}

export function CommunityEmptyState({view,filtered,onClear,onBrowse,onAsk}:{view:TaskView;filtered:boolean;onClear:()=>void;onBrowse:()=>void;onAsk:()=>void}){
 const clear=filtered&&view!=='recommended';
 const title=clear?'No matching requests':view==='available'?'No requests found':view==='recommended'?'No recommendations yet':'No activity yet';
 const Icon=clear?RotateCcw:view==='available'?Plus:ArrowRight;
 return <section className="empty community-empty" aria-label={tr(title)}><HeartHandshake size={32} aria-hidden="true"/><h3>{tr(title)}</h3><Button variant="outline" onClick={clear?onClear:view==='available'?onAsk:onBrowse}><Icon size={20} aria-hidden="true"/>{tr(clear?'Clear filters':view==='available'?'Ask for help':'Browse all')}</Button></section>;
}
