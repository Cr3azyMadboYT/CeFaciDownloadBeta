// Time as people going out say it (decision Cornel, 04.10): the night belongs to the evening it started in, the day
// turns at 05:00, a park is not a plan after dark.
import { describe, expect, it } from 'vitest';
import { dateShort, eveningOf, eveningWord, isDark, momentOf, nightHour, sunsetText, whenWords } from '../src/engine/time';
import { targetTime } from '../src/engine/core';

const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m); // October 2026: the 3rd is a Saturday

describe('timpul', () => {
  it('noaptea ține de seara în care a început', () => {
    expect(eveningOf(at(4, 1, 30))).toBe('2026-10-03');
    expect(eveningOf(at(4, 4, 59))).toBe('2026-10-03');
    expect(eveningOf(at(4, 5, 0))).toBe('2026-10-04');
    expect(eveningOf(at(3, 23, 0))).toBe('2026-10-03');
  });
  it('ora 01:00 a serii de sâmbătă e duminică la 01:00', () => {
    expect(momentOf('2026-10-03', '01:00').toString()).toBe(at(4, 1).toString());
    expect(momentOf('2026-10-03', '20:30').toString()).toBe(at(3, 20, 30).toString());
    expect(nightHour(at(4, 1, 30))).toBe(25.5);
  });
  it('cuvintele: Azi, Diseară, Noaptea asta, Mâine, ziua săptămânii', () => {
    expect(eveningWord('2026-10-03', at(3, 12), 13)).toBe('Azi');
    expect(eveningWord('2026-10-03', at(3, 12), 20)).toBe('Diseară');
    expect(eveningWord('2026-10-03', at(4, 1), 2)).toBe('Noaptea asta');
    expect(eveningWord('2026-10-04', at(4, 1), 20)).toBe('Diseară'); // at 01:00 on Sunday, Sunday evening is "diseară", as the phone's date says
    expect(eveningWord('2026-10-04', at(3, 21), 20)).toBe('Mâine');
    expect(eveningWord('2026-10-08', at(3, 21), 20)).toBe('Joi');
    expect(whenWords('2026-10-03', '21:00', at(3, 18))).toBe('Diseară la 21:00');
    expect(whenWords('2026-10-03', '02:00', at(4, 0, 30))).toBe('Noaptea asta, la 02:00');
    expect(whenWords('2026-10-08', '20:00', at(3, 18))).toBe('Joi, 8 oct., la 20:00');
    expect(dateShort('2026-10-03')).toBe('sâm. 3 oct.');
  });
  it('apusul la București, cu ora de vară', () => {
    expect(sunsetText(at(4, 12))).toBe('18:52');
    expect(sunsetText(new Date(2026, 5, 21, 12))).toBe('21:04');
    expect(sunsetText(new Date(2026, 11, 21, 12))).toBe('16:39');
    expect(isDark(at(4, 19, 30))).toBe(true);
    expect(isDark(at(4, 18, 0))).toBe(false);
    expect(isDark(at(4, 3, 0))).toBe(true);
  });
  it('„diseară” după miezul nopții înseamnă acum, nu seara următoare', () => {
    const now = at(4, 1, 15);
    expect(targetTime('diseara', 1, now).getTime()).toBe(now.getTime());
    expect(targetTime('diseara', 1, at(3, 15)).getHours()).toBe(20);
  });
});
