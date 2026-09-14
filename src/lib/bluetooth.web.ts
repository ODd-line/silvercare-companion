import type { BluetoothAdapter, BluetoothDeviceRecord } from './bluetooth-contract';

const DEMO_DEVICES: BluetoothDeviceRecord[] = [
  { id: 'demo-watch', name: 'Mastro SilverCare Watch', kind: 'watch', signal: -48, connected: false },
  { id: 'demo-insoles', name: 'SilverCare Gait Insoles', kind: 'insoles', signal: -61, connected: false },
];

export function createBluetoothAdapter(): BluetoothAdapter {
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const clearTimers = () => {
    timers.forEach((timer) => clearTimeout(timer));
    timers.clear();
  };
  return {
    supported: false,
    demo: true,
    scan: async (onDevice) => {
      clearTimers();
      DEMO_DEVICES.forEach((device, index) => {
        const timer = setTimeout(() => {
          timers.delete(timer);
          onDevice(device);
        }, 250 + index * 300);
        timers.add(timer);
      });
    },
    stopScan: clearTimers,
    connect: async (id) => {
      const device = DEMO_DEVICES.find((candidate) => candidate.id === id);
      if (!device) throw new Error('Demo device was not found.');
      return { ...device, connected: true };
    },
    disconnect: async () => undefined,
    destroy: clearTimers,
  };
}

export {
  SILVERCARE_BLE_SERVICE_UUID,
  SILVERCARE_COMMAND_CHARACTERISTIC_UUID,
  SILVERCARE_SNAPSHOT_CHARACTERISTIC_UUID,
} from './bluetooth-contract';
export type { BluetoothAdapter, BluetoothDeviceRecord } from './bluetooth-contract';