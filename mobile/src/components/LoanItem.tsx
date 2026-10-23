import React from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { authHeaders, receiptUrl } from '../api';
import { formatMoney } from '../format';
import { colors } from '../theme';
import { Loan } from '../types';

interface Props {
  loan: Loan;
  busy: boolean;
  onRepay: (loan: Loan) => void;
}

export function LoanItem({ loan, busy, onRepay }: Props) {
  const repaid = loan.repaidAt !== null;
  return (
    <View style={[styles.card, loan.isOverdue && styles.overdueCard]} testID={`loan-${loan.id}`}>
      <View style={styles.left}>
        <Text style={styles.name}>{loan.friendName}</Text>
        <Text style={[styles.due, loan.isOverdue && styles.overdueText]}>
          {repaid ? `Repaid ${loan.repaidAt!.slice(0, 10)}` : `${loan.isOverdue ? 'OVERDUE · was due' : 'Due'} ${loan.dueDate}`}
        </Text>
        {loan.hasReceipt && (
          <Image
            source={{ uri: receiptUrl(loan.id), headers: authHeaders() }} // receipts are private: send the token
            style={styles.receipt}
            accessibilityLabel="Receipt photo"
          />
        )}
      </View>
      <View style={styles.right}>
        <Text style={[styles.amount, repaid && styles.repaidAmount]}>{formatMoney(loan.amount)}</Text>
        {repaid ? (
          <View style={styles.paidBadge}><Text style={styles.paidText}>Repaid</Text></View>
        ) : (
          <Pressable style={styles.button} onPress={() => onRepay(loan)} disabled={busy} accessibilityRole="button">
            {busy ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.buttonText}>Mark repaid</Text>}
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', backgroundColor: colors.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: colors.border },
  overdueCard: { backgroundColor: colors.dangerBg, borderColor: colors.danger, borderLeftWidth: 5 },
  left: { flex: 1, paddingRight: 8 },
  right: { alignItems: 'flex-end', justifyContent: 'space-between' },
  name: { fontSize: 17, fontWeight: '700', color: colors.text },
  due: { fontSize: 13, color: colors.muted, marginTop: 3 },
  overdueText: { color: colors.danger, fontWeight: '700' },
  amount: { fontSize: 18, fontWeight: '800', color: colors.text },
  repaidAmount: { color: colors.muted, textDecorationLine: 'line-through' },
  receipt: { width: 56, height: 56, borderRadius: 8, marginTop: 8, backgroundColor: colors.border },
  button: { backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, minWidth: 104, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  paidBadge: { backgroundColor: colors.successBg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  paidText: { color: colors.success, fontWeight: '700', fontSize: 12 },
});
