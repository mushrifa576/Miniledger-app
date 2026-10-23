import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { requestOtp, verifyOtp } from '../api';
import { useAuth } from '../auth';
import { colors } from '../theme';

export function LoginScreen() {
  const { signIn } = useAuth();
  const [phone, setPhone] = useState('+91');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true); setError(null);
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : 'Something went wrong'); } finally { setBusy(false); }
  };

  const sendOtp = () => run(async () => {
    if (!/^\+[1-9]\d{7,14}$/.test(phone.trim())) throw new Error('Enter your number with country code, e.g. +919876543210');
    await requestOtp(phone.trim());
    setStep('otp');
  });

  const submitOtp = () => run(async () => {
    if (!/^\d{6}$/.test(otp)) throw new Error('Enter the 6-digit code.');
    const { token } = await verifyOtp(phone.trim(), otp);
    await signIn(token);
  });

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.logo}>MiniLedger</Text>
      <Text style={styles.tagline}>Keep track of money you lend to friends.</Text>

      {step === 'phone' ? (
        <>
          <Text style={styles.label}>Phone number</Text>
          <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel"
            placeholder="+919876543210" editable={!busy} testID="phone-input" />
          <Pressable style={[styles.button, busy && styles.disabled]} onPress={sendOtp} disabled={busy} testID="send-otp">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send OTP</Text>}
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.label}>Enter the 6-digit code sent to {phone}</Text>
          <TextInput style={[styles.input, styles.otpInput]} value={otp} onChangeText={(t) => setOtp(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad" maxLength={6} placeholder="••••••" editable={!busy} autoFocus testID="otp-input" />
          <Text style={styles.hint}>Demo mode: the OTP is printed in the server log.</Text>
          <Pressable style={[styles.button, busy && styles.disabled]} onPress={submitOtp} disabled={busy} testID="verify-otp">
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Verify & continue</Text>}
          </Pressable>
          <Pressable onPress={() => { setStep('phone'); setOtp(''); setError(null); }} disabled={busy}>
            <Text style={styles.link}>Use a different number</Text>
          </Pressable>
        </>
      )}
      {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg },
  logo: { fontSize: 34, fontWeight: '800', color: colors.primary },
  tagline: { color: colors.muted, marginBottom: 32, marginTop: 4 },
  label: { color: colors.text, fontWeight: '600', marginBottom: 8 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 18 },
  otpInput: { letterSpacing: 8, textAlign: 'center', fontSize: 24 },
  hint: { color: colors.muted, fontSize: 12, marginTop: 8 },
  button: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 },
  disabled: { opacity: 0.6 },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  link: { color: colors.primary, textAlign: 'center', marginTop: 16, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 16, textAlign: 'center' },
});
