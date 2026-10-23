import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ActionButton, DemoNotice, MemberHeader, MemberPage, palette, TaskCard, TaskDetails, ui } from '@/components/member-ui';
import { formatDuration, useTimeBank } from '@/providers/time-bank-provider';
import { parseRequestDate } from '@/lib/time-bank-model';

type Mode = 'offer' | 'request' | 'mine';
const CATEGORIES = ['Errand', 'Technology', 'Home', 'Company'];

function Field({ label, value, onChange, placeholder, multiline = false, numeric = false }: {
  label: string; value: string; onChange: (value: string) => void; placeholder: string; multiline?: boolean; numeric?: boolean;
}) {
  return <View style={styles.field}>
    <Text style={ui.body}>{label}</Text>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChange} placeholder={placeholder}
      placeholderTextColor={palette.muted} multiline={multiline} keyboardType={numeric ? 'number-pad' : 'default'}
      style={[ui.input, multiline && styles.multiline]} />
  </View>;
}

export default function CommunityScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('offer');
  const [filter, setFilter] = useState('All');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [minutes, setMinutes] = useState('60');
  const [category, setCategory] = useState('Home');
  const [error, setError] = useState<string | null>(null);
  const [posted, setPosted] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const { tasks, availableSeconds, createRequest } = useTimeBank();

  useFocusEffect(useCallback(() => {
    if (params.mode === 'offer' || params.mode === 'request' || params.mode === 'mine') setMode(params.mode);
    if (params.mode === 'request') setPosted(null);
  }, [params.mode]));
  const selectMode = (value: Mode) => {
    setMode(value);
    router.setParams({ mode: value });
  };

  const post = () => {
    try {
      const startsAt = parseRequestDate(date, time);
      const id = createRequest({ title, description, category, location, startsAt, durationSeconds: Number(minutes) * 60 });
      setPosted(id);
      setError(null);
      setTitle(''); setDescription(''); setLocation(''); setDate(''); setTime(''); setMinutes('60');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Your request could not be posted. Your draft has been kept.');
    }
  };
  const visible = tasks.filter((task) => mode === 'mine'
    ? task.direction === 'receive' || task.state !== 'open'
    : task.direction === 'give' && task.state === 'open' && (filter === 'All' || task.category === filter))
    .sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
  const proposedSeconds = Number(minutes) * 60;
  const validDuration = Number.isSafeInteger(proposedSeconds) && proposedSeconds >= 900 && proposedSeconds <= 14400 && proposedSeconds % 900 === 0;
  const postedTask = tasks.find((task) => task.id === posted);

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <MemberPage>
        <MemberHeader title="Community" subtitle="One hour of help earns one hour of time." />
        <DemoNotice />
        <View accessibilityRole="tablist" style={ui.wrapRow}>
          {([['offer', 'Help someone'], ['request', 'Ask for help'], ['mine', 'My exchanges']] as const).map(([value, label]) => (
            <Pressable key={value} accessibilityRole="tab" aria-selected={mode === value} accessibilityState={{ selected: mode === value }}
              onPress={() => selectMode(value)} style={[styles.chip, mode === value && styles.activeChip]}>
              <Text style={[styles.chipText, mode === value && styles.activeText]}>{label}</Text>
            </Pressable>
          ))}
        </View>
        {mode === 'request' ? posted ? <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>{postedTask?.state === 'cancelled'
            ? 'Your request was cancelled' : postedTask?.state === 'completed'
              ? 'Your exchange is complete' : 'Your demo request is posted'}</Text>
          <Text accessibilityLiveRegion="polite" style={ui.body}>{postedTask?.state === 'cancelled'
            ? 'The reserved time has been released. No credits moved.'
            : postedTask?.state === 'completed'
              ? 'Both demo confirmations are complete and your time record has been updated.'
              : 'Time has been reserved. No credits have moved. This request is visible only in your demo session.'}</Text>
          <ActionButton label="View your request" onPress={() => setSelectedTask(posted)} />
          <ActionButton label="Create another request" onPress={() => setPosted(null)} secondary />
        </View> : <View style={ui.card}>
          <Text accessibilityRole="header" style={ui.heading}>What do you need a hand with?</Text>
          <Field label="Task title" value={title} onChange={setTitle} placeholder="For example, help carrying groceries" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="Explain what help you need and any important arrangements" multiline />
          <Text style={ui.body}>Category</Text>
          <View accessibilityRole="radiogroup" accessibilityLabel="Task category" style={ui.wrapRow}>
            {CATEGORIES.map((item) => <Pressable key={item} accessibilityRole="radio" aria-checked={category === item} accessibilityState={{ checked: category === item }}
              onPress={() => setCategory(item)} style={[styles.chip, category === item && styles.activeChip]}>
              <Text style={[styles.chipText, category === item && styles.activeText]}>{item}</Text>
            </Pressable>)}
          </View>
          <Field label="Meeting area" value={location} onChange={setLocation} placeholder="For example, Sha Tin Market" />
          <Text style={ui.caption}>Use a public meeting area. Do not include private access codes or sensitive information.</Text>
          <Field label="Date (YYYY-MM-DD)" value={date} onChange={setDate} placeholder="YYYY-MM-DD" />
          <Field label="Time (HH:MM, 24-hour)" value={time} onChange={setTime} placeholder="14:30" />
          <Field label="Duration in minutes (15–240, in steps of 15)" value={minutes} onChange={setMinutes} placeholder="60" numeric />
          <View style={ui.attention}>
            <Text style={ui.body}>You have {formatDuration(availableSeconds)} available.</Text>
            <Text style={ui.body}>{validDuration
              ? proposedSeconds <= availableSeconds
                ? `Posting reserves ${formatDuration(proposedSeconds)}, leaving ${formatDuration(availableSeconds - proposedSeconds)} available.`
                : 'This request exceeds your available time. Choose a shorter duration.'
              : 'Choose a duration in 15-minute steps, up to 4 hours.'}</Text>
            <Text style={ui.caption}>Time transfers only after the task is finished and both members confirm.</Text>
          </View>
          {error && <Text accessibilityRole="alert" style={ui.error}>{error}</Text>}
          <ActionButton label="Post demo request" onPress={post} />
        </View> : <>
          {mode === 'offer' && <View style={ui.wrapRow}>
            {['All', ...CATEGORIES].map((item) => <Pressable key={item} accessibilityRole="button" aria-pressed={filter === item} accessibilityState={{ selected: filter === item }}
              onPress={() => setFilter(item)} style={[styles.chip, filter === item && styles.activeChip]}>
              <Text style={[styles.chipText, filter === item && styles.activeText]}>{item}</Text>
            </Pressable>)}
          </View>}
          <Text accessibilityRole="header" style={ui.heading}>{mode === 'mine' ? 'Your exchanges' : `${visible.length} available requests`}</Text>
          {visible.map((task) => <TaskCard key={task.id} task={task} onOpen={() => setSelectedTask(task.id)} />)}
          {!visible.length && <View style={ui.card}>
            <Text style={ui.body}>{mode === 'mine' ? 'Your accepted tasks and requests will appear here.' : 'No requests match this category. Try another category or ask your community for help.'}</Text>
            <ActionButton label={mode === 'mine' ? 'Find someone to help' : 'Show all requests'} onPress={() => { selectMode('offer'); setFilter('All'); }} secondary />
          </View>}
        </>}
        {selectedTask && <TaskDetails taskId={selectedTask} onClose={() => setSelectedTask(null)} />}
      </MemberPage>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  multiline: { minHeight: 110, textAlignVertical: 'top' },
  chip: { minHeight: 48, borderRadius: 10, borderWidth: 1, borderColor: palette.blue, paddingHorizontal: 14, paddingVertical: 12, justifyContent: 'center', backgroundColor: palette.white },
  activeChip: { backgroundColor: palette.blue },
  chipText: { color: palette.blue, fontSize: 16, fontWeight: '600' },
  activeText: { color: palette.white },
});
