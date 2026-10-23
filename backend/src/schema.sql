-- Idempotent: safe to run on every deploy.
CREATE TABLE IF NOT EXISTS users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone      TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One active OTP per phone. We store an HMAC of the code, never the code itself.
CREATE TABLE IF NOT EXISTS otp_codes (
  phone      TEXT PRIMARY KEY,
  code_hash  TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts   INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Money is stored as integer cents: no floating-point rounding bugs.
CREATE TABLE IF NOT EXISTS loans (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_name  TEXT NOT NULL CHECK (char_length(friend_name) BETWEEN 1 AND 100),
  amount_cents BIGINT NOT NULL CHECK (amount_cents > 0),
  due_date     DATE NOT NULL,
  repaid_at    TIMESTAMPTZ,            -- NULL = still outstanding
  receipt_path TEXT,                   -- file name inside UPLOAD_DIR
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loans_user_due_idx ON loans (user_id, due_date);
