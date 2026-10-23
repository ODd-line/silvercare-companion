import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { Pressable, View, StyleSheet, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { palette } from '@/components/member-ui';

export default function AppTabs() {
  const { width } = useWindowDimensions();
  return (
    <Tabs style={{ flex: 1, flexDirection: width < 600 ? 'column-reverse' : 'column' }}>
      <TabList asChild>
        <CustomTabList showBrand={width >= 600}>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="exchange" href="/exchange" asChild>
            <TabButton>Community</TabButton>
          </TabTrigger>
          <TabTrigger name="ledger" href="/ledger" asChild>
            <TabButton>My Time</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Watch</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
      <TabSlot style={{ flex: 1 }} />
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  return (
    <Pressable {...props} accessibilityRole="tab" aria-selected={isFocused} accessibilityState={{ selected: isFocused }}
      style={({ pressed }) => [styles.tabButton, isFocused && styles.tabButtonFocused, pressed && styles.pressed]}>
      <Text style={[styles.tabText, isFocused && styles.tabTextFocused]}>{children}</Text>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps & { showBrand?: boolean }) {
  return (
    <SafeAreaView {...props} accessibilityRole="tablist" accessibilityLabel="Main navigation"
      edges={props.showBrand ? [] : ['bottom']} style={styles.tabListContainer}>
      <View style={styles.innerContainer}>
        {props.showBrand && <Text style={styles.brandText}>Silver Bank</Text>}
        {props.children}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    width: '100%',
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    backgroundColor: palette.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: palette.line,
  },
  innerContainer: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    flexGrow: 1,
    gap: 4,
    maxWidth: 1000,
  },
  brandText: {
    marginRight: 'auto',
    color: palette.blue,
    fontSize: 18,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.7,
  },
  tabButton: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, borderRadius: 10 },
  tabButtonFocused: { backgroundColor: palette.paleBlue },
  tabText: { color: palette.muted, fontSize: 14, fontWeight: '700', textAlign: 'center' },
  tabTextFocused: { color: palette.blue },
});
