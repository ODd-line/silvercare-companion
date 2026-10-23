import { NativeTabs } from 'expo-router/unstable-native-tabs';
import { palette } from '@/components/member-ui';

export default function AppTabs() {
  return (
    <NativeTabs
      backgroundColor={palette.paper}
      tintColor={palette.blue}
      indicatorColor={palette.paleBlue}
      labelStyle={{ color: palette.muted, selected: { color: palette.blue } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="exchange">
        <NativeTabs.Trigger.Label>Community</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.2" md="people" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="ledger">
        <NativeTabs.Trigger.Label>My Time</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="clock" md="schedule" />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="explore">
        <NativeTabs.Trigger.Label>Watch</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="applewatch" md="watch" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
