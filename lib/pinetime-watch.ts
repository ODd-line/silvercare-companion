export const WATCH_CHANNELS = {
  battery: {service: '0000180f-0000-1000-8000-00805f9b34fb', characteristic: '00002a19-0000-1000-8000-00805f9b34fb'},
  steps: {service: '00030000-78fc-48fe-8e23-433b3a1942d0', characteristic: '00030001-78fc-48fe-8e23-433b3a1942d0'},
  heartRate: {service: '0000180d-0000-1000-8000-00805f9b34fb', characteristic: '00002a37-0000-1000-8000-00805f9b34fb'},
} as const;

export type Channel = keyof typeof WATCH_CHANNELS;
export type WatchDevice = {deviceId: string; name?: string};
export type Reading = {value: number; receivedAt: number; deviceId: string};
export const WATCH_READING_MAX_AGE = {battery: 30000, steps: 30000, heartRate: 15000} as const;
export const WATCH_HEART_CONTROL = '7c9a1013-6f52-4f18-a3d1-8f3d3a79c001';
const sensingPhases=['idle','queued','warming','collecting','complete','no-reading','cancelled'] as const;
export type WatchSensingState={phase:typeof sensingPhases[number]|'unavailable';nextAt?:number;error?:string;periodic?:boolean};
export function decodeSensingState(packet:DataView,now:number):WatchSensingState{
  const legacy=packet.byteLength===4&&packet.getUint8(0)===1;
  const scheduled=packet.byteLength===5&&packet.getUint8(0)===2&&packet.getUint8(4)<=1;
  if((!legacy&&!scheduled)||packet.getUint8(1)>=sensingPhases.length||packet.getUint16(2,true)>900)
    throw Error('Unsupported automatic-sensing response. Compatible Mastro firmware is required.');
  return {phase:sensingPhases[packet.getUint8(1)],nextAt:now+packet.getUint16(2,true)*1000,...(scheduled?{periodic:packet.getUint8(4)===1}:{})};
}
export type WatchState = {
  phase: 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';
  connectionStage?: 'initializing' | 'selecting' | 'discovering' | 'subscribing' | 'reading';
  device?: WatchDevice;
  readings: Partial<Record<Channel, Reading>>;
  refreshErrors?: Partial<Record<Channel, string>>;
  error?: string;
  sensing?:WatchSensingState;
};
export interface WatchBluetooth {
  initialize(options: {androidNeverForLocation: boolean}): Promise<void>;
  requestDevice(options: {services: string[]; optionalServices: string[]; displayMode: 'list'}): Promise<WatchDevice>;
  connect(id: string, disconnected: () => void, options: {timeout: number}): Promise<void>;
  disconnect(id: string): Promise<void>;
  read(id: string, service: string, characteristic: string): Promise<DataView>;
  write?(id:string,service:string,characteristic:string,packet:DataView,options?:{timeout:number}):Promise<void>;
  startNotifications(id: string, service: string, characteristic: string, listener: (packet: DataView, receivedAt?:number) => void): Promise<void>;
  stopNotifications(id: string, service: string, characteristic: string): Promise<void>;
  configureHistory?(options:WatchHistoryPermission):Promise<void>;
  history?:WatchHistoryRepository;
}

export function decodeReading(channel: Channel, packet: DataView): number | null {
  if (channel === 'steps') {
    if (packet.byteLength !== 4) throw Error('Invalid step-count packet');
    return packet.getUint32(0, true);
  }
  if (channel === 'battery') {
    if (packet.byteLength !== 1 || packet.getUint8(0) > 100) throw Error('Invalid battery packet');
    return packet.getUint8(0);
  }
  if (packet.byteLength < 2) throw Error('Invalid heart-rate packet');
  const flags = packet.getUint8(0);
  const minimum = 2 + (flags & 1) + (flags & 8 ? 2 : 0);
  if ((flags & 0xe0) || ((flags & 4) !== 0 && (flags & 2) === 0) || packet.byteLength < minimum ||
      ((flags & 16) ? packet.byteLength < minimum + 2 || (packet.byteLength - minimum) % 2 !== 0 : packet.byteLength !== minimum)) {
    throw Error('Invalid heart-rate packet');
  }
  const value = flags & 1 ? packet.getUint16(1, true) : packet.getUint8(1);
  if (value > 300) throw Error('Invalid heart-rate value');
  return value === 0 || ((flags & 2) !== 0 && (flags & 4) === 0) ? null : value;
}

