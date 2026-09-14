import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { createBluetoothAdapter } from '@/lib/bluetooth';
import { BluetoothDeviceRecord, SILVERCARE_BLE_SERVICE_UUID } from '@/lib/bluetooth-contract';

export function BluetoothPairingPanel() {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const [adapter] = useState(createBluetoothAdapter);
  const [devices, setDevices] = useState<BluetoothDeviceRecord[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    return () => adapter.destroy();
  }, [adapter]);

  const scan = async () => {
    setDevices([]);
    setError(null);
    setScanning(true);
    try {
      await adapter.scan(
        (device) => {
          setDevices((current) => current.some((item) => item.id === device.id)
            ? current.map((item) => item.id === device.id ? device : item)
            : [...current, device]);
        },
        (message) => {
          setScanning(false);
          setError(message);
        },
      );
      setTimeout(() => {
        adapter.stopScan();
        setScanning(false);
      }, 6000);
    } catch (caughtError) {
      setScanning(false);
      setError(caughtError instanceof Error ? caughtError.message : 'Bluetooth scan failed.');
    }
  };

  const toggleConnection = async (device: BluetoothDeviceRecord) => {
    setError(null);
    try {
      if (device.connected) {
        await adapter.disconnect(device.id);
        setDevices((current) => current.map((item) => item.id === device.id ? { ...item, connected: false } : item));
      } else {
        const connectedDevice = await adapter.connect(device.id);
        setDevices((current) => current.map((item) => item.id === device.id ? connectedDevice : item));
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not connect to this device.');
    }
  };

  return (
    <View style={styles.section}>
      <View style={[styles.headingRow, compact && styles.headingRowCompact]}>
        <View style={styles.identityRow}>
        <View style={styles.bluetoothMark}><Text style={styles.bluetoothSymbol}>B</Text></View>
        <View style={styles.headingCopy}>
          <Text style={styles.title}>Bluetooth pairing</Text>
          <Text style={styles.state}>{adapter.demo ? 'WEB DEMO' : 'NATIVE BLE'}</Text>
        </View>
        </View>
        <Pressable accessibilityRole="button" disabled={scanning} onPress={scan} style={({ pressed }) => [styles.scanButton, pressed && styles.pressed, scanning && styles.disabled]}>
          <Text style={styles.scanButtonText}>{scanning ? 'Scanning...' : 'Scan'}</Text>
        </Pressable>
      </View>
      <Text style={styles.body}>Find nearby Mastro watches and gait insoles advertising the SilverCare service.</Text>
      <Text accessibilityLabel={`SilverCare service UUID ${SILVERCARE_BLE_SERVICE_UUID}`} style={styles.serviceId}>SERVICE UUID 7c9a1000...79c001</Text>
      {adapter.demo && <Text style={styles.demoNotice}>Browser preview uses simulated devices. Install a native development build for real Bluetooth scanning.</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
      <View style={styles.deviceList}>
        {devices.map((device) => (
          <View key={device.id} style={styles.deviceRow}>
            <View style={styles.deviceIdentity}>
              <View style={[styles.kindMark, device.kind === 'watch' ? styles.watchMark : styles.insoleMark]}>
                <Text style={styles.kindText}>{device.kind === 'watch' ? 'W' : 'G'}</Text>
              </View>
              <View style={styles.deviceCopy}>
                <Text style={styles.deviceName}>{device.name}</Text>
                <Text style={styles.deviceMeta}>{device.signal === null ? 'Signal unavailable' : `${device.signal} dBm`} · {device.connected ? 'Connected' : 'Available'}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => toggleConnection(device)} style={[styles.connectButton, device.connected && styles.disconnectButton]}>
              <Text style={[styles.connectText, device.connected && styles.disconnectText]}>{device.connected ? 'Disconnect' : 'Connect'}</Text>
            </Pressable>
          </View>
        ))}
        {!devices.length && !scanning && <Text style={styles.emptyText}>No devices discovered yet.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 8, padding: 18, gap: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingRowCompact: { flexDirection: 'column', alignItems: 'stretch' },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bluetoothMark: { width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#285D78' },
  bluetoothSymbol: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  headingCopy: { flex: 1, gap: 2 },
  title: { color: '#17211E', fontSize: 20, fontWeight: '800' },
  state: { color: '#285D78', fontSize: 10, fontWeight: '900' },
  scanButton: { minWidth: 78, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#116A58', borderRadius: 6, paddingHorizontal: 13 },
  scanButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  body: { color: '#59635F', fontSize: 14, lineHeight: 20 },
  serviceId: { color: '#7A837F', fontSize: 9, fontWeight: '800' },
  demoNotice: { color: '#76571F', backgroundColor: '#F7EACD', borderRadius: 5, padding: 11, fontSize: 12, lineHeight: 18 },
  error: { color: '#9D2E21', backgroundColor: '#F9DDD7', borderRadius: 5, padding: 11, fontSize: 12 },
  deviceList: { gap: 8 },
  deviceRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9DED9', paddingTop: 9 },
  deviceIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindMark: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  watchMark: { backgroundColor: '#DDEAF0' },
  insoleMark: { backgroundColor: '#DDECE6' },
  kindText: { color: '#245466', fontSize: 12, fontWeight: '900' },
  deviceCopy: { flex: 1, gap: 2 },
  deviceName: { color: '#17211E', fontSize: 14, fontWeight: '800' },
  deviceMeta: { color: '#717A76', fontSize: 11 },
  connectButton: { minHeight: 38, justifyContent: 'center', borderRadius: 5, backgroundColor: '#E7F1EC', paddingHorizontal: 11 },
  disconnectButton: { backgroundColor: '#F4E4E0' },
  connectText: { color: '#116A58', fontSize: 12, fontWeight: '800' },
  disconnectText: { color: '#963929' },
  emptyText: { color: '#7A837F', fontSize: 13, paddingVertical: 7 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});