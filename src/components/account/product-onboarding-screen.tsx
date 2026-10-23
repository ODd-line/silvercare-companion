import { useState } from 'react';
import {
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TERMS_VERSION, useAccount } from '@/providers/account-provider';

const STEPS = ['Member', 'Trusted contact', 'Terms'];

function Field({ label, value, onChangeText, placeholder }: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder: string;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#898983" style={styles.input} value={value} />
    </View>
  );
}

export function ProductOnboardingScreen() {
  const { loading, error, profile, editingProfile, saveProductOnboarding, signOut, cancelProfileEdit } = useAccount();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [circleName, setCircleName] = useState(profile?.emergency_contact_name ?? '');
  const [circlePhone, setCirclePhone] = useState(profile?.emergency_contact_phone ?? '');
  const [termsRead, setTermsRead] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const continueFlow = async () => {
    if (step === 0 && fullName.trim().length < 2) {
      setValidationError('Enter your full name.');
      return;
    }
    if (step === 1 && ((circleName && !circlePhone) || (!circleName && circlePhone))) {
      setValidationError('Add both a name and phone number, or leave both blank.');
      return;
    }
    if (step === 2 && (!termsRead || !termsAccepted)) {
      setValidationError('Read to the end and accept the membership terms.');
      return;
    }
    setValidationError(null);
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }
    await saveProductOnboarding({
      fullName: fullName.trim(),
      dateOfBirth: profile?.date_of_birth ?? '',
      phone: phone.trim(),
      emergencyContactName: circleName.trim(),
      emergencyContactPhone: circlePhone.trim(),
      allergies: [],
      medicalNotes: '',
      mobilityAid: '',
      fallHistory: '',
      predictiveInsolesEnabled: false,
      photoDialEnabled: false,
      photoContacts: [],
    });
  };

  const handleTermsScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
    if (contentOffset.y + layoutMeasurement.height >= contentSize.height - 24) setTermsRead(true);
  };

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
          <View style={styles.topBar}>
            <Text style={styles.brand}>SILVER BANK · TIME BANK</Text>
            <Pressable accessibilityRole="button" onPress={editingProfile ? cancelProfileEdit : signOut}><Text style={styles.exitText}>{editingProfile ? 'Cancel' : 'Sign out'}</Text></Pressable>
          </View>

          <View style={styles.progressRow}>
            {STEPS.map((label, index) => (
              <View key={label} style={styles.progressItem}>
                <View style={[styles.progressBar, index <= step && styles.progressBarActive]} />
                <Text style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>

          {step === 0 && <View style={styles.section}>
            <Text style={styles.stepMark}>01 · MEMBER</Text>
            <Text style={styles.title}>{editingProfile ? 'Review your membership' : 'Join your local Time Bank'}</Text>
            <Text style={styles.intro}>Every member gives and receives time at the same rate: one hour equals one hour.</Text>
            <Field label="Full name *" value={fullName} onChangeText={setFullName} placeholder="Your name" />
            <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="+852" />
          </View>}

          {step === 1 && <View style={styles.section}>
            <Text style={styles.stepMark}>02 · TRUSTED CONTACT</Text>
            <Text style={styles.title}>Add someone you trust</Text>
            <Text style={styles.intro}>This person can help with account access or watch setup. They cannot approve exchanges or move your credits.</Text>
            <Field label="Trusted contact name" value={circleName} onChangeText={setCircleName} placeholder="Optional" />
            <Field label="Trusted contact phone" value={circlePhone} onChangeText={setCirclePhone} placeholder="Optional" />
            <View style={styles.watchNote}>
              <Text style={styles.watchMark}>WATCH</Text>
              <Text style={styles.watchText}>Pairing comes after setup. The watch shows assigned tasks and queues actions; the phone and server confirm what happened.</Text>
            </View>
          </View>}

          {step === 2 && <View style={styles.section}>
            <Text style={styles.stepMark}>03 · AGREEMENT</Text>
            <Text style={styles.title}>Time Bank membership terms</Text>
            <Text style={styles.intro}>Read to the end before joining the exchange.</Text>
            <ScrollView accessibilityLabel="Time Bank membership terms" nestedScrollEnabled onScroll={handleTermsScroll} scrollEventThrottle={16} style={styles.termsBox} contentContainerStyle={styles.termsContent}>
              <Text style={styles.termsVersion}>VERSION {TERMS_VERSION}</Text>
              <Text style={styles.termsHeading}>1. Equal time</Text>
              <Text style={styles.termsText}>One hour of agreed help equals one time credit hour, regardless of the task category.</Text>
              <Text style={styles.termsHeading}>2. Agreement before work</Text>
              <Text style={styles.termsText}>Members agree on the task, expected duration, place, and timing before work begins.</Text>
              <Text style={styles.termsHeading}>3. Two-person confirmation</Text>
              <Text style={styles.termsText}>Time remains pending until the required members confirm completion. A watch tap or phone receipt does not create credit.</Text>
              <Text style={styles.termsHeading}>4. Server ledger</Text>
              <Text style={styles.termsText}>The authenticated Time Bank service is the authoritative record. Duplicate actions are rejected and posted entries are retained for audit.</Text>
              <Text style={styles.termsHeading}>5. Safety and disputes</Text>
              <Text style={styles.termsText}>Members choose suitable tasks and may report a problem. Disputed transfers remain frozen until reviewed. This service is not an emergency service.</Text>
              <Text style={styles.termsHeading}>6. Watch limits</Text>
              <Text style={styles.termsText}>The watch is a convenience interface. It may queue actions while offline, but it cannot approve membership, settle disputes, or calculate the authoritative balance.</Text>
              <Text style={styles.termsEnd}>END OF TERMS</Text>
            </ScrollView>
            {!termsRead && <Text style={styles.scrollHint}>Scroll to the end to enable agreement.</Text>}
            <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: termsAccepted, disabled: !termsRead }} disabled={!termsRead} onPress={() => setTermsAccepted((value) => !value)} style={[styles.consentRow, !termsRead && styles.disabled]}>
              <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>{termsAccepted && <Text style={styles.checkmark}>X</Text>}</View>
              <Text style={styles.consentText}>I agree to the Time Bank rules and the storage of my membership, task, confirmation, and ledger records.</Text>
            </Pressable>
          </View>}

          {(validationError || error) && <Text style={styles.error}>{validationError || error}</Text>}
          <View style={styles.actions}>
            {step > 0 && <Pressable accessibilityRole="button" onPress={() => { setStep((current) => current - 1); setValidationError(null); }} style={styles.backButton}><Text style={styles.backText}>BACK</Text></Pressable>}
            <Pressable accessibilityRole="button" disabled={loading} onPress={continueFlow} style={[styles.continueButton, loading && styles.disabled]}><Text style={styles.continueText}>{loading ? 'SAVING...' : step === 2 ? 'AGREE AND JOIN' : 'CONTINUE'}</Text></Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F4EC' }, safeArea: { flex: 1 }, page: { width: '100%', maxWidth: 700, alignSelf: 'center', padding: 22, paddingBottom: 48, gap: 22 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 4, borderBottomColor: '#171A1F', paddingBottom: 14 }, brand: { color: '#174EA6', fontSize: 12, fontWeight: '900' }, exitText: { color: '#656761', fontSize: 13, fontWeight: '800' },
  progressRow: { flexDirection: 'row', gap: 6 }, progressItem: { flex: 1, gap: 6 }, progressBar: { height: 5, backgroundColor: '#D4D1C8' }, progressBarActive: { backgroundColor: '#174EA6' }, progressLabel: { color: '#85857F', fontSize: 9, fontWeight: '800', textAlign: 'center' }, progressLabelActive: { color: '#174EA6' },
  section: { gap: 15 }, stepMark: { alignSelf: 'flex-start', color: '#FFFFFF', backgroundColor: '#D4422F', paddingHorizontal: 8, paddingVertical: 5, fontSize: 9, fontWeight: '900' }, title: { color: '#171A1F', fontSize: 32, lineHeight: 38, fontWeight: '900' }, intro: { color: '#656761', fontSize: 15, lineHeight: 22 },
  field: { gap: 7 }, label: { color: '#3F403D', fontSize: 12, fontWeight: '900' }, input: { minHeight: 50, borderWidth: 2, borderColor: '#171A1F', paddingHorizontal: 14, color: '#171A1F', backgroundColor: '#FFFFFF', fontSize: 16 },
  watchNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderLeftWidth: 5, borderLeftColor: '#F4C84A', backgroundColor: '#FFFFFF', padding: 14 }, watchMark: { color: '#FFFFFF', backgroundColor: '#174EA6', paddingHorizontal: 7, paddingVertical: 4, fontSize: 9, fontWeight: '900' }, watchText: { flex: 1, color: '#4F504C', fontSize: 12, lineHeight: 18 },
  termsBox: { maxHeight: 320, backgroundColor: '#FFFFFF', borderWidth: 2, borderColor: '#171A1F' }, termsContent: { padding: 18, gap: 9 }, termsVersion: { color: '#174EA6', fontSize: 10, fontWeight: '900' }, termsHeading: { color: '#171A1F', fontSize: 15, fontWeight: '900', marginTop: 6 }, termsText: { color: '#4F504C', fontSize: 13, lineHeight: 20 }, termsEnd: { color: '#D4422F', fontSize: 11, fontWeight: '900', textAlign: 'center', marginTop: 12 }, scrollHint: { color: '#9A5E10', fontSize: 11, fontWeight: '800' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#F4C84A', padding: 14 }, checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#171A1F', alignItems: 'center', justifyContent: 'center' }, checkboxChecked: { backgroundColor: '#171A1F' }, checkmark: { color: '#FFFFFF', fontSize: 11, fontWeight: '900' }, consentText: { flex: 1, color: '#292A27', fontSize: 12, lineHeight: 18, fontWeight: '700' },
  error: { color: '#9D2E21', backgroundColor: '#F9DDD7', padding: 12, lineHeight: 20 }, actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }, backButton: { minHeight: 50, minWidth: 96, borderWidth: 2, borderColor: '#171A1F', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 }, backText: { color: '#171A1F', fontSize: 12, fontWeight: '900' }, continueButton: { minHeight: 50, minWidth: 160, backgroundColor: '#174EA6', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 }, continueText: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, disabled: { opacity: 0.45 },
});