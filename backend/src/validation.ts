import { z } from 'zod';

// E.164: "+" then country code and number, 8-15 digits total, no leading zero.
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be in international format, e.g. +919876543210');

export const requestOtpSchema = z.object({ phone: phoneSchema });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  otp: z.string().trim().regex(/^\d{6}$/, 'OTP must be 6 digits'),
});

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // rejects 2026-02-31
};

export const createLoanSchema = z.object({
  friendName: z.string().trim().min(1, 'Friend name is required').max(100),
  // Multipart form fields arrive as strings, hence coerce.
  amount: z.coerce
    .number('Amount must be a number')
    .positive('Amount must be greater than 0')
    .max(1_000_000_000, 'Amount is too large')
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, 'Amount can have at most 2 decimal places'),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be YYYY-MM-DD')
    .refine(isRealDate, 'Due date is not a real calendar date'),
});

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
