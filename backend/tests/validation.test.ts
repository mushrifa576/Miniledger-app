import { createLoanSchema, phoneSchema, verifyOtpSchema } from '../src/validation';
import { generateOtp, hashOtp, otpMatches } from '../src/otp';

describe('phone validation', () => {
  it.each(['+919876543210', '+14155552671'])('accepts %s', (p) => expect(phoneSchema.safeParse(p).success).toBe(true));
  it.each(['9876543210', '+0123456789', '+12', 'abc', '+91 98765 43210'])('rejects %s', (p) =>
    expect(phoneSchema.safeParse(p).success).toBe(false));
});

describe('loan validation', () => {
  const ok = { friendName: ' Arun ', amount: '250.50', dueDate: '2030-01-31' };
  it('accepts valid input, trims and coerces', () => {
    expect(createLoanSchema.parse(ok)).toEqual({ friendName: 'Arun', amount: 250.5, dueDate: '2030-01-31' });
  });
  it.each([
    [{ ...ok, friendName: '   ' }, 'blank name'],
    [{ ...ok, amount: '0' }, 'zero amount'],
    [{ ...ok, amount: '-5' }, 'negative amount'],
    [{ ...ok, amount: 'abc' }, 'non-numeric amount'],
    [{ ...ok, amount: '10.999' }, 'too many decimals'],
    [{ ...ok, dueDate: '2030-02-31' }, 'impossible date'],
    [{ ...ok, dueDate: '31/01/2030' }, 'wrong date format'],
  ])('rejects %j (%s)', (input) => expect(createLoanSchema.safeParse(input).success).toBe(false));
});

describe('otp', () => {
  it('generates 6 digits incl. leading zeros', () => {
    for (let i = 0; i < 200; i++) expect(generateOtp()).toMatch(/^\d{6}$/);
  });
  it('matches only the right phone and code', () => {
    const h = hashOtp('+919876543210', '123456');
    expect(otpMatches('+919876543210', '123456', h)).toBe(true);
    expect(otpMatches('+919876543210', '123457', h)).toBe(false);
    expect(otpMatches('+919876543211', '123456', h)).toBe(false);
  });
  it('verify schema requires 6-digit otp', () => {
    expect(verifyOtpSchema.safeParse({ phone: '+919876543210', otp: '12345' }).success).toBe(false);
  });
});
