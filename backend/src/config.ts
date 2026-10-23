import 'dotenv/config';
import path from 'path';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) throw new Error(`Missing required env var ${name}`);
  return value;
}

const isProd = process.env.NODE_ENV === 'production';

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: env('DATABASE_URL', 'postgres://miniledger:miniledger@localhost:5432/miniledger'),
  // No default in production: refuse to boot with a guessable signing key.
  jwtSecret: env('JWT_SECRET', isProd ? undefined : 'dev-only-secret-change-me'),
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? 'uploads'),
  otpTtlSeconds: 5 * 60,
  otpMaxAttempts: 5,
  otpResendSeconds: 30,
  maxReceiptBytes: 5 * 1024 * 1024,
};
