import crypto from 'crypto';
import { config } from './config';

export const generateOtp = (): string => String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');

// Keyed hash (HMAC) bound to the phone, so a leaked table can't be brute-forced
// offline without the server secret, and a code for one phone is useless for another.
export const hashOtp = (phone: string, code: string): string =>
  crypto.createHmac('sha256', config.jwtSecret).update(`${phone}:${code}`).digest('hex');

export const otpMatches = (phone: string, code: string, storedHash: string): boolean => {
  const a = Buffer.from(hashOtp(phone, code), 'hex');
  const b = Buffer.from(storedHash, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
