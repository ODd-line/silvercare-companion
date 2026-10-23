import {Capacitor,type PluginListenerHandle} from '@capacitor/core';
import {BleClient,BluetoothLe,hexStringToDataView} from '@capacitor-community/bluetooth-le';
import {z} from 'zod';
import type {WatchBluetooth} from './pinetime-watch';
import type {StoredWatchKind} from './watch-storage';

const recordSchema=z.object({
  sequence:z.number().int().positive().safe(),
  id:z.string().regex(/^sb-local:[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/),
  deviceId:z.string().min(1).max(200),deviceName:z.string().max(200),
  kind:z.enum(['steps','heart_rate']),value:z.number().int().nonnegative().max(200000),
  receivedAt:z.number().finite().positive(),uploaded:z.boolean(),
}).strict().refine(record=>record.kind!=='heart_rate'||record.value>0&&record.value<=300);
const pageSchema=z.object({records:z.array(recordSchema).max(500),total:z.number().int().nonnegative().safe(),pending:z.number().int().nonnegative().safe(),error:z.string().optional()}).strict();
export type LocalWatchRecord=z.infer<typeof recordSchema>;
export type LocalWatchPage=z.infer<typeof pageSchema>;
export type HistoryOptions={before?:number;pendingKinds?:StoredWatchKind[];limit?:number};
export interface WatchHistoryRepository {
  read(scope:string,options?:HistoryOptions):Promise<LocalWatchPage>;
  markUploaded(scope:string,ids:string[]):Promise<void>;
  deleteAll(scope:string):Promise<void>;
}
export type WatchHistoryPermission={scope:string;deviceId:string;deviceName?:string;enabled:boolean};
declare module '@capacitor-community/bluetooth-le' {
  interface BluetoothLePlugin {
    configureWatchHistory(options:WatchHistoryPermission):Promise<void>;
    readWatchHistory(options:HistoryOptions&{scope:string}):Promise<unknown>;
    markWatchHistoryUploaded(options:{scope:string;ids:string[]}):Promise<void>;
    deleteWatchHistory(options:{scope:string;confirmed:true}):Promise<void>;
  }
}
const native=BluetoothLe;
const history:WatchHistoryRepository={
  async read(scope,options={}){
    const parsed=pageSchema.safeParse(await native.readWatchHistory({scope,...options}));
    if(!parsed.success)throw Error('Could not read valid on-phone watch history.');
    return parsed.data;
  },
  markUploaded:(scope,ids)=>native.markWatchHistoryUploaded({scope,ids}),
  deleteAll:scope=>native.deleteWatchHistory({scope,confirmed:true}),
};
const listeners=new Map<string,PluginListenerHandle>();
const iosBluetooth:WatchBluetooth={
  initialize:options=>BleClient.initialize(options),
  requestDevice:options=>BleClient.requestDevice(options),
  connect:(id,disconnected,options)=>BleClient.connect(id,disconnected,options),
  disconnect:id=>BleClient.disconnect(id),
  read:(id,service,characteristic)=>BleClient.read(id,service,characteristic),
  write:(id,service,characteristic,packet,options)=>BleClient.write(id,service,characteristic,packet,options),
  async startNotifications(id,service,characteristic,listener){
    const key=`notification|${id}|${service.toLowerCase()}|${characteristic.toLowerCase()}`;
    await listeners.get(key)?.remove();
    const handle=await BluetoothLe.addListener(key,(event:{value?:unknown;receivedAt?:unknown})=>{
      if(typeof event.value!=='string'||!/^(?:[a-f0-9]{2})+$/i.test(event.value)||
         typeof event.receivedAt!=='number'||!Number.isFinite(event.receivedAt)){
        listener(new DataView(new ArrayBuffer(0)),NaN);return;
      }
      listener(hexStringToDataView(event.value),event.receivedAt);
    });
    listeners.set(key,handle);
    try{await BluetoothLe.startNotifications({deviceId:id,service,characteristic});}
    catch(error){await handle.remove();listeners.delete(key);throw error;}
  },
  async stopNotifications(id,service,characteristic){
    const key=`notification|${id}|${service.toLowerCase()}|${characteristic.toLowerCase()}`;
    try{await BluetoothLe.stopNotifications({deviceId:id,service,characteristic});}
    finally{await listeners.get(key)?.remove();listeners.delete(key);}
  },
  configureHistory:options=>native.configureWatchHistory(options),
  history,
};
export const watchBluetooth:WatchBluetooth=Capacitor.getPlatform()==='ios'?iosBluetooth:BleClient;
export const watchHistoryScope=(server:string,owner:string)=>JSON.stringify([server,owner]);
