import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/providers/account-provider';

export default function TodayScreen() {
  const { profile, photoContacts } = useAccount();
  const firstName = profile?.full_name.split(' ')[0] || 'there';

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.header}>
            <View>
              <Text style={styles.eyebrow}>SILVERCARE</Text>
              <Text style={styles.title}>Hello, {firstName}</Text>
            </View>
            <View style={styles.statusPill}>
              <View style={styles.statusDot} />
              <Text style={styles.statusText}>Setup stage</Text>
            </View>
          </View>

          {profile?.predictive_insoles_enabled && (
            <View style={styles.heroPanel}>
              <Text style={styles.heroLabel}>PREDICTIVE GAIT INSOLES</Text>
              <Text style={styles.heroTitle}>Your walking baseline will appear here</Text>
              <Text style={styles.heroBody}>Once paired, the insoles can contribute cadence, symmetry, and stride-variation trends for you and your caregiver to review.</Text>
              <View style={styles.notReadyRow}>
                <View style={styles.notReadyDot} />
                <Text style={styles.notReadyText}>Hardware pairing is not available yet</Text>
              </View>
            </View>
          )}

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Mobility overview</Text>
            <Text style={styles.sectionMeta}>No readings yet</Text>
          </View>
          <View style={styles.metricGrid}>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>CADENCE</Text>
              <Text style={styles.metricValue}>--</Text>
              <Text style={styles.metricUnit}>steps/min</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>SYMMETRY</Text>
              <Text style={styles.metricValue}>--</Text>
              <Text style={styles.metricUnit}>percent</Text>
            </View>
            <View style={styles.metric}>
              <Text style={styles.metricLabel}>VARIABILITY</Text>
              <Text style={styles.metricValue}>--</Text>
              <Text style={styles.metricUnit}>trend</Text>
            </View>
          </View>
          <Text style={styles.contextNote}>These indicators describe trends only. They do not diagnose a condition or predict a fall with certainty.</Text>

          {profile?.photo_dial_enabled && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Photo dial</Text>
                <Text style={styles.sectionMeta}>{photoContacts.length} {photoContacts.length === 1 ? 'contact' : 'contacts'}</Text>
              </View>
              <View style={styles.contactList}>
                {photoContacts.map((contact) => (
                  <View key={contact.id ?? contact.dial_position} style={styles.contactRow}>
                    <View style={styles.dialPosition}><Text style={styles.dialPositionText}>{contact.dial_position}</Text></View>
                    <View style={styles.contactCopy}>
                      <Text style={styles.contactName}>{contact.name}</Text>
                      <Text style={styles.contactDetail}>{contact.relationship || contact.phone}</Text>
                    </View>
                    <Text style={styles.contactState}>PLANNED</Text>
                  </View>
                ))}
                {!photoContacts.length && (
                  <View style={styles.emptyRow}>
                    <Text style={styles.emptyTitle}>No contacts assigned</Text>
                    <Text style={styles.emptyBody}>Add contact positions from your support profile.</Text>
                  </View>
                )}
              </View>
            </>
          )}

          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>For urgent help</Text>
            <Text style={styles.noticeBody}>Contact local emergency services directly. Do not wait for an app alert or photo-dial call.</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F1' },
  safeArea: { flex: 1 },
  content: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 120, gap: 18 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 14, marginBottom: 4 },
  eyebrow: { color: '#116A58', fontSize: 12, fontWeight: '800', letterSpacing: 0 },
  title: { color: '#17211E', fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: 0 },
  statusPill: { minHeight: 34, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#F4E8D1', borderRadius: 17 },
  statusDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B87520' },
  statusText: { color: '#795417', fontWeight: '700', fontSize: 13 },
  heroPanel: { backgroundColor: '#DDEBE2', padding: 22, borderRadius: 8, gap: 8, borderLeftWidth: 5, borderLeftColor: '#33836C' },
  heroLabel: { color: '#116A58', fontSize: 12, fontWeight: '800', letterSpacing: 0 },
  heroTitle: { color: '#173B32', fontSize: 25, lineHeight: 31, fontWeight: '800', letterSpacing: 0 },
  heroBody: { color: '#42645B', fontSize: 15, lineHeight: 22 },
  notReadyRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  notReadyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#B87520' },
  notReadyText: { color: '#6B521D', fontSize: 12, fontWeight: '800' },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, marginTop: 8 },
  sectionTitle: { color: '#17211E', fontSize: 20, fontWeight: '800', letterSpacing: 0 },
  sectionMeta: { color: '#69716D', fontSize: 13, fontWeight: '600' },
  metricGrid: { flexDirection: 'row', gap: 8 },
  metric: { flex: 1, minHeight: 116, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 7, padding: 13, justifyContent: 'space-between' },
  metricLabel: { color: '#66706B', fontSize: 9, fontWeight: '900' },
  metricValue: { color: '#17211E', fontSize: 29, fontWeight: '800' },
  metricUnit: { color: '#77807C', fontSize: 11 },
  contextNote: { color: '#69716D', fontSize: 12, lineHeight: 18, paddingHorizontal: 4 },
  contactList: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 8, overflow: 'hidden' },
  contactRow: { minHeight: 72, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9DED9' },
  dialPosition: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDECE6' },
  dialPositionText: { color: '#116A58', fontSize: 15, fontWeight: '900' },
  contactCopy: { flex: 1, gap: 2 },
  contactName: { color: '#17211E', fontSize: 16, fontWeight: '800' },
  contactDetail: { color: '#69716D', fontSize: 12 },
  contactState: { color: '#8A5A12', fontSize: 9, fontWeight: '900' },
  emptyRow: { padding: 20, gap: 5 },
  emptyTitle: { color: '#26322E', fontSize: 16, fontWeight: '700' },
  emptyBody: { color: '#69716D', lineHeight: 20 },
  notice: { borderLeftWidth: 4, borderLeftColor: '#B87520', backgroundColor: '#F7EACD', borderRadius: 5, padding: 14, gap: 4 },
  noticeTitle: { color: '#70470E', fontSize: 14, fontWeight: '800' },
  noticeBody: { color: '#76571F', fontSize: 13, lineHeight: 19 },
});