import {describe, it, expect} from 'vitest';
import {normalizeUsername, validUsername, validateBirthDate} from '../business/src/identity-validation';
describe('Business profile input', () => {
  const now = new Date('2026-10-10T10:00:00Z');
  it('matches the database username alphabet and length', () => {
    expect(normalizeUsername(' Ana.Test-2_ ')).toBe('ana.test-2_');
    for (const value of ['ab', 'a'.repeat(21), 'ana test', 'ana@', 'ștefan']) expect(validUsername(value)).toBe(false);
    expect(validUsername(normalizeUsername(' Ana.Test-2_ '))).toBe(true);
  });
  it('rejects incomplete, impossible and guessed dates', () => {
    for (const [d,m,y] of [['','',''],['31','2','2000'],['29','2','2001'],['14','7','20071'],['0','1','1990'],['1','13','1990']]) expect(validateBirthDate(d,m,y,now).iso).toBe('');
    expect(validateBirthDate('29','2','2000',now).iso).toBe('2000-02-29');
  });
  it('checks the birthday and accepts 16 only when reached', () => {
    expect(validateBirthDate('10','10','2010',now).iso).toBe('2010-10-10');
    expect(validateBirthDate('11','10','2010',now).iso).toBe('');
    expect(validateBirthDate('1','1','2020',now).error).toContain('16 ani');
    expect(validateBirthDate('10','10','1916',now).iso).toBe('1916-10-10');
    expect(validateBirthDate('9','10','1916',now).iso).toBe('');
  });
});
