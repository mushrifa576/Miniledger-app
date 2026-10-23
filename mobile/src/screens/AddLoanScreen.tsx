import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import { ActivityIndicator, Alert, Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { createLoan } from '../api';
import { todayPlus, validateLoanForm } from '../format';
import { colors } from '../theme';
import { ReceiptFile } from '../types';

interface Props {
  onDone: () => void;   // loan saved
  onCancel: () => void;
}

export function AddLoanScreen({ onDone, onCancel }: Props) {
  const [friendName, setFriendName] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(todayPlus(30));
  const [receipt, setReceipt] = useState<ReceiptFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async (source: 'camera' | 'library') => {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return Alert.alert('Permission needed', 'Allow access in Settings to attach a receipt.');
    const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6 }; // compress: receipts don't need 12MP
    const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (result.canceled) return;
    const a = result.assets[0];
    const type = a.mimeType === 'image/png' ? 'image/png' : 'image/jpeg'; // server accepts jpeg/png/webp
    setReceipt({ uri: a.uri, type, name: `receipt.${type === 'image/png' ? 'png' : 'jpg'}` });
  };

  const submit = async () => {
    const problem = validateLoanForm(friendName, amount, dueDate);
    if (problem) return setError(problem);
    setBusy(true); setError(null);
    try {
      await createLoan({ friendName, amount, dueDate, receipt: receipt ?? undefined });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the loan');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>New loan</Text>

        <Text style={styles.label}>Friend’s name</Text>
        <TextInput style={styles.input} value={friendName} onChangeText={setFriendName} placeholder="e.g. Arun" maxLength={100} editable={!busy} testID="name-input" />

        <Text style={styles.label}>Amount (₹)</Text>
        <TextInput style={styles.input} value={amount} onChangeText={setAmount} placeholder="500" keyboardType="decimal-pad" editable={!busy} testID="amount-input" />

        <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
        <TextInput style={styles.input} value={dueDate} onChangeText={setDueDate} placeholder="2026-12-31" keyboardType="numbers-and-punctuation" maxLength={10} editable={!busy} testID="date-input" />

        <Text style={styles.label}>Receipt photo (optional)</Text>
        {receipt && <Image source={{ uri: receipt.uri }} style={styles.preview} />}
        <View style={styles.row}>
          <Pressable style={styles.secondary} onPress={() => pick('camera')} disabled={busy}><Text style={styles.secondaryText}>Take photo</Text></Pressable>
          <Pressable style={styles.secondary} onPress={() => pick('library')} disabled={busy}><Text style={styles.secondaryText}>Choose photo</Text></Pressable>
          {receipt && <Pressable style={styles.secondary} onPress={() => setReceipt(null)} disabled={busy}><Text style={[styles.secondaryText, { color: colors.danger }]}>Remove</Text></Pressable>}
        </View>

        {error && <Text style={styles.error} accessibilityRole="alert">{error}</Text>}

        <Pressable style={[styles.primary, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy} testID="save-loan">
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save loan</Text>}
        </Pressable>
        <Pressable onPress={onCancel} disabled={busy}><Text style={styles.cancel}>Cancel</Text></Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 },
  label: { color: colors.text, fontWeight: '600', marginTop: 14, marginBottom: 6 },
  input: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, fontSize: 16 },
  row: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  secondary: { borderWidth: 1, borderColor: colors.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: colors.primary, fontWeight: '600' },
  preview: { width: 120, height: 120, borderRadius: 10, marginBottom: 10, backgroundColor: colors.border },
  primary: { backgroundColor: colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  cancel: { color: colors.muted, textAlign: 'center', marginTop: 16, fontWeight: '600' },
  error: { color: colors.danger, marginTop: 16 },
});
