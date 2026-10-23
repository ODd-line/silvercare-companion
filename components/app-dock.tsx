'use client';
import React,{useEffect,useState} from 'react';
import {Home,Search,Heart,Clock,UserRound,Users,Building2,BookOpen,Watch,NotebookPen,CalendarDays,Settings} from 'lucide-react';
import Dock from './Dock';
import {DropdownMenu,DropdownMenuTrigger,DropdownMenuContent,DropdownMenuItem} from './ui/dropdown-menu';
import {tr,useLanguage} from '@/lib/i18n';
export function AppDock({page,nav,partner=false,care=true}:{page:string,nav:(page:string)=>void,partner?:boolean,care?:boolean}){
 const [careMenuPage,setCareMenuPage]=useState<string|null>(null);
 const careOpen=careMenuPage===page&&!partner&&care;
 const setCareOpen=(open:boolean)=>setCareMenuPage(open?page:null);
 useEffect(()=>setCareMenuPage(openPage=>openPage===page&&!partner&&care?openPage:null),[page,partner,care]);
 const carePages=[['overview','Overview',Home],['health','My Health',Heart],['record','AI chat',NotebookPen],['timeline','Timeline',Clock],['watch','My Watch',Watch],['appointments','Appointments',CalendarDays],['family','Family',Users],['settings','Care settings',Settings]] as const;
 useLanguage();const [still,setStill]=useState(true);useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce), (hover: none)');const update=()=>setStill(query.matches);update();query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 const routes=partner?[['home','Overview',Home],['partner/needs','Needs',Search],['partner/programs','Programs',Users],['partner/training','Training',BookOpen],['partner/organization','Profile',Building2]] as const:[['home','Home',Home],['tasks','Community',Users],...(care?[['care/overview','Care',Heart] as const]:[]),['bank','Time Bank',Clock],['profile','Profile',UserRound]] as const;
 const items=routes.map(([id,label,Icon])=>{const active=page===id||(id==='tasks'&&(page.startsWith('task/')||page==='create'||page==='talents'||page==='programs'||page.startsWith('program/')))||(id==='care/overview'&&page.startsWith('care/'));return {icon:<Icon size={24}/>,label:tr(label),active,className:active?'active':'',onClick:id==='care/overview'?undefined:()=>nav(id),renderButton:id==='care/overview'?(button:React.ReactElement)=><DropdownMenu open={careOpen} onOpenChange={setCareOpen} modal={false}><DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger><DropdownMenuContent side="top" align="center" sideOffset={12} collisionPadding={16} className="app-care-menu" aria-label={tr('Care pages')}>{carePages.map(([section,title,PageIcon])=><DropdownMenuItem key={section} aria-current={page==='care/'+section?'page':undefined} onSelect={()=>{setCareOpen(false);nav('care/'+section)}}><PageIcon size={20}/>{tr(title)}</DropdownMenuItem>)}</DropdownMenuContent></DropdownMenu>:undefined}});
 return <nav className="app-dock" aria-label={tr('Main navigation')}><Dock items={items} panelHeight={68} baseItemSize={50} magnification={still?50:70} dockHeight={100}/></nav>;
}
