import { PropsWithChildren, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/providers/account-provider';
import { formatDuration, formatTaskDate, TASK_STATUS, TimeBankTask, useTimeBank } from '@/providers/time-bank-provider';

export const palette = {
  paper: '#F7F4EC', white: '#FFFFFF', ink: '#171A1F', muted: '#565B57',
  blue: '#174EA6', paleBlue: '#EAF0FA', line: '#D6D8D0',
  amber: '#76530B', paleAmber: '#FFF2CB', red: '#9D2E21',
};

export function ActionButton({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable accessibilityRole="button" aria-disabled={disabled} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
      style={({ pressed }) => [ui.button, secondary && ui.secondaryButton, disabled && ui.disabled, pressed && ui.pressed]}>
      <Text style={[ui.buttonText, secondary && ui.secondaryButtonText]}>{label}</Text>
    </Pressable>
  );
}

export function DemoNotice() {
  return <Text style={ui.demoNotice}>Demo workspace. Tasks and time stay in this session only; no real credits are transferred.</Text>;
}

export function MemberPage({ children }: PropsWithChildren) {
  return (
    <SafeAreaView style={ui.screen} edges={['top']}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Sheet({ title, onClose, children }: PropsWithChildren<{ title: string; onClose: () => void }>) {
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView role="dialog" aria-modal accessibilityLabel={title} style={ui.screen}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={ui.page}>
          <View style={ui.header}>
            <Text accessibilityRole="header" style={[ui.heading, ui.flex]}>{title}</Text>
            <ActionButton label="Close" onPress={onClose} secondary />
          </View>
          {children}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

export function MemberHeader({ title, subtitle }: { title: string; subtitle: string }) {
  const [accountOpen, setAccountOpen] = useState(false);
  const { profile, startProfileEdit, signOut, error } = useAccount();
  return (
    <>
      <View style={ui.header}>
        <View style={ui.flex}>
          <Text style={ui.brand}>Silver Bank</Text>
          <Text accessibilityRole="header" style={ui.title}>{title}</Text>
          <Text style={ui.body}>{subtitle}</Text>
        </View>
        <ActionButton label="Account" onPress={() => setAccountOpen(true)} secondary />
      </View>
      {accountOpen && <Sheet title="Your account" onClose={() => setAccountOpen(false)}>
        <View style={ui.card}>
          <Text style={ui.heading}>{profile?.full_name ?? 'Member'}</Text>
          <Text style={ui.body}>{profile?.phone || 'No phone number added'}</Text>
          <Text style={ui.body}>Your trusted contact helps with setup. They cannot move your time credits.</Text>
        </View>
        <ActionButton label="Edit membership details" onPress={() => { setAccountOpen(false); startProfileEdit(); }} />
        <ActionButton label="Sign out" onPress={() => { void signOut(); }} secondary />
        {error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
      </Sheet>}
    </>
  );
}

export function TaskCard({ task, onOpen }: { task: TimeBankTask; onOpen: () => void }) {
  return (
    <View style={ui.card}>
      <View style={ui.wrapRow}>
        <Text style={ui.category}>{task.category} · {formatDuration(task.durationSeconds)}</Text>
        <Text style={ui.badge}>{TASK_STATUS[task.state]}</Text>
      </View>
      <Text accessibilityRole="header" style={ui.heading}>{task.title}</Text>
      <Text style={ui.body}>{formatTaskDate(task.startsAt)}</Text>
      <Text style={ui.body}>{task.direction === 'give' ? `Helping ${task.memberName}` : 'Your request'} · {task.location}</Text>
      <ActionButton label="View task" onPress={onOpen} secondary />
    </View>
  );
}

export function TaskDetails({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { tasks, acceptTask, advanceTask, confirmTask, cancelTask } = useTimeBank();
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const task = tasks.find((candidate) => candidate.id === taskId);
  const act = (action: () => void) => {
    try {
      action();
      setError(null);
      setCancelling(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'The task could not be updated. Please try again.');
    }
  };
  if (!task) return <Sheet title="Task unavailable" onClose={onClose}><Text accessibilityRole="alert" style={ui.error}>This task is no longer available.</Text></Sheet>;
  const awaiting = task.state === 'awaiting-confirmation';
  return (
    <Sheet title="Task details" onClose={onClose}>
      <DemoNotice />
      <View style={ui.card}>
        <Text style={ui.badge}>{TASK_STATUS[task.state]}</Text>
        <Text accessibilityRole="header" style={ui.title}>{task.title}</Text>
        <Text style={ui.body}>{formatTaskDate(task.startsAt)}</Text>
        <Text style={ui.body}>{task.location}</Text>
        <Text style={ui.body}>{task.direction === 'give' ? `Helping ${task.memberName}` : `Helper: ${task.memberName}`}</Text>
        <Text style={ui.body}>{task.description}</Text>
        <Text style={ui.category}>Agreed time: {formatDuration(task.durationSeconds)}</Text>
      </View>
      {awaiting && <View style={ui.attention}>
        <Text style={ui.heading}>Review before confirming</Text>
        <Text style={ui.body}>{formatDuration(task.durationSeconds)} will be {task.direction === 'give' ? 'added to' : 'taken from'} your demo balance after both confirmations.</Text>
        <Text style={ui.body}>Your confirmation: {task.memberConfirmed ? 'Complete' : 'Needed'}</Text>
        <Text style={ui.body}>Other member: {task.partnerConfirmed ? 'Confirmed in demo' : 'Waiting'}</Text>
        {!task.memberConfirmed && <ActionButton label="Confirm agreed time" onPress={() => act(() => confirmTask(task.id))} />}
        {!task.partnerConfirmed && <ActionButton label="Simulate other member confirming" onPress={() => act(() => confirmTask(task.id, true))} secondary />}
        <Text style={ui.caption}>The simulation button is for testing only. It does not contact another person.</Text>
      </View>}
      {task.state === 'open' && <ActionButton
        label={task.direction === 'give' ? 'Offer help in demo' : 'Simulate a helper accepting'}
        onPress={() => act(() => acceptTask(task.id))} />}
      {(task.state === 'accepted' || task.state === 'in-progress') && <ActionButton
        label={task.state === 'accepted' ? 'Start task' : 'Finish task'}
        onPress={() => act(() => advanceTask(task.id))} />}
      {task.state === 'completed' && <Text accessibilityLiveRegion="polite" style={ui.success}>Both members confirmed. Your demo time record has been updated once.</Text>}
      {task.state === 'cancelled' && <Text style={ui.body}>This request was cancelled and its reserved time was released.</Text>}
      {task.direction === 'receive' && task.state === 'open' && (
        cancelling ? <View style={ui.attention}>
          <Text style={ui.body}>Cancel this request and release {formatDuration(task.durationSeconds)} of reserved time?</Text>
          <ActionButton label="Yes, cancel request" onPress={() => act(() => cancelTask(task.id))} secondary />
          <ActionButton label="Keep request" onPress={() => setCancelling(false)} secondary />
        </View> : <ActionButton label="Cancel request" onPress={() => setCancelling(true)} secondary />
      )}
      <Text style={ui.caption}>If the arrangements or duration are wrong, do not confirm. This demo does not yet provide messaging, rescheduling, or dispute support.</Text>
      {error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
    </Sheet>
  );
}

export const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.paper },
  page: { width: '100%', maxWidth: 860, alignSelf: 'center', padding: 20, paddingBottom: 36, gap: 20 },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  flex: { flex: 1, minWidth: 0 },
  brand: { color: palette.blue, fontSize: 14, fontWeight: '800', marginBottom: 6 },
  title: { color: palette.ink, fontSize: 30, fontWeight: '800', marginBottom: 4 },
  heading: { color: palette.ink, fontSize: 22, fontWeight: '700' },
  body: { color: palette.muted, fontSize: 16, lineHeight: 24 },
  caption: { color: palette.muted, fontSize: 14, lineHeight: 21 },
  card: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.line, borderRadius: 16, padding: 20, gap: 12 },
  wrapRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 },
  category: { color: palette.blue, fontSize: 15, fontWeight: '700' },
  badge: { alignSelf: 'flex-start', color: palette.blue, backgroundColor: palette.paleBlue, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, fontSize: 14, fontWeight: '600' },
  button: { minHeight: 48, backgroundColor: palette.blue, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: palette.white, fontSize: 16, fontWeight: '700', textAlign: 'center' },
  secondaryButton: { backgroundColor: palette.white, borderWidth: 1, borderColor: palette.blue },
  secondaryButtonText: { color: palette.blue },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
  demoNotice: { color: palette.amber, backgroundColor: palette.paleAmber, fontSize: 14, lineHeight: 21, padding: 12, borderRadius: 10 },
  attention: { backgroundColor: palette.paleAmber, borderRadius: 16, padding: 20, gap: 12 },
  error: { color: palette.red, backgroundColor: '#F9DDD7', padding: 14, borderRadius: 10, fontSize: 16, lineHeight: 24 },
  success: { color: palette.blue, backgroundColor: palette.paleBlue, padding: 16, borderRadius: 10, fontSize: 16, lineHeight: 24 },
  input: { minHeight: 52, borderWidth: 1, borderColor: palette.muted, borderRadius: 10, padding: 14, backgroundColor: palette.white, color: palette.ink, fontSize: 16 },
});
