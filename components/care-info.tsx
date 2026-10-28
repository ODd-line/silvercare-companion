'use client';

import {useId,useState,type ReactNode} from 'react';
import {Info,X} from 'lucide-react';
import {Button} from './ui/button';
import {Popover,PopoverTrigger,PopoverContent} from './ui/popover';
import {tr,useLanguage} from '@/lib/i18n';

export function CareInfo({title,children}:{title:string;children:ReactNode}){
 useLanguage();
 const [open,setOpen]=useState(false);
 const titleId=useId();
 return <Popover open={open} onOpenChange={setOpen}>
  <PopoverTrigger asChild>
   <Button type="button" variant="ghost" size="icon" className="care-info-button" aria-label={tr('About {topic}',{topic:title})} title={tr('About {topic}',{topic:title})}><Info className="size-5" aria-hidden="true"/></Button>
  </PopoverTrigger>
  <PopoverContent align="end" sideOffset={8} collisionPadding={16} className="care-info-popover" aria-labelledby={titleId}>
   <div className="care-info-heading"><h3 id={titleId}>{title}</h3><Button type="button" variant="ghost" size="icon" className="care-info-button" aria-label={tr('Close information')} onClick={()=>setOpen(false)}><X className="size-5" aria-hidden="true"/></Button></div>
   <div className="care-info-body">{children}</div>
  </PopoverContent>
 </Popover>;
}
