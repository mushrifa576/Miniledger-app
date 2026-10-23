import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { fetchLoans, fetchSummary, markRepaid } from '../api';
import { LoanItem } from '../components/LoanItem';
import { SummaryCard } from '../components/SummaryCard';
import { colors } from '../theme';
import { Loan, Summary } from '../types';

interface Props {
  refreshKey: number;        // bumped by the parent after a loan is added
  onAdd: () => void;
  onLogout: () => void;
}

export function LoansScreen({ refreshKey, onAdd, onLogout }: Props) {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Summary and list are fetched together so the card can never disagree with the list.
  const load = useCallback(async () => {
    try {
      const [l, s] = await Promise.all([fetchLoans(), fetchSummary()]);
      setLoans(l); setSummary(s); setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }, []);

  useEffect(() => { setLoading(true); load().finally(() => setLoading(false)); }, [load, refreshKey]);

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const repay = (loan: Loan) =>
    Alert.alert('Mark as repaid?', `${loan.friendName} paid you back in full.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Yes, repaid',
        onPress: async () => {
          setBusyId(loan.id);
          try { await markRepaid(loan.id); await load(); }
          catch (e) { Alert.alert('Could not update', e instanceof Error ? e.message : 'Try again'); }
          finally { setBusyId(null); }
        },
      },
    ]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My loans</Text>
        <Pressable onPress={onLogout} accessibilityRole="button"><Text style={styles.logout}>Log out</Text></Pressable>
      </View>

      {loading ? (
        <ActivityIndicator style={{ marginTop: 48 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={loans}
          keyExtractor={(l) => l.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListHeaderComponent={
            <>
              <SummaryCard summary={summary} />
              {error && <Text style={styles.error}>{error} — pull down to retry.</Text>}
            </>
          }
          renderItem={({ item }) => <LoanItem loan={item} busy={busyId === item.id} onRepay={repay} />}
          ListEmptyComponent={error ? undefined : <Text style={styles.empty}>No loans yet. Tap “+” to add the first one.</Text>}
        />
      )}

      <Pressable style={styles.fab} onPress={onAdd} accessibilityLabel="Add loan" testID="add-loan">
        <Text style={styles.fabText}>＋</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', color: colors.text },
  logout: { color: colors.primary, fontWeight: '600' },
  list: { padding: 16, paddingBottom: 96 },
  empty: { textAlign: 'center', color: colors.muted, marginTop: 32 },
  error: { color: colors.danger, marginBottom: 12 },
  fab: { position: 'absolute', right: 20, bottom: 28, width: 60, height: 60, borderRadius: 30, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 3 } },
  fabText: { color: '#fff', fontSize: 30, marginTop: -2 },
});
