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

import { PhotoContact, TERMS_VERSION, useAccount } from '@/providers/account-provider';

type DraftContact = PhotoContact & { clientId: number };

const STEPS = ['About', 'Mobility', 'Photo dial', 'Terms'];
let nextContactId = 1;

function emptyContact(position: number): DraftContact {
  return { clientId: nextContactId++, name: '', phone: '', relationship: '', dial_position: position };
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  multiline,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'phone-pad';
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        keyboardType={keyboardType}
        multiline={multiline}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#8A918D"
        style={[styles.input, multiline && styles.textArea]}
        value={value}
      />
    </View>
  );
}

function ProductChoice({
  title,
  description,
  selected,
  onPress,
}: {
  title: string;
  description: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.productChoice, selected && styles.productChoiceSelected, pressed && styles.pressed]}>
      <View style={[styles.checkbox, selected && styles.checkboxChecked]}>
        {selected && <Text style={styles.checkmark}>X</Text>}
      </View>
      <View style={styles.choiceCopy}>
        <Text style={styles.choiceTitle}>{title}</Text>
        <Text style={styles.choiceDescription}>{description}</Text>
      </View>
    </Pressable>
  );
}

export function ProductOnboardingScreen() {
  const {
    loading,
    error,
    profile,
    photoContacts: storedContacts,
    editingProfile,
    saveProductOnboarding,
    signOut,
    cancelProfileEdit,
  } = useAccount();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile?.date_of_birth ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [emergencyName, setEmergencyName] = useState(profile?.emergency_contact_name ?? '');
  const [emergencyPhone, setEmergencyPhone] = useState(profile?.emergency_contact_phone ?? '');
  const [allergies, setAllergies] = useState(profile?.allergies.join(', ') ?? '');
  const [medicalNotes, setMedicalNotes] = useState(profile?.medical_notes ?? '');
  const [mobilityAid, setMobilityAid] = useState(profile?.mobility_aid ?? '');
  const [fallHistory, setFallHistory] = useState(profile?.fall_history ?? '');
  const [insolesEnabled, setInsolesEnabled] = useState(profile?.predictive_insoles_enabled ?? true);
  const [photoDialEnabled, setPhotoDialEnabled] = useState(profile?.photo_dial_enabled ?? true);
  const [contacts, setContacts] = useState<DraftContact[]>(() => (
    storedContacts.length
      ? storedContacts.map((contact) => ({ ...contact, clientId: nextContactId++ }))
      : [emptyContact(1)]
  ));
  const [termsRead, setTermsRead] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  const updateContact = (clientId: number, field: keyof PhotoContact, value: string) => {
    setContacts((current) => current.map((contact) => (
      contact.clientId === clientId ? { ...contact, [field]: value } : contact
    )));
  };

  const removeContact = (clientId: number) => {
    setContacts((current) => current
      .filter((contact) => contact.clientId !== clientId)
      .map((contact, index) => ({ ...contact, dial_position: index + 1 })));
  };

  const validateStep = () => {
    if (step === 0) {
      if (fullName.trim().length < 2) return 'Enter the user’s full name.';
      if (dateOfBirth && (!/^\d{4}-\d{2}-\d{2}$/.test(dateOfBirth) || Number.isNaN(Date.parse(`${dateOfBirth}T00:00:00Z`)))) return 'Enter a valid date of birth using YYYY-MM-DD.';
      if (dateOfBirth && Date.parse(`${dateOfBirth}T00:00:00Z`) > Date.now()) return 'Date of birth cannot be in the future.';
    }
    if (step === 1 && !insolesEnabled && !photoDialEnabled) return 'Select at least one planned SilverCare product.';
    if (step === 2 && photoDialEnabled) {
      if (!contacts.length) return 'Add at least one photo-dial contact.';
      if (contacts.some((contact) => !contact.name.trim() || !contact.phone.trim())) return 'Each photo-dial contact needs a name and phone number.';
    }
    if (step === 3 && (!termsRead || !termsAccepted)) return 'Read to the end and accept the terms before continuing.';
    return null;
  };

  const continueFlow = async () => {
    const nextError = validateStep();
    if (nextError) {
      setValidationError(nextError);
      return;
    }
    setValidationError(null);
    if (step < STEPS.length - 1) {
      setStep((current) => current + 1);
      return;
    }

    await saveProductOnboarding({
      fullName: fullName.trim(),
      dateOfBirth,
      phone: phone.trim(),
      emergencyContactName: emergencyName.trim(),
      emergencyContactPhone: emergencyPhone.trim(),
      allergies: allergies.split(',').map((item) => item.trim()).filter(Boolean),
      medicalNotes: medicalNotes.trim(),
      mobilityAid: mobilityAid.trim(),
      fallHistory: fallHistory.trim(),
      predictiveInsolesEnabled: insolesEnabled,
      photoDialEnabled,
      photoContacts: photoDialEnabled
        ? contacts.map(({ clientId: _clientId, id: _id, ...contact }) => contact)
        : [],
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
            <Text style={styles.brand}>SILVERCARE</Text>
            <Pressable accessibilityRole="button" onPress={editingProfile ? cancelProfileEdit : signOut}>
              <Text style={styles.exitText}>{editingProfile ? 'Cancel' : 'Sign out'}</Text>
            </Pressable>
          </View>

          <View style={styles.progressRow}>
            {STEPS.map((label, index) => (
              <View key={label} style={styles.progressItem}>
                <View style={[styles.progressBar, index <= step && styles.progressBarActive]} />
                <Text style={[styles.progressLabel, index === step && styles.progressLabelActive]}>{label}</Text>
              </View>
            ))}
          </View>

          {step === 0 && (
            <View style={styles.section}>
              <Text style={styles.title}>{editingProfile ? 'Review personal details' : 'Set up the support profile'}</Text>
              <Text style={styles.intro}>Keep identification and emergency contact details together for the user and their caregiver.</Text>
              <Field label="Full name *" value={fullName} onChangeText={setFullName} placeholder="Full legal name" />
              <Field label="Date of birth" value={dateOfBirth} onChangeText={setDateOfBirth} placeholder="YYYY-MM-DD" />
              <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="+852" keyboardType="phone-pad" />
              <View style={styles.divider} />
              <Text style={styles.subheading}>Emergency contact</Text>
              <Field label="Contact name" value={emergencyName} onChangeText={setEmergencyName} placeholder="Name" />
              <Field label="Contact phone" value={emergencyPhone} onChangeText={setEmergencyPhone} placeholder="+852" keyboardType="phone-pad" />
            </View>
          )}

          {step === 1 && (
            <View style={styles.section}>
              <Text style={styles.title}>Plan the support setup</Text>
              <Text style={styles.intro}>Choose the products you plan to use. Pairing will become available when the hardware integration is ready.</Text>
              <ProductChoice
                title="Predictive Gait Insoles"
                description="Track walking patterns and surface changes that may deserve review. This does not diagnose or predict a fall with certainty."
                selected={insolesEnabled}
                onPress={() => setInsolesEnabled((value) => !value)}
              />
              <ProductChoice
                title="Rotary Photo-Dial Communicator"
                description="Assign familiar people to physical dial positions for simpler calling. Calls still depend on power, network, and service availability."
                selected={photoDialEnabled}
                onPress={() => setPhotoDialEnabled((value) => !value)}
              />
              <View style={styles.divider} />
              <Field label="Mobility aid" value={mobilityAid} onChangeText={setMobilityAid} placeholder="e.g. cane, walker, none" />
              <Field label="Recent falls or mobility changes" value={fallHistory} onChangeText={setFallHistory} placeholder="Dates or context a caregiver should know" multiline />
              <Field label="Allergies" value={allergies} onChangeText={setAllergies} placeholder="Separate allergies with commas" multiline />
              <Field label="Caregiver notes" value={medicalNotes} onChangeText={setMedicalNotes} placeholder="Relevant support or health context" multiline />
            </View>
          )}

          {step === 2 && (
            <View style={styles.section}>
              <Text style={styles.title}>Set photo-dial contacts</Text>
              <Text style={styles.intro}>{photoDialEnabled ? 'Add up to eight people in the same order they will appear around the dial.' : 'The photo dial is not selected. You can continue without adding contacts.'}</Text>
              {photoDialEnabled && contacts.map((contact, index) => (
                <View key={contact.clientId} style={styles.contactPanel}>
                  <View style={styles.contactHeading}>
                    <View style={styles.positionBadge}><Text style={styles.positionText}>{index + 1}</Text></View>
                    <Text style={styles.subheading}>Dial position {index + 1}</Text>
                    {contacts.length > 1 && (
                      <Pressable accessibilityRole="button" onPress={() => removeContact(contact.clientId)}>
                        <Text style={styles.removeText}>Remove</Text>
                      </Pressable>
                    )}
                  </View>
                  <Field label="Name *" value={contact.name} onChangeText={(value) => updateContact(contact.clientId, 'name', value)} placeholder="Contact name" />
                  <Field label="Phone *" value={contact.phone} onChangeText={(value) => updateContact(contact.clientId, 'phone', value)} placeholder="+852" keyboardType="phone-pad" />
                  <Field label="Relationship" value={contact.relationship} onChangeText={(value) => updateContact(contact.clientId, 'relationship', value)} placeholder="e.g. daughter, neighbour" />
                </View>
              ))}
              {photoDialEnabled && contacts.length < 8 && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setContacts((current) => [...current, emptyContact(current.length + 1)])}
                  style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
                  <Text style={styles.outlineButtonText}>Add another contact</Text>
                </Pressable>
              )}
              <View style={styles.warning}>
                <Text style={styles.warningTitle}>Not an emergency service</Text>
                <Text style={styles.warningText}>The communicator cannot guarantee that a call connects or is answered. Contact local emergency services directly for urgent help.</Text>
              </View>
            </View>
          )}

          {step === 3 && (
            <View style={styles.section}>
              <Text style={styles.title}>Terms and data consent</Text>
              <Text style={styles.intro}>Read to the end and agree before SilverCare stores the support profile.</Text>
              <ScrollView
                accessibilityLabel="SilverCare Terms of Use"
                nestedScrollEnabled
                onScroll={handleTermsScroll}
                scrollEventThrottle={16}
                style={styles.termsBox}
                contentContainerStyle={styles.termsContent}>
                <Text style={styles.termsVersion}>SILVERCARE TERMS OF USE - VERSION {TERMS_VERSION}</Text>
                <Text style={styles.termsHeading}>1. Prototype and intended use</Text>
                <Text style={styles.termsText}>SilverCare and its planned connected products are support tools under development. They are not certified medical devices, healthcare providers, diagnostic tools, fall-prevention guarantees, or emergency services.</Text>
                <Text style={styles.termsHeading}>2. Gait information</Text>
                <Text style={styles.termsText}>Insole readings may highlight walking trends for review but can be incomplete or inaccurate. They do not diagnose a condition or reliably predict a fall. Seek qualified medical advice for health or mobility concerns.</Text>
                <Text style={styles.termsHeading}>3. Communication availability</Text>
                <Text style={styles.termsText}>Photo-dial calls depend on correct setup, power, network coverage, third-party phone services, and the recipient answering. Do not rely on the communicator as the only way to obtain urgent help.</Text>
                <Text style={styles.termsHeading}>4. Emergencies</Text>
                <Text style={styles.termsText}>Contact local emergency services directly for urgent assistance. Do not wait for an app alert, gait reading, or photo-dial call.</Text>
                <Text style={styles.termsHeading}>5. Personal and health data consent</Text>
                <Text style={styles.termsText}>You consent to SilverCare storing the personal details, emergency contact, mobility context, allergies, caregiver notes, photo contacts, product preferences, gait readings, and consent record you provide. This data is used to operate your account and connected SilverCare products.</Text>
                <Text style={styles.termsHeading}>6. Authorization and accuracy</Text>
                <Text style={styles.termsText}>Protect your password, keep information accurate, and do not enter another person’s information unless you are authorized to act for them. Confirm contact numbers and product setup before use.</Text>
                <Text style={styles.termsHeading}>7. Availability and changes</Text>
                <Text style={styles.termsText}>The service may be interrupted and features may change. Material terms changes require renewed consent before continued use.</Text>
                <Text style={styles.termsEnd}>END OF TERMS</Text>
              </ScrollView>
              {!termsRead && <Text style={styles.scrollHint}>Scroll to the end to enable agreement.</Text>}
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: termsAccepted, disabled: !termsRead }}
                disabled={!termsRead}
                onPress={() => setTermsAccepted((value) => !value)}
                style={[styles.consentRow, !termsRead && styles.disabled]}>
                <View style={[styles.checkbox, termsAccepted && styles.checkboxChecked]}>
                  {termsAccepted && <Text style={styles.checkmark}>X</Text>}
                </View>
                <Text style={styles.consentText}>I have read and agree to the Terms of Use and consent to the storage of the personal and health data described above.</Text>
              </Pressable>
            </View>
          )}

          {(validationError || error) && <Text style={styles.error}>{validationError || error}</Text>}

          <View style={styles.actions}>
            {step > 0 && (
              <Pressable accessibilityRole="button" onPress={() => { setStep((current) => current - 1); setValidationError(null); }} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
                <Text style={styles.backButtonText}>Back</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={continueFlow}
              style={({ pressed }) => [styles.continueButton, pressed && styles.pressed, loading && styles.disabled]}>
              <Text style={styles.continueButtonText}>{loading ? 'Saving...' : step === 3 ? 'Agree and finish' : 'Continue'}</Text>
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F1' },
  safeArea: { flex: 1 },
  page: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: 20, paddingBottom: 48, gap: 20 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#116A58', fontSize: 13, fontWeight: '900', letterSpacing: 0 },
  exitText: { color: '#6A726E', fontSize: 14, fontWeight: '700' },
  progressRow: { flexDirection: 'row', gap: 6 },
  progressItem: { flex: 1, gap: 6 },
  progressBar: { height: 4, borderRadius: 2, backgroundColor: '#D7DCD7' },
  progressBarActive: { backgroundColor: '#116A58' },
  progressLabel: { color: '#858C88', fontSize: 10, fontWeight: '700', textAlign: 'center' },
  progressLabelActive: { color: '#116A58' },
  section: { gap: 14 },
  title: { color: '#17211E', fontSize: 31, lineHeight: 37, fontWeight: '900', letterSpacing: 0 },
  intro: { color: '#59635F', fontSize: 16, lineHeight: 23, marginBottom: 4 },
  field: { gap: 7 },
  label: { color: '#38443F', fontSize: 13, fontWeight: '800' },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#C9D0CB', borderRadius: 6, paddingHorizontal: 14, color: '#17211E', backgroundColor: '#FFFFFF', fontSize: 16 },
  textArea: { minHeight: 88, paddingTop: 13, textAlignVertical: 'top' },
  divider: { height: 1, backgroundColor: '#D9DED9', marginVertical: 4 },
  subheading: { color: '#26322E', fontSize: 18, fontWeight: '800' },
  productChoice: { minHeight: 92, flexDirection: 'row', alignItems: 'flex-start', gap: 13, borderWidth: 1, borderColor: '#C9D0CB', borderRadius: 8, padding: 16, backgroundColor: '#FFFFFF' },
  productChoiceSelected: { borderColor: '#116A58', backgroundColor: '#EAF3EF' },
  choiceCopy: { flex: 1, gap: 4 },
  choiceTitle: { color: '#17211E', fontSize: 17, fontWeight: '900' },
  choiceDescription: { color: '#56615C', fontSize: 13, lineHeight: 19 },
  contactPanel: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 8, padding: 16, gap: 12 },
  contactHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  positionBadge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#DDECE6' },
  positionText: { color: '#116A58', fontSize: 13, fontWeight: '900' },
  removeText: { marginLeft: 'auto', color: '#A33827', fontSize: 13, fontWeight: '800' },
  outlineButton: { minHeight: 50, borderWidth: 1, borderColor: '#116A58', borderRadius: 6, alignItems: 'center', justifyContent: 'center' },
  outlineButtonText: { color: '#116A58', fontSize: 15, fontWeight: '800' },
  warning: { borderLeftWidth: 4, borderLeftColor: '#B87520', backgroundColor: '#F7EACD', borderRadius: 5, padding: 14, gap: 4 },
  warningTitle: { color: '#70470E', fontSize: 14, fontWeight: '800' },
  warningText: { color: '#76571F', fontSize: 13, lineHeight: 19 },
  termsBox: { maxHeight: 340, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#C9D0CB', borderRadius: 6 },
  termsContent: { padding: 18, gap: 9 },
  termsVersion: { color: '#116A58', fontSize: 11, fontWeight: '900' },
  termsHeading: { color: '#17211E', fontSize: 15, fontWeight: '900', marginTop: 6 },
  termsText: { color: '#4F5A55', fontSize: 13, lineHeight: 20 },
  termsEnd: { color: '#116A58', fontSize: 12, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  scrollHint: { color: '#8A5A12', fontSize: 12, fontWeight: '700' },
  consentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: '#E7F1EC', padding: 14, borderRadius: 6 },
  checkbox: { width: 24, height: 24, borderWidth: 2, borderColor: '#116A58', borderRadius: 4, alignItems: 'center', justifyContent: 'center' },
  checkboxChecked: { backgroundColor: '#116A58' },
  checkmark: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' },
  consentText: { flex: 1, color: '#27483F', fontSize: 13, lineHeight: 19, fontWeight: '600' },
  error: { color: '#9D2E21', backgroundColor: '#F9DDD7', padding: 12, borderRadius: 5, lineHeight: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  backButton: { minHeight: 50, minWidth: 96, borderWidth: 1, borderColor: '#9DA6A1', borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  backButtonText: { color: '#4F5955', fontSize: 15, fontWeight: '800' },
  continueButton: { minHeight: 50, minWidth: 150, backgroundColor: '#116A58', borderRadius: 6, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  continueButtonText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.48 },
});