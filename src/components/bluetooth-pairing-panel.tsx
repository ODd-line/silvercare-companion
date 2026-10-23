import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { createBluetoothAdapter } from '@/lib/bluetooth';
import { BluetoothDeviceRecord, SILVERCARE_BLE_SERVICE_UUID } from '@/lib/bluetooth-contract';
import { useTimeBank } from '@/providers/time-bank-provider';
import { ui } from '@/components/member-ui';

export function BluetoothPairingPanel() {
  const { width } = useWindowDimensions();
  const compact = width < 520;
  const { setWatchConnected } = useTimeBank();
  const [adapter] = useState(createBluetoothAdapter);
  const [devices, setDevices] = useState<BluetoothDeviceRecord[]>([]);
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scanned, setScanned] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (scanTimer.current) clearTimeout(scanTimer.current);
      adapter.destroy();
      setWatchConnected(false);
    };
  }, [adapter, setWatchConnected]);

  const scan = async () => {
    setDevices([]);
    setError(null);
    setScanning(true);
    setScanned(true);
    if (scanTimer.current) clearTimeout(scanTimer.current);
    try {
      await adapter.scan(
        (device) => {
          if (device.kind !== 'watch') return;
          setDevices((current) => current.some((item) => item.id === device.id)
            ? current.map((item) => item.id === device.id ? device : item)
            : [...current, device]);
        },
        (message) => {
          setScanning(false);
          setError(message);
        },
      );
      scanTimer.current = setTimeout(() => {
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
        setWatchConnected(false);
      } else {
        const connectedDevice = await adapter.connect(device.id);
        setDevices((current) => current.map((item) => item.id === device.id ? connectedDevice : item));
        setWatchConnected(true);
      }
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not connect to this device.');
    }
  };

  return (
    <View style={ui.card}>
      <View style={[styles.headingRow, compact && styles.headingRowCompact]}>
        <View style={styles.identityRow}>
        <View style={styles.bluetoothMark}><Text style={styles.bluetoothSymbol}>B</Text></View>
        <View style={styles.headingCopy}>
          <Text style={ui.heading}>Find your watch</Text>
          <Text style={ui.caption}>{adapter.demo ? 'Simulated browser watch' : 'Bluetooth pairing'}</Text>
        </View>
        </View>
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: scanning }} disabled={scanning} onPress={scan} style={({ pressed }) => [ui.button, pressed && styles.pressed, scanning && styles.disabled]}>
          <Text style={ui.buttonText}>{scanning ? 'Searching...' : 'Find my watch'}</Text>
        </Pressable>
      </View>
      {adapter.demo && <Text style={ui.demoNotice}>This is a simulated watch. Real Bluetooth pairing requires the native app.</Text>}
      {error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      <View style={styles.deviceList}>
        {devices.map((device) => (
          <View key={device.id} style={styles.deviceRow}>
            <View style={styles.deviceIdentity}>
              <View style={[styles.kindMark, styles.watchMark]}>
                <Text style={styles.kindText}>W</Text>
              </View>
              <View style={styles.deviceCopy}>
                <Text style={ui.body}>{device.name}</Text>
                <Text style={ui.caption}>{device.connected ? 'Connected to this phone' : 'Ready to connect'}</Text>
              </View>
            </View>
            <Pressable accessibilityRole="button" onPress={() => toggleConnection(device)} style={[ui.button, device.connected && ui.secondaryButton]}>
              <Text style={[ui.buttonText, device.connected && ui.secondaryButtonText]}>{device.connected ? 'Disconnect' : 'Connect'}</Text>
            </Pressable>
          </View>
        ))}
        {scanning && <Text accessibilityLiveRegion="polite" style={ui.body}>Looking for nearby watches...</Text>}
        {!devices.length && !scanning && <Text style={ui.body}>{scanned ? 'No watch found. Keep it awake and nearby, check Bluetooth permissions, then try again.' : 'Select Find my watch to begin.'}</Text>}
      </View>
      <Pressable accessibilityRole="button" aria-expanded={showDetails} accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails((value) => !value)} style={[ui.button, ui.secondaryButton]}>
        <Text style={[ui.buttonText, ui.secondaryButtonText, { padding: 14 }]}>Technical details</Text>
      </Pressable>
      {showDetails && <View style={styles.deviceList}>
        <Text selectable style={ui.caption}>Service: {SILVERCARE_BLE_SERVICE_UUID}</Text>
        {devices.map((device) => <Text key={device.id} style={ui.caption}>{device.name}: {device.signal === null ? 'Signal unavailable' : `${device.signal} dBm`}</Text>)}
      </View>}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#171A1F', padding: 18, gap: 12 },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headingRowCompact: { flexDirection: 'column', alignItems: 'stretch' },
  identityRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  bluetoothMark: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#174EA6' },
  bluetoothSymbol: { color: '#FFFFFF', fontSize: 18, fontWeight: '900' },
  headingCopy: { flex: 1, gap: 2 },
  title: { color: '#171A1F', fontSize: 20, fontWeight: '900' },
  state: { color: '#174EA6', fontSize: 10, fontWeight: '900' },
  scanButton: { minWidth: 78, minHeight: 42, alignItems: 'center', justifyContent: 'center', backgroundColor: '#174EA6', paddingHorizontal: 13 },
  scanButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  body: { color: '#59635F', fontSize: 14, lineHeight: 20 },
  serviceId: { color: '#656761', fontSize: 9, fontWeight: '800' },
  demoNotice: { color: '#514A30', backgroundColor: '#F4C84A', padding: 11, fontSize: 12, lineHeight: 18 },
  error: { color: '#9D2E21', backgroundColor: '#F9DDD7', padding: 11, fontSize: 12 },
  deviceList: { gap: 8 },
  deviceRow: { minHeight: 68, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9DED9', paddingTop: 9 },
  deviceIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  kindMark: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  watchMark: { backgroundColor: '#DCE8F8' },
  kindText: { color: '#245466', fontSize: 12, fontWeight: '900' },
  deviceCopy: { flex: 1, gap: 2 },
  deviceName: { color: '#17211E', fontSize: 14, fontWeight: '800' },
  deviceMeta: { color: '#717A76', fontSize: 11 },
  connectButton: { minHeight: 38, justifyContent: 'center', backgroundColor: '#174EA6', paddingHorizontal: 11 },
  disconnectButton: { backgroundColor: '#F4E4E0' },
  connectText: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  disconnectText: { color: '#963929' },
  emptyText: { color: '#7A837F', fontSize: 13, paddingVertical: 7 },
  pressed: { opacity: 0.72 },
  disabled: { opacity: 0.55 },
});