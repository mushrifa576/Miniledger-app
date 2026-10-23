import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatMoney } from '../format';
import { colors } from '../theme';
import { Summary } from '../types';

function Stat({ label, value, color }: { label: string; value: number; color?: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color ? { color } : null]} adjustsFontSizeToFit numberOfLines={1}>{formatMoney(value)}</Text>
    </View>
  );
}

export function SummaryCard({ summary }: { summary: Summary | null }) {
  const s = summary ?? { totalLent: 0, totalRepaid: 0, outstanding: 0, overdueAmount: 0 };
  return (
    <View style={styles.card} testID="summary-card">
      <Text style={styles.title}>Outstanding</Text>
      <Text style={styles.big}>{formatMoney(s.outstanding)}</Text>
      <View style={styles.row}>
        <Stat label="Total lent" value={s.totalLent} />
        <Stat label="Repaid" value={s.totalRepaid} color={colors.success} />
        <Stat label="Overdue" value={s.overdueAmount} color={s.overdueAmount > 0 ? colors.danger : colors.muted} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  title: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  big: { color: colors.text, fontSize: 32, fontWeight: '800', marginTop: 2, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  label: { color: colors.muted, fontSize: 12 },
  value: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 2 },
});
