import * as SecureStore from 'expo-secure-store';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { setToken, setUnauthorizedHandler } from './api';

const KEY = 'miniledger_token';

interface AuthState {
  ready: boolean;            // false while we check SecureStore on launch
  isLoggedIn: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [isLoggedIn, setLoggedIn] = useState(false);

  const signOut = useCallback(async () => {
    setToken(null);
    setLoggedIn(false);
    await SecureStore.deleteItemAsync(KEY).catch(() => undefined);
  }, []);

  const signIn = useCallback(async (token: string) => {
    setToken(token);
    await SecureStore.setItemAsync(KEY, token); // Keychain / Keystore, not plain AsyncStorage
    setLoggedIn(true);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => { void signOut(); });
    SecureStore.getItemAsync(KEY)
      .then((t) => { if (t) { setToken(t); setLoggedIn(true); } })
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [signOut]);

  const value = useMemo(() => ({ ready, isLoggedIn, signIn, signOut }), [ready, isLoggedIn, signIn, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};
