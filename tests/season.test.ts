import { describe, expect, it } from 'vitest';
import { LOOKS, lookFor, lookOf, seasonOf } from '../src/app/season';

const day = (m: number, d: number, y = 2026) => new Date(y, m - 1, d, 12);

describe('anotimpul aplicației', () => {
  it('anotimpurile după calendar', () => {
    expect(seasonOf(day(3, 1))).toBe('primavara');
    expect(seasonOf(day(5, 31))).toBe('primavara');
    expect(seasonOf(day(6, 1))).toBe('vara');
    expect(seasonOf(day(8, 31))).toBe('vara');
    expect(seasonOf(day(9, 1))).toBe('toamna');
    expect(seasonOf(day(11, 30))).toBe('toamna');
    expect(seasonOf(day(12, 1))).toBe('iarna');
    expect(seasonOf(day(2, 28))).toBe('iarna');
  });

  it('căciula de Moș Crăciun de la 1 decembrie la 7 ianuarie, apoi căciula de iarnă', () => {
    expect(lookOf(day(11, 30))).toBe('toamna');
    expect(lookOf(day(12, 1))).toBe('craciun');
    expect(lookOf(day(12, 25))).toBe('craciun');
    expect(lookOf(day(1, 7, 2027))).toBe('craciun');
    expect(lookOf(day(1, 8, 2027))).toBe('iarna');
    expect(lookOf(day(2, 14, 2027))).toBe('iarna');
    expect(LOOKS.craciun.hat).toBe('santa');
    expect(LOOKS.iarna.hat).toBe('beanie');
  });

  it('un aspect fix (doar pentru previzualizări și teste)', () => {
    expect(lookFor('auto', day(7, 1))).toBe('vara');
    expect(lookFor(undefined, day(7, 1))).toBe('vara');
    expect(lookFor('iarna', day(7, 1))).toBe('iarna');
    expect(lookFor('craciun', day(7, 1))).toBe('craciun');
  });
});
