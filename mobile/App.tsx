import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
import { ActivityIndicator, BackHandler, View } from 'react-native';
import { SafeAreaView } from 'react-native';
import { AuthProvider, useAuth } from './src/auth';
import { AddLoanScreen } from './src/screens/AddLoanScreen';
import { LoansScreen } from './src/screens/LoansScreen';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme';

// Three screens and no deep links, so a tiny state machine beats pulling in a
// navigation library. If this grows (detail screens, tabs), swap in React Navigation.
function Root() {
  const { ready, isLoggedIn, signOut } = useAuth();
  const [screen, setScreen] = useState<'list' | 'add'>('list');
  const [refreshKey, setRefreshKey] = useState(0);

  React.useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'add') { setScreen('list'); return true; } // Android back closes the form
      return false;
    });
    return () => sub.remove();
  }, [screen]);

  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
  if (!isLoggedIn) return <LoginScreen />;
  if (screen === 'add') {
    return <AddLoanScreen onCancel={() => setScreen('list')} onDone={() => { setRefreshKey((k) => k + 1); setScreen('list'); }} />;
  }
  return <LoansScreen refreshKey={refreshKey} onAdd={() => setScreen('add')} onLogout={() => { void signOut(); }} />;
}

export default function App() {
  return (
    <AuthProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
        <StatusBar style="dark" />
        <Root />
      </SafeAreaView>
    </AuthProvider>
  );
}
