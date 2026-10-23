'use client';
import {createContext,useContext,useMemo,useSyncExternalStore,type ReactNode} from 'react';
import {PreferenceStore,preferenceKey} from '@/lib/preferences';
import {apiOrigin} from '@/lib/mobile-session';
import {Button} from './ui/button';
import {tr,useLanguage} from '@/lib/i18n';

const stores=new Map<string,PreferenceStore>();
const Context=createContext<PreferenceStore|null>(null);
function storeFor(owner:string|null){
 if(owner===null||typeof window==='undefined')return new PreferenceStore(null);
 const key=preferenceKey(apiOrigin()||window.location.origin,owner);
 const existing=stores.get(key);if(existing)return existing;
 let store:PreferenceStore;
 try{store=new PreferenceStore(key,window.localStorage);}
 catch{store=new PreferenceStore(key,undefined,'Device storage is unavailable. Automatic watch activity is off and options cannot be remembered.');}
 stores.set(key,store);return store;
}
export function usePreferences(owner?:string|null){
 const inherited=useContext(Context);
 const own=useMemo(()=>owner===undefined?null:storeFor(owner),[owner]);
 const memory=useMemo(()=>new PreferenceStore(null),[]);
 const store=own??inherited??memory;
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
 return {...snapshot,store};
}
export function PreferenceProvider({store,children}:{store:PreferenceStore;children:ReactNode}){
 return <Context.Provider value={store}>{children}</Context.Provider>;
}
export function PreferenceError({store}:{store:PreferenceStore}){
 useLanguage();
 const snapshot=useSyncExternalStore(store.subscribe,store.getSnapshot,store.getServerSnapshot);
 return snapshot.error?<div className="error" role="alert">{tr(snapshot.error)} <Button variant="outline" onClick={()=>store.reset()}>{tr('Reset saved options')}</Button></div>:null;
}
