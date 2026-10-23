export interface Loan {
  id: string;
  friendName: string;
  amount: number;
  dueDate: string; // YYYY-MM-DD
  repaidAt: string | null;
  hasReceipt: boolean;
  isOverdue: boolean;
}

export interface Summary {
  totalLent: number;
  totalRepaid: number;
  outstanding: number;
  overdueAmount: number;
}

export interface ReceiptFile {
  uri: string;
  name: string;
  type: string;
}
