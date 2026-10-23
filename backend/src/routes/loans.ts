import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import multer from 'multer';
import { config } from '../config';
import { pool } from '../db';
import { HttpError } from '../errors';
import { UUID_RE, createLoanSchema } from '../validation';

export const loansRouter = Router();

// ---- receipt upload (bonus) -------------------------------------------------
const EXT_BY_MIME: Record<string, string> = { 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' };
fs.mkdirSync(config.uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: config.uploadDir,
    // Never trust the client's file name (path traversal, collisions): generate our own.
    filename: (_req, file, cb) => cb(null, crypto.randomUUID() + EXT_BY_MIME[file.mimetype]),
  }),
  limits: { fileSize: config.maxReceiptBytes, files: 1 },
  fileFilter: (_req, file, cb) =>
    EXT_BY_MIME[file.mimetype] ? cb(null, true) : cb(new HttpError(400, 'Receipt must be a JPEG, PNG or WebP image')),
});

// ---- shared SQL / mapping ---------------------------------------------------
// due_date::text keeps the DATE as "YYYY-MM-DD" (node-pg would turn it into a
// timezone-shifted JS Date). Overdue = unpaid AND due strictly before today.
const LOAN_COLUMNS = `
  id, friend_name, amount_cents, due_date::text AS due_date, repaid_at, created_at,
  (receipt_path IS NOT NULL) AS has_receipt,
  (repaid_at IS NULL AND due_date < CURRENT_DATE) AS is_overdue`;

interface LoanRow {
  id: string; friend_name: string; amount_cents: string; due_date: string;
  repaid_at: Date | null; created_at: Date; has_receipt: boolean; is_overdue: boolean;
}

const toLoan = (r: LoanRow) => ({
  id: r.id,
  friendName: r.friend_name,
  amount: Number(r.amount_cents) / 100,
  dueDate: r.due_date,
  repaidAt: r.repaid_at,
  createdAt: r.created_at,
  hasReceipt: r.has_receipt,
  isOverdue: r.is_overdue,
});

const loanId = (raw: string): string => {
  if (!UUID_RE.test(raw)) throw new HttpError(400, 'Invalid loan id');
  return raw;
};

// ---- routes -----------------------------------------------------------------
loansRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<LoanRow>(
    `SELECT ${LOAN_COLUMNS} FROM loans WHERE user_id = $1
     ORDER BY (repaid_at IS NOT NULL), due_date ASC, created_at DESC`, // unpaid first, soonest due first
    [res.locals.userId],
  );
  res.json({ loans: rows.map(toLoan) });
});

// Accepts JSON or multipart/form-data (when a receipt is attached).
loansRouter.post('/', upload.single('receipt'), async (req, res) => {
  const discardFile = () => req.file && fs.promises.unlink(req.file.path).catch(() => undefined);
  try {
    const input = createLoanSchema.parse(req.body);
    const { rows } = await pool.query<LoanRow>(
      `INSERT INTO loans (user_id, friend_name, amount_cents, due_date, receipt_path)
       VALUES ($1, $2, $3, $4, $5) RETURNING ${LOAN_COLUMNS}`,
      [res.locals.userId, input.friendName, Math.round(input.amount * 100), input.dueDate, req.file?.filename ?? null],
    );
    res.status(201).json({ loan: toLoan(rows[0]) });
  } catch (err) {
    await discardFile(); // don't leave orphaned uploads when validation/DB fails
    throw err;
  }
});

loansRouter.post('/:id/repay', async (req, res) => {
  const id = loanId(req.params.id);
  // The WHERE clause makes this idempotent-safe and race-free: only one request can flip it.
  const { rows } = await pool.query<LoanRow>(
    `UPDATE loans SET repaid_at = now()
      WHERE id = $1 AND user_id = $2 AND repaid_at IS NULL
      RETURNING ${LOAN_COLUMNS}`,
    [id, res.locals.userId],
  );
  if (rows.length) return res.json({ loan: toLoan(rows[0]) });

  const exists = await pool.query('SELECT 1 FROM loans WHERE id = $1 AND user_id = $2', [id, res.locals.userId]);
  throw exists.rowCount ? new HttpError(409, 'Loan is already marked as repaid') : new HttpError(404, 'Loan not found');
});

loansRouter.get('/:id/receipt', async (req, res) => {
  const { rows } = await pool.query<{ receipt_path: string | null }>(
    'SELECT receipt_path FROM loans WHERE id = $1 AND user_id = $2',
    [loanId(req.params.id), res.locals.userId],
  );
  if (!rows.length || !rows[0].receipt_path) throw new HttpError(404, 'Receipt not found');
  res.sendFile(path.join(config.uploadDir, rows[0].receipt_path));
});
