const money = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
export const formatMoney = (n: number) => money.format(n);

export const todayPlus = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Mirrors the server's rules so users get instant feedback; the server remains the source of truth.
export function validateLoanForm(friendName: string, amount: string, dueDate: string): string | null {
  if (!friendName.trim()) return 'Enter your friend’s name.';
  const n = Number(amount);
  if (!amount.trim() || !Number.isFinite(n) || n <= 0) return 'Enter an amount greater than 0.';
  if (!/^\d+(\.\d{1,2})?$/.test(amount.trim())) return 'Amount can have at most 2 decimal places.';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return 'Due date must look like 2026-12-31.';
  const d = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== dueDate) return 'That due date does not exist.';
  return null;
}
