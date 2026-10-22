// The last searches in Explorează (22.10): newest first, no repeats, at most 6.
import { describe, expect, it } from 'vitest';
import { addRecent, RECENT_MAX, tidy } from '../mobile/src/lib/recent';

describe('ultimele căutări', () => {
  it('newest first', () => expect(addRecent(['pizza'], 'sushi')).toEqual(['sushi', 'pizza']));
  it('at most 6, the oldest goes', () => {
    let l: string[] = [];
    for (const q of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7']) l = addRecent(l, q);
    expect(l).toHaveLength(RECENT_MAX);
    expect(l[0]).toBe('g7');
    expect(l).not.toContain('a1');
  });
  it('the same search moves up instead of repeating (case, diacritics, spaces)', () => {
    expect(addRecent(['sushi', 'Pizza  sector 2', 'bere'], ' pizza sector 2 ')).toEqual(['pizza sector 2', 'sushi', 'bere']);
    expect(addRecent(['cafenea deschisă'], 'cafenea deschisa')).toEqual(['cafenea deschisa']);
  });
  it('one letter is not a search', () => expect(addRecent(['pizza'], ' a ')).toEqual(['pizza']));
  it('very long text is cut', () => expect(tidy('x'.repeat(200))).toHaveLength(60));
});
