export const SILVERCARE_BLE_SERVICE_UUID = '7c9a1000-6f52-4f18-a3d1-8f3d3a79c001';
export const SILVERCARE_SNAPSHOT_CHARACTERISTIC_UUID = '7c9a1001-6f52-4f18-a3d1-8f3d3a79c001';
export const SILVERCARE_COMMAND_CHARACTERISTIC_UUID = '7c9a1002-6f52-4f18-a3d1-8f3d3a79c001';
export const SILVERCARE_HEALTH_TELEMETRY_CHARACTERISTIC_UUID = '7c9a1003-6f52-4f18-a3d1-8f3d3a79c001';

export type HealthMetricKind = 'heart-rate-bpm' | 'step-count' | 'cadence-spm' | 'gait-symmetry-percent';

export type WatchHealthEvent = {
  protocolVersion: 1;
  kind: HealthMetricKind;
  qualityPercent: number;
  sequence: number;
  bootSessionId: string;
  observedAtEpochMs: number;
  value: number;
};

export type BluetoothDeviceRecord = {
  id: string;
  name: string;
  kind: 'watch' | 'insoles' | 'unknown';
  signal: number | null;
  connected: boolean;
};

export type BluetoothAdapter = {
  supported: boolean;
  demo: boolean;
  scan: (onDevice: (device: BluetoothDeviceRecord) => void, onError: (message: string) => void) => Promise<void>;
  stopScan: () => void;
  connect: (id: string) => Promise<BluetoothDeviceRecord>;
  monitorHealth: (id: string, onEvent: (event: WatchHealthEvent) => void, onError: (message: string) => void) => () => void;
  acknowledgeHealth: (id: string, event: WatchHealthEvent) => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  destroy: () => void;
};