export class PineTimeWatch {
  private generation = 0;
  private device?: WatchDevice;
  private remembered?: WatchDevice;
  private channels: Channel[] = [];
  private revisions: Partial<Record<Channel, number>> = {};
  private opening = false;
  private closing?: Promise<void>;
  private refreshing = false;
  private automaticMeasurement=false;
  private sensingGeneration=0;
  private sensingBusy=false;
  private sensingBlocked=false;
  private sensingAvailable=false;
  private nextMeasurementAt=0;
  private backgroundScope?:string;
  private historyScope?:string;
  private backgroundReady=false;
  private state: WatchState = {phase: 'idle', readings: {}};
  private readonly bluetooth: WatchBluetooth;
  private readonly changed: (state: WatchState) => void;
  private readonly now: () => number;

  constructor(bluetooth: WatchBluetooth, changed: (state: WatchState) => void, now: () => number = Date.now) {
    this.bluetooth = bluetooth;this.changed = changed;this.now = now;
  }

  private publish(state: WatchState) {
    this.state = state;
    this.changed({...state, readings: {...state.readings}, refreshErrors: {...state.refreshErrors}});
  }

  private receive(channel: Channel, packet: DataView, device: WatchDevice, receivedAt=this.now()) {
    if(!Number.isFinite(receivedAt)||receivedAt<=0||receivedAt>this.now()+1000)throw Error('Invalid native receipt time');
    if(this.now()-receivedAt>=WATCH_READING_MAX_AGE[channel])return;
    const value = decodeReading(channel, packet);
    const readings = {...this.state.readings};
    if (value === null) delete readings[channel];
    else readings[channel] = {value, receivedAt, deviceId: device.deviceId};
    const refreshErrors = {...this.state.refreshErrors};delete refreshErrors[channel];
    this.revisions[channel] = (this.revisions[channel] ?? 0) + 1;
    this.publish({...this.state, device, readings, refreshErrors, error: undefined});
  }

  async connect(consent: boolean, remembered?: WatchDevice) {
    if (!consent) throw Error('Watch-reading consent is required');
    if (this.opening || this.closing || this.device) throw Error('A watch connection is already active');
    this.opening = true;this.revisions = {};
    this.sensingAvailable=false;this.sensingBlocked=false;this.backgroundReady=false;
    const generation = ++this.generation;
    const current = () => generation === this.generation;
    const check = () => {if (!current()) throw Error('Connection cancelled');};
    this.publish({phase: 'connecting', connectionStage: 'initializing', readings: {}});
    let selected: WatchDevice | undefined;
    const progress = (connectionStage: WatchState['connectionStage']) => this.publish({...this.state, device: selected, connectionStage});
    const subscribed: Channel[] = [];
    let operation = 'starting Bluetooth';
    try {
      await this.bluetooth.initialize({androidNeverForLocation: true});check();
      operation = 'selecting a watch';
      progress('selecting');
      selected = remembered ?? await this.bluetooth.requestDevice({services: [WATCH_CHANNELS.heartRate.service], optionalServices: Object.values(WATCH_CHANNELS).map(value => value.service), displayMode: 'list'});check();
      const selectedId = selected.deviceId;
      operation = 'connecting to the selected watch and discovering services';
      progress('discovering');
      await this.bluetooth.connect(selectedId, () => {
        if (!current()) return;
        ++this.generation;this.device = undefined;this.channels = [];this.backgroundReady=false;this.historyScope=undefined;
        this.publish({phase: 'disconnected', device: selected, readings: {}});
      }, {timeout: 30000});check();
      const receive = (channel: Channel, packet: DataView, receivedAt?:number) => {
        if (!current()) return;
        this.receive(channel, packet, selected!,receivedAt);
      };
      for (const channel of Object.keys(WATCH_CHANNELS) as Channel[]) {
        const {service, characteristic} = WATCH_CHANNELS[channel];
        if (channel !== 'steps') {
          operation = `subscribing to ${channel}`;
          progress('subscribing');
          await this.bluetooth.startNotifications(selectedId, service, characteristic, (packet,receivedAt) => {
          try {receive(channel, packet,receivedAt);} catch {
            if (!current()) return;
            this.revisions[channel] = (this.revisions[channel] ?? 0) + 1;
            const readings = {...this.state.readings};delete readings[channel];
            this.publish({...this.state, readings, error: `Invalid ${channel} reading received`});
          }
          });
          subscribed.push(channel);check();
        }
        if (channel === 'heartRate') continue;
        const revision = this.revisions[channel] ?? 0;
        operation = `reading ${channel}`;
        progress('reading');
        const packet = await this.bluetooth.read(selectedId, service, characteristic);check();
        if (revision === (this.revisions[channel] ?? 0)) receive(channel, packet);
      }
      this.device = selected;this.remembered = selected;this.channels = subscribed;
      this.publish({...this.state, phase: 'connected', connectionStage: undefined});
      void this.syncAutomaticMeasurement();
    } catch (error) {
      const failure = new Error(`Failed while ${operation}: ${error instanceof Error ? error.message : 'Watch connection failed'}`);
      if (selected) {
        for (const channel of subscribed) {
          const {service, characteristic} = WATCH_CHANNELS[channel];
          await this.bluetooth.stopNotifications(selected.deviceId, service, characteristic).catch(() => {});
        }
        await this.bluetooth.disconnect(selected.deviceId).catch(() => {});
      }
      if (current()) {
        ++this.generation;this.device = undefined;this.channels = [];
        this.publish({phase: 'error', readings: {}, error: failure.message});
      }
      throw failure;
    } finally {this.opening = false;}
  }

