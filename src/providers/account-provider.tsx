import { Session } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { createContext, PropsWithChildren, useContext, useEffect, useRef, useState } from 'react';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const TERMS_VERSION = '2026-09-13';

export type UserProfile = {
  id: string;
  full_name: string;
  date_of_birth: string | null;
  phone: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  allergies: string[];
  medical_notes: string | null;
  mobility_aid: string | null;
  fall_history: string | null;
  predictive_insoles_enabled: boolean;
  photo_dial_enabled: boolean;
  terms_version: string;
  terms_accepted_at: string;
  onboarding_completed: boolean;
  product_setup_completed: boolean;
};

export type PhotoContact = {
  id?: string;
  name: string;
  phone: string;
  relationship: string;
  dial_position: number;
};

export type ProductOnboardingData = {
  fullName: string;
  dateOfBirth: string;
  phone: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  allergies: string[];
  medicalNotes: string;
  mobilityAid: string;
  fallHistory: string;
  predictiveInsolesEnabled: boolean;
  photoDialEnabled: boolean;
  photoContacts: PhotoContact[];
};

type AccountContextValue = {
  configured: boolean;
  session: Session | null;
  demoMode: boolean;
  profile: UserProfile | null;
  photoContacts: PhotoContact[];
  loading: boolean;
  error: string | null;
  notice: string | null;
  editingProfile: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  startDemo: () => void;
  signOut: () => Promise<void>;
  saveProductOnboarding: (data: ProductOnboardingData) => Promise<void>;
  startProfileEdit: () => void;
  cancelProfileEdit: () => void;
};

const AccountContext = createContext<AccountContextValue | null>(null);

const DEMO_PROFILE: UserProfile = {
  id: 'demo-user',
  full_name: 'Margaret Lee',
  date_of_birth: '1948-04-16',
  phone: '+852 5555 0101',
  emergency_contact_name: 'Daniel Lee',
  emergency_contact_phone: '+852 5555 0188',
  allergies: ['Penicillin'],
  medical_notes: 'Prefers a morning walk with a family member.',
  mobility_aid: 'Walking cane outdoors',
  fall_history: 'One minor fall six months ago; no injury.',
  predictive_insoles_enabled: true,
  photo_dial_enabled: true,
  terms_version: TERMS_VERSION,
  terms_accepted_at: new Date().toISOString(),
  onboarding_completed: true,
  product_setup_completed: true,
};

const DEMO_CONTACTS: PhotoContact[] = [
  { id: 'demo-1', name: 'Daniel', phone: '+852 5555 0188', relationship: 'Son', dial_position: 1 },
  { id: 'demo-2', name: 'Mei', phone: '+852 5555 0124', relationship: 'Daughter', dial_position: 2 },
  { id: 'demo-3', name: 'Dr. Wong', phone: '+852 5555 0196', relationship: 'Clinic', dial_position: 3 },
];

export function AccountProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [demoMode, setDemoMode] = useState(false);
  const demoModeRef = useRef(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [photoContacts, setPhotoContacts] = useState<PhotoContact[]>([]);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);

  const loadUserData = async (userId: string) => {
    if (!supabase) return;
    const [profileResult, contactResult] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
      supabase.from('photo_contacts').select('*').eq('user_id', userId).order('dial_position'),
    ]);
    if (profileResult.error) throw profileResult.error;
    if (contactResult.error) throw contactResult.error;
    setProfile(profileResult.data as UserProfile | null);
    setPhotoContacts((contactResult.data ?? []) as PhotoContact[]);
  };

  useEffect(() => {
    const client = supabase;
    if (!client) {
      setLoading(false);
      return;
    }

    const initializeSession = async () => {
      try {
        const { data, error: sessionError } = await client.auth.getSession();
        if (sessionError) throw sessionError;
        setSession(data.session);
        if (data.session) await loadUserData(data.session.user.id);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : 'Could not load your account.');
      } finally {
        setLoading(false);
      }
    };
    initializeSession();

    const { data: authListener } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (!nextSession && !demoModeRef.current) {
        setProfile(null);
        setPhotoContacts([]);
      }
    });

    const appStateListener = Platform.OS === 'web'
      ? null
      : AppState.addEventListener('change', (state) => {
          if (state === 'active') client.auth.startAutoRefresh();
          else client.auth.stopAutoRefresh();
        });

    return () => {
      authListener.subscription.unsubscribe();
      appStateListener?.remove();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      if (data.user) await loadUserData(data.user.id);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  };

  const startDemo = () => {
    setError(null);
    setNotice(null);
    demoModeRef.current = true;
    setDemoMode(true);
    setProfile(DEMO_PROFILE);
    setPhotoContacts(DEMO_CONTACTS);
  };

  const signUp = async (email: string, password: string) => {
    if (!supabase) return;
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;
      if (!data.session) setNotice('Check your email to confirm your account, then sign in.');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not create the account.');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    if (demoMode) {
      demoModeRef.current = false;
      setDemoMode(false);
      setProfile(null);
      setPhotoContacts([]);
      setEditingProfile(false);
      return;
    }
    if (!supabase) return;
    setLoading(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) throw signOutError;
      setEditingProfile(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not sign out.');
    } finally {
      setLoading(false);
    }
  };

  const saveProductOnboarding = async (data: ProductOnboardingData) => {
    if (demoMode) {
      setProfile((current) => current ? {
        ...current,
        full_name: data.fullName,
        date_of_birth: data.dateOfBirth || null,
        phone: data.phone || null,
        emergency_contact_name: data.emergencyContactName || null,
        emergency_contact_phone: data.emergencyContactPhone || null,
        allergies: data.allergies,
        medical_notes: data.medicalNotes || null,
        mobility_aid: data.mobilityAid || null,
        fall_history: data.fallHistory || null,
        predictive_insoles_enabled: data.predictiveInsolesEnabled,
        photo_dial_enabled: data.photoDialEnabled,
      } : current);
      setPhotoContacts(data.photoContacts);
      setEditingProfile(false);
      return;
    }
    if (!supabase || !session) return;
    setLoading(true);
    setError(null);
    try {
      const { error: saveError } = await supabase.rpc('complete_product_onboarding', {
        p_full_name: data.fullName,
        p_date_of_birth: data.dateOfBirth || null,
        p_phone: data.phone,
        p_emergency_contact_name: data.emergencyContactName,
        p_emergency_contact_phone: data.emergencyContactPhone,
        p_allergies: data.allergies,
        p_medical_notes: data.medicalNotes,
        p_mobility_aid: data.mobilityAid,
        p_fall_history: data.fallHistory,
        p_predictive_insoles_enabled: data.predictiveInsolesEnabled,
        p_photo_dial_enabled: data.photoDialEnabled,
        p_terms_version: TERMS_VERSION,
        p_photo_contacts: data.photoContacts,
      });
      if (saveError) throw saveError;
      await loadUserData(session.user.id);
      setEditingProfile(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not save the support profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AccountContext.Provider
      value={{
        configured: isSupabaseConfigured,
        session,
        demoMode,
        profile,
        photoContacts,
        loading,
        error,
        notice,
        editingProfile,
        signIn,
        signUp,
        startDemo,
        signOut,
        saveProductOnboarding,
        startProfileEdit: () => setEditingProfile(true),
        cancelProfileEdit: () => setEditingProfile(false),
      }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const context = useContext(AccountContext);
  if (!context) throw new Error('useAccount must be used inside AccountProvider');
  return context;
}