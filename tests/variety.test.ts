// Sign-up picks are varied in every zone (decision Cornel, 04.10: in Buftea it showed only restaurants and cafés).
import { describe, expect, it } from 'vitest';
import { APP } from '../src/app/bridge';
import { ZONES } from '../src/engine/catalog';

const FOOD = /^(Restaurant|Fast food|Cafenea|Gelaterie)/;
describe('varied sign-up picks', () => {
  for (const likes of [['food', 'cafe'], ['party'], ['nature', 'sport'], []]) {
    it('in every zone, likes: ' + (likes.join(',') || 'none'), () => {
      const thin: string[] = [];
      for (const z of ZONES) {
        const picks = APP.picksFor(likes, z.id, { when: ['we'] });
        if (process.env.SHOW) console.log(z.id, likes.join(','), picks.map((p) => p.tag).join(' | '));
        expect(picks.length, z.id).toBe(5);
        const other = picks.filter((p) => !FOOD.test(p.tag)).length;
        if (other < 2) thin.push(z.id + ': ' + picks.map((p) => p.tag).join(' | '));
      }
      expect(thin).toEqual([]);
    });
  }
});
