import { useState } from 'react';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, DemoNotice, MemberHeader, MemberPage, palette, TaskCard, TaskDetails, ui } from '@/components/member-ui';
import { useAccount } from '@/providers/account-provider';
import { formatDuration, useTimeBank } from '@/providers/time-bank-provider';

export default function HomeScreen() {
  const router = useRouter();
  const { profile } = useAccount();
  const { availableSeconds, reservedSeconds, tasks, watchConnected } = useTimeBank();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const name = profile?.full_name.trim().split(/\s+/)[0] || 'Member';
  const pending = tasks.filter((task) => task.state === 'awaiting-confirmation' && !task.memberConfirmed);
  const scheduled = tasks.filter((task) => ['accepted', 'in-progress'].includes(task.state))
    .sort((a, b) => Number(b.state === 'in-progress') - Number(a.state === 'in-progress') || Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const waiting = tasks.filter((task) => task.state === 'awaiting-confirmation' && task.memberConfirmed);

  return (
    <MemberPage>
      <MemberHeader title={`${greeting}, ${name}`} subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} />
      <DemoNotice />
      {pending.length > 0 && <View style={ui.attention}>
        <Text accessibilityRole="header" style={ui.heading}>Your confirmation is needed</Text>
        <Text style={ui.body}>{pending[0].title}{pending.length > 1 ? ` and ${pending.length - 1} more` : ''}. Review the agreed time before confirming.</Text>
        <ActionButton label="Review time" onPress={() => setSelectedTask(pending[0].id)} />
      </View>}
      <Text accessibilityRole="header" style={ui.heading}>{scheduled[0]?.state === 'in-progress' ? 'Your active task' : 'Your next task'}</Text>
      {scheduled[0] ? <TaskCard task={scheduled[0]} onOpen={() => setSelectedTask(scheduled[0].id)} /> : <View style={ui.card}>
        <Text style={ui.heading}>Your time is open</Text>
        <Text style={ui.body}>Find someone to help, or ask your community for a hand.</Text>
        <ActionButton label="Find an exchange" onPress={() => router.navigate('/exchange')} />
      </View>}
      <View style={styles.balance}>
        <Text accessibilityRole="header" style={ui.heading}>Your time</Text>
        <Text style={styles.amount}>{formatDuration(availableSeconds)} available</Text>
        <Text style={ui.body}>{formatDuration(reservedSeconds)} reserved for your requests</Text>
        <ActionButton label="View time activity" onPress={() => router.navigate('/ledger')} secondary />
      </View>
      <View style={ui.card}>
        <Text accessibilityRole="header" style={ui.heading}>Give a hand. Ask for a hand.</Text>
        <ActionButton label="Ask for help" onPress={() => router.navigate({ pathname: '/exchange', params: { mode: 'request' } })} />
        <ActionButton label="Help someone" onPress={() => router.navigate({ pathname: '/exchange', params: { mode: 'offer' } })} secondary />
      </View>
      {scheduled.length > 1 && <>
        <Text accessibilityRole="header" style={ui.heading}>Coming up</Text>
        {scheduled.slice(1).map((task) => <TaskCard key={task.id} task={task} onOpen={() => setSelectedTask(task.id)} />)}
      </>}
      {waiting.map((task) => <View key={task.id} style={ui.card}>
        <Text style={ui.heading}>Waiting for {task.memberName}</Text>
        <Text style={ui.body}>{task.title}: you have confirmed. No time moves until the other member confirms too.</Text>
        <ActionButton label="View progress" onPress={() => setSelectedTask(task.id)} secondary />
      </View>)}
      <Text style={ui.caption}>{watchConnected ? 'Watch connected. Task syncing is not available yet.' : 'Watch disconnected. You can still use your phone.'}</Text>
      {selectedTask && <TaskDetails taskId={selectedTask} onClose={() => setSelectedTask(null)} />}
    </MemberPage>
  );
}

const styles = StyleSheet.create({
  balance: { padding: 20, borderRadius: 16, backgroundColor: palette.paleBlue, gap: 12 },
  amount: { color: palette.blue, fontSize: 30, fontWeight: '800' },
});
