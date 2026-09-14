import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/providers/account-provider';

function PlannedDevice({ mark, title, description }: { mark: string; title: string; description: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeading}>
        <View style={styles.deviceMark}><Text style={styles.deviceMarkText}>{mark}</Text></View>
        <View style={styles.headingCopy}>
          <Text style={styles.sectionTitle}>{title}</Text>
          <Text style={styles.stateWaiting}>PLANNED - NOT PAIRED</Text>
        </View>
      </View>
      <Text style={styles.body}>{description}</Text>
      <View style={styles.integrationRow}>
        <Text style={styles.integrationLabel}>Account setup</Text>
        <Text style={styles.ready}>READY</Text>
      </View>
      <View style={styles.integrationRow}>
        <Text style={styles.integrationLabel}>Hardware connection</Text>
        <Text style={styles.pending}>NOT AVAILABLE</Text>
      </View>
      <View style={styles.disabledButton}>
        <Text style={styles.disabledButtonText}>Pairing coming later</Text>
      </View>
    </View>
  );
}

export default function DevicesScreen() {
  const { profile, photoContacts, signOut, startProfileEdit } = useAccount();

  return (
    <View style={styles.screen}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.eyebrow}>SILVERCARE</Text>
          <Text style={styles.title}>Devices</Text>
          <Text style={styles.intro}>Prepare the support profile now. Device pairing will be added alongside the hardware communication layer.</Text>

          {profile?.predictive_insoles_enabled && (
            <PlannedDevice
              mark="G"
              title="Predictive Gait Insoles"
              description="Planned wearable sensors for recording walking-pattern indicators and longer-term mobility trends."
            />
          )}

          {profile?.photo_dial_enabled && (
            <PlannedDevice
              mark="D"
              title="Rotary Photo-Dial Communicator"
              description={`Planned physical calling interface with ${photoContacts.length} ${photoContacts.length === 1 ? 'contact' : 'contacts'} assigned to dial positions.`}
            />
          )}

          <View style={styles.section}>
            <View style={styles.sectionHeading}>
              <View style={[styles.deviceMark, styles.accountMark]}><Text style={styles.deviceMarkText}>A</Text></View>
              <View style={styles.headingCopy}>
                <Text style={styles.sectionTitle}>Support profile</Text>
                <Text style={styles.stateReady}>PRIVATE ACCOUNT DATA</Text>
              </View>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Name</Text>
              <Text style={styles.profileValue}>{profile?.full_name}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Mobility aid</Text>
              <Text style={styles.profileValue}>{profile?.mobility_aid || 'None recorded'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Mobility history</Text>
              <Text style={styles.profileValue}>{profile?.fall_history || 'None recorded'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Photo contacts</Text>
              <Text style={styles.profileValue}>{photoContacts.length}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Allergies</Text>
              <Text style={styles.profileValue}>{profile?.allergies.length ? profile.allergies.join(', ') : 'None recorded'}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Emergency contact</Text>
              <Text style={styles.profileValue}>{profile?.emergency_contact_name || 'Not provided'}{profile?.emergency_contact_phone ? ` (${profile.emergency_contact_phone})` : ''}</Text>
            </View>
            <View style={styles.profileRow}>
              <Text style={styles.profileLabel}>Terms accepted</Text>
              <Text style={styles.profileValue}>{profile ? `${profile.terms_version} on ${new Date(profile.terms_accepted_at).toLocaleDateString()}` : ''}</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={startProfileEdit} style={({ pressed }) => [styles.editProfileButton, pressed && styles.pressed]}>
              <Text style={styles.editProfileText}>Update support profile</Text>
            </Pressable>
            <Pressable accessibilityRole="button" onPress={signOut} style={({ pressed }) => [styles.signOutButton, pressed && styles.pressed]}>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
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
  eyebrow: { color: '#116A58', fontSize: 12, fontWeight: '800', letterSpacing: 0 },
  title: { color: '#17211E', fontSize: 38, lineHeight: 44, fontWeight: '800', letterSpacing: 0, marginTop: -14 },
  intro: { color: '#59635F', fontSize: 16, lineHeight: 23, maxWidth: 560, marginTop: -8 },
  section: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 8, padding: 18, gap: 11 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 6 },
  deviceMark: { width: 44, height: 44, borderRadius: 6, alignItems: 'center', justifyContent: 'center', backgroundColor: '#116A58' },
  accountMark: { backgroundColor: '#6B5145' },
  deviceMarkText: { color: '#FFFFFF', fontSize: 19, fontWeight: '900' },
  headingCopy: { flex: 1, gap: 2 },
  sectionTitle: { color: '#17211E', fontSize: 20, fontWeight: '800', letterSpacing: 0 },
  stateWaiting: { color: '#8A5A12', fontSize: 10, fontWeight: '800' },
  stateReady: { color: '#0C775C', fontSize: 10, fontWeight: '800' },
  body: { color: '#616A66', fontSize: 14, lineHeight: 21, marginBottom: 3 },
  integrationRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9DED9', paddingTop: 11 },
  integrationLabel: { color: '#48524E', fontSize: 14 },
  ready: { color: '#0C775C', fontSize: 11, fontWeight: '900' },
  pending: { color: '#9A6415', fontSize: 11, fontWeight: '900' },
  disabledButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E7EAE6', borderRadius: 6, marginTop: 3 },
  disabledButtonText: { color: '#747C78', fontSize: 14, fontWeight: '800' },
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D9DED9', paddingTop: 11 },
  profileLabel: { color: '#69716D', fontSize: 13, fontWeight: '700' },
  profileValue: { flex: 1, color: '#25312D', fontSize: 13, fontWeight: '600', textAlign: 'right' },
  editProfileButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', backgroundColor: '#116A58', borderRadius: 6, marginTop: 4 },
  editProfileText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  signOutButton: { minHeight: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#A33827', borderRadius: 6, marginTop: 4 },
  signOutText: { color: '#A33827', fontSize: 14, fontWeight: '800' },
  pressed: { opacity: 0.72 },
});