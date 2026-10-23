import { DefaultTheme, ThemeProvider } from 'expo-router';

import { AuthScreen } from '@/components/account/auth-screen';
import { LoadingScreen } from '@/components/account/loading-screen';
import { ProductOnboardingScreen } from '@/components/account/product-onboarding-screen';
import AppTabs from '@/components/app-tabs';
import { AccountProvider, TERMS_VERSION, useAccount } from '@/providers/account-provider';
import { TimeBankProvider } from '@/providers/time-bank-provider';

function AccountGate() {
  const { session, demoMode, profile, loading, editingProfile } = useAccount();

  if (loading) return <LoadingScreen />;
  if (!session && !demoMode) return <AuthScreen />;
  if (!profile?.product_setup_completed || profile.terms_version !== TERMS_VERSION || editingProfile) {
    return <ProductOnboardingScreen />;
  }

  return <AppTabs />;
}

export default function TabLayout() {
  return (
    <ThemeProvider value={DefaultTheme}>
      <AccountProvider>
        <MemberWorkspace />
      </AccountProvider>
    </ThemeProvider>
  );
}

function MemberWorkspace() {
  const { session, demoMode } = useAccount();
  return (
    <TimeBankProvider key={demoMode ? 'demo' : session?.user.id ?? 'signed-out'}>
      <AccountGate />
    </TimeBankProvider>
  );
}
