import { DarkTheme, DefaultTheme, ThemeProvider } from 'expo-router';
import { useColorScheme } from 'react-native';

import { AuthScreen } from '@/components/account/auth-screen';
import { LoadingScreen } from '@/components/account/loading-screen';
import { ProductOnboardingScreen } from '@/components/account/product-onboarding-screen';
import AppTabs from '@/components/app-tabs';
import { AccountProvider, TERMS_VERSION, useAccount } from '@/providers/account-provider';

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
  const colorScheme = useColorScheme();
  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AccountProvider>
        <AccountGate />
      </AccountProvider>
    </ThemeProvider>
  );
}
