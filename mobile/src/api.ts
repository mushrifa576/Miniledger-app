import { FileSystemUploadType, uploadAsync } from 'expo-file-system/legacy';
import { API_URL } from './config';
import { Loan, ReceiptFile, Summary } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: () => void = () => undefined;
export const setToken = (t: string | null) => { token = t; };
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };
export const authHeaders = (): Record<string, string> => (token ? { Authorization: `Bearer ${token}` } : {});
export const receiptUrl = (loanId: string) => `${API_URL}/loans/${loanId}/receipt`;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers: { ...authHeaders(), ...(init.headers as object) } });
  } catch {
    throw new ApiError(0, `Cannot reach the server at ${API_URL}. Is the backend running?`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // An expired/invalid token on a protected call logs the user out. (A wrong OTP is also 401, but there is no token yet.)
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, body.error ?? `Request failed (${res.status})`);
  }
  return body as T;
}

const json = (body: object): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

export const requestOtp = (phone: string) => request<{ message: string }>('/auth/request-otp', json({ phone }));
export const verifyOtp = (phone: string, otp: string) =>
  request<{ token: string; user: { id: string; phone: string } }>('/auth/verify-otp', json({ phone, otp }));

export const fetchLoans = () => request<{ loans: Loan[] }>('/loans').then((r) => r.loans);
export const fetchSummary = () => request<Summary>('/summary');
export const markRepaid = (id: string) => request<{ loan: Loan }>(`/loans/${id}/repay`, { method: 'POST' });










export async function createLoan(input: { friendName: string; amount: string; dueDate: string; receipt?: ReceiptFile }) {
  const fields = { friendName: input.friendName.trim(), amount: input.amount.trim(), dueDate: input.dueDate };

  // No photo: a plain JSON request is enough.
  if (!input.receipt) return request<{ loan: Loan }>('/loans', json(fields));

  // With a photo: let the native layer stream the file as multipart/form-data.
  let res;
  try {
    res = await uploadAsync(`${API_URL}/loans`, input.receipt.uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.MULTIPART,
      fieldName: 'receipt',
      mimeType: input.receipt.type,
      parameters: fields,
      headers: authHeaders(),
    });
  } catch {
    throw new ApiError(0, `Could not upload the receipt to ${API_URL}. Check your connection and try again.`);
  }
  let body: { loan?: Loan; error?: string } = {};
  try { body = JSON.parse(res.body); } catch { /* non-JSON response */ }
  if (res.status < 200 || res.status >= 300 || !body.loan) {
    if (res.status === 401 && token) onUnauthorized();
    throw new ApiError(res.status, body.error ?? `Upload failed (${res.status})`);
  }
  return { loan: body.loan };
}