import { Text, View } from 'react-native';

import { BluetoothPairingPanel } from '@/components/bluetooth-pairing-panel';
import { DemoNotice, MemberHeader, MemberPage, ui } from '@/components/member-ui';
import { useTimeBank } from '@/providers/time-bank-provider';

export default function WatchScreen() {
  const { watchConnected } = useTimeBank();
  return (
    <MemberPage>
      <MemberHeader title="Your watch" subtitle="A convenient companion. Your phone works without it." />
      <DemoNotice />
      <View style={ui.card}>
        <Text accessibilityRole="header" style={ui.heading}>{watchConnected ? 'Watch connected' : 'Connect your Mastro watch'}</Text>
        <Text style={ui.body}>{watchConnected
          ? 'Your watch is connected to this phone. Time Bank task syncing is not available yet.'
          : '1. Turn on your watch.\n2. Keep it near your phone.\n3. Allow Bluetooth access when prompted.\n4. Find and select your watch below.'}</Text>
      </View>
      <BluetoothPairingPanel />
      <View style={ui.card}>
        <Text accessibilityRole="header" style={ui.heading}>What works today?</Text>
        <Text style={ui.body}>Real Bluetooth discovery and pairing work in a native development build. The browser uses a simulated watch.</Text>
        <Text style={ui.body}>Task actions, queued-action delivery, and balance syncing are not enabled in the current watch protocol. Connecting does not mean a task has reached the service.</Text>
      </View>
      <View style={ui.card}>
        <Text accessibilityRole="header" style={ui.heading}>Having trouble connecting?</Text>
        <Text style={ui.body}>Check that Bluetooth is on, the watch is awake and nearby, and this app has Bluetooth permission. Then try finding your watch again.</Text>
        <Text style={ui.caption}>You can continue using all demo task actions on your phone.</Text>
      </View>
    </MemberPage>
  );
}
