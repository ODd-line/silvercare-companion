import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, State, Subscription } from 'react-native-ble-plx';

import {
  BluetoothAdapter,
  BluetoothDeviceRecord,
  SILVERCARE_BLE_SERVICE_UUID,
  SILVERCARE_COMMAND_CHARACTERISTIC_UUID,
  SILVERCARE_HEALTH_TELEMETRY_CHARACTERISTIC_UUID,
  SILVERCARE_SNAPSHOT_CHARACTERISTIC_UUID,
} from './bluetooth-contract';
import { decodeBase64HealthTelemetry, encodeHealthAcknowledgementBase64 } from './health-telemetry';

export {
  SILVERCARE_BLE_SERVICE_UUID,
  SILVERCARE_COMMAND_CHARACTERISTIC_UUID,
  SILVERCARE_HEALTH_TELEMETRY_CHARACTERISTIC_UUID,
  SILVERCARE_SNAPSHOT_CHARACTERISTIC_UUID,
} from './bluetooth-contract';
export type { BluetoothAdapter, BluetoothDeviceRecord } from './bluetooth-contract';

function classifyDevice(name: string): BluetoothDeviceRecord['kind'] {
  const normalized = name.toLowerCase();
  if (normalized.includes('mastro') || normalized.includes('watch')) return 'watch';
  if (normalized.includes('insole') || normalized.includes('gait')) return 'insoles';
  return 'unknown';
}

function toRecord(device: Device, connected = false): BluetoothDeviceRecord {
  const name = device.localName || device.name || 'SilverCare device';
  return { id: device.id, name, kind: classifyDevice(name), signal: device.rssi, connected };
}

async function requestBluetoothPermission() {
  if (Platform.OS !== 'android') return true;
  if (Number(Platform.Version) < 31) {
    return (await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION)) === PermissionsAndroid.RESULTS.GRANTED;
  }
  const result = await PermissionsAndroid.requestMultiple([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
  ]);
  return result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN] === PermissionsAndroid.RESULTS.GRANTED
    && result[PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT] === PermissionsAndroid.RESULTS.GRANTED;
}

export function createBluetoothAdapter(): BluetoothAdapter {
  const manager = new BleManager();
  let stateSubscription: Subscription | null = null;

  const waitUntilPoweredOn = () => new Promise<void>((resolve, reject) => {
    stateSubscription?.remove();
    stateSubscription = manager.onStateChange((state) => {
      if (state === State.PoweredOn) {
        stateSubscription?.remove();
        stateSubscription = null;
        resolve();
      } else if (state === State.Unsupported || state === State.Unauthorized || state === State.PoweredOff) {
        stateSubscription?.remove();
        stateSubscription = null;
        reject(new Error(state === State.PoweredOff ? 'Turn on Bluetooth to scan.' : 'Bluetooth is unavailable or not authorized.'));
      }
    }, true);
  });

  return {
    supported: true,
    demo: false,
    scan: async (onDevice, onError) => {
      if (!(await requestBluetoothPermission())) throw new Error('Bluetooth permission is required to scan for SilverCare devices.');
      await waitUntilPoweredOn();
      manager.startDeviceScan([SILVERCARE_BLE_SERVICE_UUID], { allowDuplicates: false }, (error, device) => {
        if (error) {
          manager.stopDeviceScan();
          onError(error.message || 'Bluetooth scan failed.');
          return;
        }
        if (device) onDevice(toRecord(device));
      });
    },
    stopScan: () => manager.stopDeviceScan(),
    connect: async (id) => {
      manager.stopDeviceScan();
      const device = await manager.connectToDevice(id, { timeout: 12000 });
      const readyDevice = await device.discoverAllServicesAndCharacteristics();
      await readyDevice.readCharacteristicForService(
        SILVERCARE_BLE_SERVICE_UUID,
        SILVERCARE_SNAPSHOT_CHARACTERISTIC_UUID,
      );
      return toRecord(readyDevice, true);
    },
    monitorHealth: (id, onEvent, onError) => {
      const subscription = manager.monitorCharacteristicForDevice(
        id,
        SILVERCARE_BLE_SERVICE_UUID,
        SILVERCARE_HEALTH_TELEMETRY_CHARACTERISTIC_UUID,
        (error, characteristic) => {
          if (error) {
            onError(error.message || 'Health telemetry connection failed.');
            return;
          }
          if (!characteristic?.value) return;
          try {
            onEvent(decodeBase64HealthTelemetry(characteristic.value));
          } catch (decodeError) {
            onError(decodeError instanceof Error ? decodeError.message : 'Invalid health telemetry packet.');
          }
        },
      );
      return () => subscription.remove();
    },
    acknowledgeHealth: async (id, event) => {
      await manager.writeCharacteristicWithResponseForDevice(
        id,
        SILVERCARE_BLE_SERVICE_UUID,
        SILVERCARE_COMMAND_CHARACTERISTIC_UUID,
        encodeHealthAcknowledgementBase64(event),
      );
    },
    disconnect: async (id) => {
      await manager.cancelDeviceConnection(id);
    },
    destroy: () => {
      stateSubscription?.remove();
      manager.stopDeviceScan();
      manager.destroy();
    },
  };
}