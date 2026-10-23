import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { pool } from '../db';
import { HttpError } from '../errors';
import { generateOtp, hashOtp, otpMatches } from '../otp';
import { requestOtpSchema, verifyOtpSchema } from '../validation';

export const authRouter = Router();

authRouter.post('/request-otp', async (req, res) => {
  const { phone } = requestOtpSchema.parse(req.body);

  // Throttle resends so this can't be used to spam an SMS provider (in a real system).
  const recent = await pool.query(
    `SELECT 1 FROM otp_codes WHERE phone = $1 AND created_at > now() - make_interval(secs => $2)`,
    [phone, config.otpResendSeconds],
  );
  if (recent.rowCount) throw new HttpError(429, `Please wait ${config.otpResendSeconds}s before requesting another OTP`);

  const code = generateOtp();
  await pool.query(
    `INSERT INTO otp_codes (phone, code_hash, expires_at, attempts, created_at)
     VALUES ($1, $2, now() + make_interval(secs => $3), 0, now())
     ON CONFLICT (phone) DO UPDATE
       SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
           attempts = 0, created_at = now()`,
    [phone, hashOtp(phone, code), config.otpTtlSeconds],
  );

  // MOCK SMS: in production this line becomes a call to an SMS provider.
  console.log(`[MOCK OTP] ${phone} -> ${code}`);
  res.json({ message: 'OTP sent', expiresInSeconds: config.otpTtlSeconds });
});

authRouter.post('/verify-otp', async (req, res) => {
  const { phone, otp } = verifyOtpSchema.parse(req.body);

  // Atomically burn one attempt and fetch the hash. Doing it in one statement means
  // concurrent guesses can't sneak past the attempt limit.
  const { rows } = await pool.query<{ code_hash: string }>(
    `UPDATE otp_codes SET attempts = attempts + 1
      WHERE phone = $1 AND expires_at > now() AND attempts < $2
      RETURNING code_hash`,
    [phone, config.otpMaxAttempts],
  );
  if (!rows.length) throw new HttpError(400, 'OTP expired or too many attempts. Request a new one.');
  if (!otpMatches(phone, otp, rows[0].code_hash)) throw new HttpError(401, 'Invalid OTP');

  await pool.query('DELETE FROM otp_codes WHERE phone = $1', [phone]); // single use

  // First successful login creates the account.
  const user = await pool.query<{ id: string }>(
    `INSERT INTO users (phone) VALUES ($1)
     ON CONFLICT (phone) DO UPDATE SET phone = EXCLUDED.phone
     RETURNING id`,
    [phone],
  );
  const userId = user.rows[0].id;
  const token = jwt.sign({}, config.jwtSecret, { subject: userId, expiresIn: '7d' });
  res.json({ token, user: { id: userId, phone } });
});
