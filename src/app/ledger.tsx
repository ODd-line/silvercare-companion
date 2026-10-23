import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { ActionButton, DemoNotice, MemberHeader, MemberPage, palette, TaskCard, TaskDetails, ui } from '@/components/member-ui';
import { formatDuration, formatTaskDate, useTimeBank } from '@/providers/time-bank-provider';

export default function MyTimeScreen() {
  const { confirmedSeconds, availableSeconds, reservedSeconds, ledger, tasks } = useTimeBank();
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const pending = tasks.filter((task) => task.direction === 'receive' && !['completed', 'cancelled'].includes(task.state));
  return (
    <MemberPage>
      <MemberHeader title="My Time" subtitle="Understand the time you can give and receive." />
      <DemoNotice />
      <View style={styles.balance}>
        <Text style={ui.heading}>Time you can spend</Text>
        <Text style={styles.amount}>{formatDuration(availableSeconds)}</Text>
        <Text style={ui.body}>{formatDuration(reservedSeconds)} reserved for your requests</Text>
        <Text style={ui.body}>{formatDuration(confirmedSeconds)} total confirmed in demo</Text>
        <Text style={ui.caption}>Available time is your confirmed total minus reservations. Reservations are holds, not completed transfers.</Text>
      </View>
      <Text accessibilityRole="header" style={ui.heading}>Pending and reserved</Text>
      {pending.length ? pending.map((task) => <TaskCard key={task.id} task={task} onOpen={() => setSelectedTask(task.id)} />)
        : <Text style={ui.body}>No time is reserved right now.</Text>}
      <Text accessibilityRole="header" style={ui.heading}>Completed time activity</Text>
      {ledger.filter((entry) => entry.status === 'posted').map((entry) => <View key={entry.id} style={ui.card}>
        <Text style={ui.category}>{entry.id === 'opening' ? 'Sample starting time' : entry.seconds > 0 ? 'Time earned' : 'Time spent'} · {formatDuration(entry.seconds)}</Text>
        <Text style={ui.heading}>{entry.title}</Text>
        <Text style={ui.body}>{entry.counterparty}</Text>
        <Text style={ui.caption}>{formatTaskDate(entry.postedAt)}</Text>
        {entry.taskId && <ActionButton label="View exchange" onPress={() => setSelectedTask(entry.taskId ?? null)} secondary />}
      </View>)}
      <Text style={ui.caption}>One hour of agreed help equals one hour of time. In a live service, transfers must be posted by the server after both members confirm.</Text>
      {selectedTask && <TaskDetails taskId={selectedTask} onClose={() => setSelectedTask(null)} />}
    </MemberPage>
  );
}

const styles = StyleSheet.create({
  balance: { backgroundColor: palette.paleBlue, padding: 20, borderRadius: 16, gap: 12 },
  amount: { color: palette.blue, fontSize: 42, fontWeight: '800' },
});