  async reconnect(consent: boolean) {
    if (!this.remembered) throw Error('Select a watch first');
    return this.connect(consent, this.remembered);
  }

  async disconnect(forget = true) {
    if (forget) this.remembered = undefined;
    if (this.closing) return this.closing;
    ++this.generation;
    const device = this.device, channels = this.channels;
    const stopSensing=this.sensingAvailable;
    const historyScope=this.historyScope;
    this.backgroundReady=false;this.historyScope=undefined;
    this.sensingAvailable=false;
    this.device = undefined;this.channels = [];
    this.publish({phase: 'idle', readings: {}});
    this.closing = (async () => {
      if (!device) return;
      if(historyScope&&this.bluetooth.configureHistory){
        try{await this.bluetooth.configureHistory({scope:historyScope,deviceId:device.deviceId,enabled:false});}
        catch{this.publish({...this.state,error:'Could not turn off on-phone recording. Disconnect Bluetooth before changing accounts.'});}
      }
      if(stopSensing&&this.bluetooth.write){
        try{await this.bluetooth.write(device.deviceId,WATCH_CHANNELS.heartRate.service,WATCH_HEART_CONTROL,new DataView(Uint8Array.of(1,0).buffer),{timeout:30000});}
        catch{this.publish({...this.state,error:'Could not send the sensing stop command. Disconnecting Bluetooth; the watch also has a 60-second sensing limit.'});}
      }
      for (const channel of channels) {
        const {service, characteristic} = WATCH_CHANNELS[channel];
        await this.bluetooth.stopNotifications(device.deviceId, service, characteristic).catch(() => {});
      }
      await this.bluetooth.disconnect(device.deviceId).catch(() => {});
    })();
    try {await this.closing;} finally {this.closing = undefined;}
  }

  async setAutomaticMeasurement(enabled:boolean){
    if(this.automaticMeasurement===enabled)return;
    this.automaticMeasurement=enabled;this.sensingGeneration++;this.sensingBlocked=false;
    if(enabled){await this.syncAutomaticMeasurement();return;}
    const device=this.device,generation=this.generation;
    this.backgroundReady=false;
    if(device&&this.sensingAvailable&&this.bluetooth.write){
      try{
        await this.bluetooth.write(device.deviceId,WATCH_CHANNELS.heartRate.service,WATCH_HEART_CONTROL,new DataView(Uint8Array.of(1,0).buffer),{timeout:30000});
        if(generation===this.generation)this.publish({...this.state,sensing:{phase:'cancelled'}});
      }catch(failure){
        if(generation===this.generation)this.publish({...this.state,sensing:{phase:'unavailable',error:`Could not stop watch sensing: ${failure instanceof Error?failure.message:'Bluetooth write failed'}. Disconnect the watch; its sensing session is capped at 60 seconds.`}});
      }
    }else{
      this.publish({...this.state,sensing:undefined});
    }
  }

  async retryAutomaticMeasurement(){
    this.sensingBlocked=false;
    await this.syncAutomaticMeasurement();
  }

  canRunInBackground(){return this.backgroundReady;}
  clearLiveReadings(){this.publish({...this.state,readings:{}});}

  async setBackgroundHistory(scope:string|undefined){
    if(this.backgroundScope===scope)return;
    this.backgroundScope=scope;this.backgroundReady=false;this.sensingGeneration++;this.sensingBlocked=false;
    const device=this.device,historyScope=this.historyScope;
    const generation=this.generation,sensingGeneration=this.sensingGeneration;
    const current=()=>generation===this.generation&&sensingGeneration===this.sensingGeneration;
    if(!scope&&device){
      try{
        if(historyScope&&this.bluetooth.configureHistory)
          await this.bluetooth.configureHistory({scope:historyScope,deviceId:device.deviceId,enabled:false});
        if(!current())return;
        this.historyScope=undefined;
        if(this.sensingAvailable&&this.bluetooth.write)
          await this.bluetooth.write(device.deviceId,WATCH_CHANNELS.heartRate.service,WATCH_HEART_CONTROL,new DataView(Uint8Array.of(1,0).buffer),{timeout:30000});
      }catch(failure){
        if(!current())return;
        this.publish({...this.state,sensing:{phase:'unavailable',error:`Could not disable background sensing: ${failure instanceof Error?failure.message:'Bluetooth failed'}. Disconnect Bluetooth to stop.`}});
        return;
      }
    }
    if(current())await this.syncAutomaticMeasurement();
  }

