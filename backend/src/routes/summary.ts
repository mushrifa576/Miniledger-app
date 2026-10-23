import { Router } from 'express';
import { pool } from '../db';

export const summaryRouter = Router();

// One query, one table scan: conditional aggregates via FILTER.
summaryRouter.get('/', async (_req, res) => {
  const { rows } = await pool.query<{ total_lent: string; total_repaid: string; overdue: string }>(
    `SELECT
       COALESCE(SUM(amount_cents), 0)                                                          AS total_lent,
       COALESCE(SUM(amount_cents) FILTER (WHERE repaid_at IS NOT NULL), 0)                      AS total_repaid,
       COALESCE(SUM(amount_cents) FILTER (WHERE repaid_at IS NULL AND due_date < CURRENT_DATE), 0) AS overdue
     FROM loans WHERE user_id = $1`,
    [res.locals.userId],
  );
  const lent = Number(rows[0].total_lent) / 100;
  const repaid = Number(rows[0].total_repaid) / 100;
  res.json({
    totalLent: lent,
    totalRepaid: repaid,
    outstanding: Math.round((lent - repaid) * 100) / 100,
    overdueAmount: Number(rows[0].overdue) / 100,
  });
});
