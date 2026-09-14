import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAccount } from '@/providers/account-provider';

export function AuthScreen() {
  const { configured, loading, error, notice, signIn, signUp, startDemo } = useAccount();
  const [createAccount, setCreateAccount] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const submit = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes('@')) {
      setLocalError('Enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setLocalError('Password must be at least 8 characters.');
      return;
    }
    setLocalError(null);
    if (createAccount) await signUp(normalizedEmail, password);
    else await signIn(normalizedEmail, password);
  };

  if (!configured) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.setupPanel}>
          <Text style={styles.brand}>SILVERCARE</Text>
          <Text style={styles.title}>Connect the secure database</Text>
          <Text style={styles.body}>Add your Supabase project details to a local environment file, then restart Expo.</Text>
          <View style={styles.codeBlock}>
            <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_URL=...</Text>
            <Text style={styles.code}>EXPO_PUBLIC_SUPABASE_ANON_KEY=...</Text>
          </View>
          <Text style={styles.note}>Use only the public anon key. Never place a service-role key in this app.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <Text style={styles.brand}>SILVERCARE</Text>
            <Text style={styles.title}>{createAccount ? 'Create your account' : 'Welcome back'}</Text>
            <Text style={styles.body}>Your support profile, mobility context, and trusted contacts stay attached to your private account.</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email address</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              onChangeText={setEmail}
              placeholder="name@example.com"
              placeholderTextColor="#8A918D"
              style={styles.input}
              value={email}
            />
            <Text style={styles.label}>Password</Text>
            <TextInput
              autoCapitalize="none"
              autoComplete={createAccount ? 'new-password' : 'current-password'}
              onChangeText={setPassword}
              placeholder="At least 8 characters"
              placeholderTextColor="#8A918D"
              secureTextEntry
              style={styles.input}
              value={password}
            />

            {(localError || error) && <Text style={styles.error}>{localError || error}</Text>}
            {notice && <Text style={styles.notice}>{notice}</Text>}

            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={submit}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed, loading && styles.disabled]}>
              <Text style={styles.primaryButtonText}>
                {loading ? 'Please wait...' : createAccount ? 'Create account' : 'Sign in'}
              </Text>
            </Pressable>
            {!createAccount && (
              <Pressable
                accessibilityRole="button"
                onPress={startDemo}
                style={({ pressed }) => [styles.demoButton, pressed && styles.pressed]}>
                <Text style={styles.demoButtonText}>Explore demo</Text>
              </Pressable>
            )}
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setCreateAccount((value) => !value);
                setLocalError(null);
              }}
              style={({ pressed }) => [styles.switchButton, pressed && styles.pressed]}>
              <Text style={styles.switchText}>
                {createAccount ? 'Already have an account? Sign in' : 'New to SilverCare? Create an account'}
              </Text>
            </Pressable>
          </View>

          <Text style={styles.privacy}>Personal and health context is requested only after account creation and is isolated per user in the database.</Text>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F1' },
  safeArea: { flex: 1 },
  content: { flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', justifyContent: 'center', padding: 24, gap: 28 },
  intro: { gap: 9 },
  brand: { color: '#116A58', fontSize: 13, fontWeight: '900', letterSpacing: 0 },
  title: { color: '#17211E', fontSize: 36, lineHeight: 42, fontWeight: '900', letterSpacing: 0 },
  body: { color: '#59635F', fontSize: 16, lineHeight: 23 },
  form: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 8, padding: 20, gap: 11 },
  label: { color: '#38443F', fontSize: 13, fontWeight: '800', marginTop: 2 },
  input: { minHeight: 50, borderWidth: 1, borderColor: '#C9D0CB', borderRadius: 6, paddingHorizontal: 14, color: '#17211E', backgroundColor: '#FAFBF8', fontSize: 16 },
  error: { color: '#9D2E21', backgroundColor: '#F9DDD7', padding: 12, borderRadius: 5, lineHeight: 20 },
  notice: { color: '#0B5E4C', backgroundColor: '#D8EFE7', padding: 12, borderRadius: 5, lineHeight: 20 },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', backgroundColor: '#116A58', borderRadius: 6, marginTop: 4 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  demoButton: { minHeight: 50, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#116A58', borderRadius: 6 },
  demoButtonText: { color: '#116A58', fontSize: 15, fontWeight: '800' },
  switchButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  switchText: { color: '#116A58', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  privacy: { color: '#747C78', fontSize: 12, lineHeight: 18, textAlign: 'center' },
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.55 },
  setupPanel: { width: '90%', maxWidth: 560, alignSelf: 'center', marginTop: 100, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#D9DED9', borderRadius: 8, padding: 24, gap: 14 },
  codeBlock: { backgroundColor: '#17211E', borderRadius: 6, padding: 15, gap: 6 },
  code: { color: '#D8EFE7', fontFamily: 'monospace', fontSize: 12 },
  note: { color: '#795417', backgroundColor: '#F7EACD', padding: 12, borderRadius: 5, fontSize: 13, lineHeight: 19 },
});