  private async syncAutomaticMeasurement(){
    const device=this.device,generation=this.generation,sensingGeneration=this.sensingGeneration;
    if(!this.automaticMeasurement||!device||this.state.phase!=='connected'||this.sensingBusy||this.sensingBlocked)return;
    const current=()=>generation===this.generation&&sensingGeneration===this.sensingGeneration&&this.automaticMeasurement;
    this.sensingBusy=true;
    try{
      if(!this.bluetooth.write)throw Error('This Bluetooth receiver cannot send sensing commands.');
      const packet=await this.bluetooth.read(device.deviceId,WATCH_CHANNELS.heartRate.service,WATCH_HEART_CONTROL);
      if(!current())return;
      const sensing=decodeSensingState(packet,this.now());
      this.sensingAvailable=true;
      const nextAt=Math.max(sensing.nextAt??0,this.nextMeasurementAt);
      this.publish({...this.state,sensing:{...sensing,nextAt}});
      if(this.backgroundScope){
        if(sensing.periodic===undefined)throw Error('Background sensing requires Mastro 0.1.13 or newer.');
        if(!this.bluetooth.configureHistory)throw Error('Background history requires the updated iPhone app.');
        const scope=this.backgroundScope;
        if(this.historyScope!==scope){
          await this.bluetooth.configureHistory({scope,deviceId:device.deviceId,deviceName:device.name,enabled:true});
          if(!current()){
            await this.bluetooth.configureHistory({scope,deviceId:device.deviceId,enabled:false});
            return;
          }
          this.historyScope=scope;
        }
        if(!sensing.periodic){
          await this.bluetooth.write(device.deviceId,WATCH_CHANNELS.heartRate.service,WATCH_HEART_CONTROL,new DataView(Uint8Array.of(2,2).buffer),{timeout:30000});
          if(!current())return;
        }
        this.backgroundReady=true;
        this.publish({...this.state,sensing:{...sensing,periodic:true,nextAt}});
        return;
      }
      if(sensing.periodic){
        await this.bluetooth.write(device.deviceId,WATCH_CHANNELS.heartRate.service,WATCH_HEART_CONTROL,new DataView(Uint8Array.of(1,0).buffer),{timeout:30000});
        if(!current())return;
      }
      if(nextAt>this.now()||['queued','warming','collecting'].includes(sensing.phase))return;
      await this.bluetooth.write(device.deviceId,WATCH_CHANNELS.heartRate.service,WATCH_HEART_CONTROL,new DataView(Uint8Array.of(1,1).buffer),{timeout:30000});
      if(!current())return;
      this.nextMeasurementAt=this.now()+15*60*1000;
      this.publish({...this.state,sensing:{phase:'queued',nextAt:this.nextMeasurementAt}});
    }catch(failure){
      if(!current())return;
      this.sensingBlocked=true;
      this.publish({...this.state,sensing:{phase:'unavailable',error:`Automatic heart-rate sensing is unavailable: ${failure instanceof Error?failure.message:'Bluetooth command failed'}. Check compatible Mastro firmware and Bluetooth pairing, then retry. Manual watch sensing is still available.`}});
    }finally{this.sensingBusy=false;}
  }

  async refresh() {
    const device = this.device, generation = this.generation;
    if (!device || this.state.phase !== 'connected' || this.refreshing) return;
    this.refreshing = true;
    try {for (const channel of Object.keys(WATCH_CHANNELS) as Channel[]) {
      if (channel === 'heartRate') continue;
      const revision = this.revisions[channel] ?? 0;
      const {service, characteristic} = WATCH_CHANNELS[channel];
      try {
        const packet = await this.bluetooth.read(device.deviceId, service, characteristic);
        if (generation !== this.generation) return;
        if (revision === (this.revisions[channel] ?? 0)) this.receive(channel, packet, device);
      } catch {
        if (generation !== this.generation) return;
        if (revision !== (this.revisions[channel] ?? 0)) continue;
        this.publish({...this.state, refreshErrors: {...this.state.refreshErrors, [channel]: `Could not refresh ${channel}`}});
      }
    }
    if(generation===this.generation)await this.syncAutomaticMeasurement();
    } finally {this.refreshing = false;}
  }
}
import type {WatchHistoryPermission,WatchHistoryRepository} from './watch-history-native';