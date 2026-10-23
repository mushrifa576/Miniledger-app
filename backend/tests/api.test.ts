import request from 'supertest';
import { createApp } from '../src/app';
import { migrate } from '../src/migrate';
import { pool } from '../src/db';

const app = createApp();
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

/** Full login flow; reads the OTP from the server log exactly like a human would. */
async function login(phone: string): Promise<string> {
  const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
  await request(app).post('/auth/request-otp').send({ phone }).expect(200);
  const line = spy.mock.calls.map((c) => c.join(' ')).find((l) => l.includes('[MOCK OTP]') && l.includes(phone));
  spy.mockRestore();
  const otp = /-> (\d{6})/.exec(line ?? '')?.[1];
  expect(otp).toBeDefined();
  const res = await request(app).post('/auth/verify-otp').send({ phone, otp }).expect(200);
  return res.body.token;
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const addLoan = (t: string, body: object) => request(app).post('/loans').set(auth(t)).send(body);

beforeAll(migrate);
beforeEach(() => pool.query('TRUNCATE users, otp_codes, loans CASCADE'));
afterAll(() => pool.end());

describe('auth', () => {
  it('logs in with the OTP printed in the log, then rejects reuse', async () => {
    const phone = '+919876543210';
    const spy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await request(app).post('/auth/request-otp').send({ phone }).expect(200);
    const otp = /-> (\d{6})/.exec(spy.mock.calls.flat().join(' '))![1];
    spy.mockRestore();
    await request(app).post('/auth/verify-otp').send({ phone, otp }).expect(200);
    await request(app).post('/auth/verify-otp').send({ phone, otp }).expect(400); // single use
  });

  it('rejects a wrong OTP and locks out after too many attempts', async () => {
    const phone = '+919876543210';
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await request(app).post('/auth/request-otp').send({ phone }).expect(200);
    for (let i = 0; i < 5; i++) await request(app).post('/auth/verify-otp').send({ phone, otp: '000000' }).expect(401);
    await request(app).post('/auth/verify-otp').send({ phone, otp: '000000' }).expect(400);
    jest.restoreAllMocks();
  });

  it('throttles OTP resend and validates phone', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await request(app).post('/auth/request-otp').send({ phone: '+919876543210' }).expect(200);
    await request(app).post('/auth/request-otp').send({ phone: '+919876543210' }).expect(429);
    await request(app).post('/auth/request-otp').send({ phone: '12345' }).expect(400);
    jest.restoreAllMocks();
  });

  it('protects every data route', async () => {
    await request(app).get('/loans').expect(401);
    await request(app).get('/summary').expect(401);
    await request(app).get('/loans').set(auth('garbage')).expect(401);
  });
});

describe('loans', () => {
  it('creates, lists and validates', async () => {
    const t = await login('+919876543210');
    const created = await addLoan(t, { friendName: 'Arun', amount: 500.25, dueDate: '2999-01-01' }).expect(201);
    expect(created.body.loan).toMatchObject({ friendName: 'Arun', amount: 500.25, isOverdue: false, repaidAt: null });
    const list = await request(app).get('/loans').set(auth(t)).expect(200);
    expect(list.body.loans).toHaveLength(1);

    const bad = await addLoan(t, { friendName: '', amount: -1, dueDate: 'nope' }).expect(400);
    expect(bad.body.details.length).toBeGreaterThanOrEqual(3);
  });

  it('marks as repaid once; second attempt is 409; unknown id is 404; bad id is 400', async () => {
    const t = await login('+919876543210');
    const id = (await addLoan(t, { friendName: 'Meera', amount: 100, dueDate: '2000-01-01' })).body.loan.id;
    const done = await request(app).post(`/loans/${id}/repay`).set(auth(t)).expect(200);
    expect(done.body.loan.repaidAt).not.toBeNull();
    expect(done.body.loan.isOverdue).toBe(false); // repaid loans are never overdue
    await request(app).post(`/loans/${id}/repay`).set(auth(t)).expect(409);
    await request(app).post('/loans/00000000-0000-4000-8000-000000000000/repay').set(auth(t)).expect(404);
    await request(app).post('/loans/not-a-uuid/repay').set(auth(t)).expect(400);
  });

  it('isolates users from each other', async () => {
    const a = await login('+919876543210');
    const b = await login('+919876543211');
    const id = (await addLoan(a, { friendName: 'Private', amount: 10, dueDate: '2999-01-01' })).body.loan.id;
    expect((await request(app).get('/loans').set(auth(b))).body.loans).toHaveLength(0);
    await request(app).post(`/loans/${id}/repay`).set(auth(b)).expect(404);
  });

  it('stores a receipt and serves it back only to the owner', async () => {
    const a = await login('+919876543210');
    const b = await login('+919876543211');
    const res = await request(app).post('/loans').set(auth(a))
      .field('friendName', 'Ravi').field('amount', '75.5').field('dueDate', '2999-01-01')
      .attach('receipt', PNG, { filename: 'r.png', contentType: 'image/png' }).expect(201);
    expect(res.body.loan.hasReceipt).toBe(true);
    const id = res.body.loan.id;
    await request(app).get(`/loans/${id}/receipt`).set(auth(a)).expect(200).expect('Content-Type', /png/);
    await request(app).get(`/loans/${id}/receipt`).set(auth(b)).expect(404);
  });

  it('rejects non-image receipts', async () => {
    const t = await login('+919876543210');
    await request(app).post('/loans').set(auth(t))
      .field('friendName', 'X').field('amount', '5').field('dueDate', '2999-01-01')
      .attach('receipt', Buffer.from('#!/bin/sh'), { filename: 'evil.sh', contentType: 'text/x-sh' }).expect(400);
    expect((await request(app).get('/loans').set(auth(t))).body.loans).toHaveLength(0);
  });
});

describe('summary', () => {
  it('computes lent, repaid, outstanding and overdue correctly', async () => {
    const t = await login('+919876543210');
    const overdue = await addLoan(t, { friendName: 'A', amount: 100.1, dueDate: '2000-01-01' });   // unpaid + past => overdue
    const paidLate = await addLoan(t, { friendName: 'B', amount: 200.2, dueDate: '2000-01-01' });  // past but repaid => not overdue
    await addLoan(t, { friendName: 'C', amount: 300.3, dueDate: '2999-01-01' });                   // future => not overdue
    await request(app).post(`/loans/${paidLate.body.loan.id}/repay`).set(auth(t)).expect(200);

    const { body } = await request(app).get('/summary').set(auth(t)).expect(200);
    expect(body).toEqual({ totalLent: 600.6, totalRepaid: 200.2, outstanding: 400.4, overdueAmount: 100.1 });
    expect(overdue.body.loan.isOverdue).toBe(true);
  });

  it('returns zeros for a new user', async () => {
    const t = await login('+919876543210');
    const { body } = await request(app).get('/summary').set(auth(t)).expect(200);
    expect(body).toEqual({ totalLent: 0, totalRepaid: 0, outstanding: 0, overdueAmount: 0 });
  });
});
