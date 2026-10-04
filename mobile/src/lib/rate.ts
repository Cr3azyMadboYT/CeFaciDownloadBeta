// "Cum a fost?" after each outing (decision Cornel, 04.10: the app learns what a person and a crew like by voting after
// each outing). The vote changes the person's own list (liked / not), and, for a plan made with others (shared on the
// server), it goes to the crew's taste (outing_votes → crew_taste), which the plans for that crew then follow.
import { APP, savePrefs } from './session';
import { startsAt, updPlan, type Plan } from './plans';
import { voteOuting } from './crews';
import { toast } from './toast';

export type Rating = 'super' | 'yes' | 'no';

/** The outing to ask about: ended (2 hours after it started) in the last day and a half, not rated yet. */
export function toRate(list: Plan[], now = new Date()): Plan | null {
  const past = list.filter((pl) => {
    const t = startsAt(pl).getTime();
    return !pl.rated && t + 2 * 3600e3 <= now.getTime() && t >= now.getTime() - 36 * 3600e3 && !!APP.byId(pl.placeId);
  });
  return past.sort((a, b) => startsAt(b).getTime() - startsAt(a).getTime())[0] ?? null;
}

export function rateOuting(pl: Plan, r: Rating) {
  const id = pl.placeId;
  const liked = ((APP.prefs.liked as string[] | undefined) ?? []).filter((x) => x !== id);
  const disliked = ((APP.prefs.disliked as string[] | undefined) ?? []).filter((x) => x !== id);
  savePrefs(r === 'no' ? { liked, disliked: [...disliked, id] } : { liked: [...liked, id], disliked });
  updPlan(pl.pid, { rated: r });
  if (pl.sid) void voteOuting(pl.sid, r === 'super' ? 2 : r === 'yes' ? 1 : -1);
  toast(r === 'no' ? 'Notat. Data viitoare vă arăt altceva.' : pl.sid ? 'Notat! Și gașca învață din votul tău.' : 'Notat! Îți arăt mai des locuri ca ăsta.');
}
