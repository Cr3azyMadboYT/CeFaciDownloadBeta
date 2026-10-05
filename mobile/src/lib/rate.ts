// "Cum a fost?" after each outing (decision Cornel, 04.10: the app learns what a person and a crew like by voting after
// each outing). The vote changes the person's own list (liked / not), and, for a plan made with others (shared on the
// server), it goes to the crew's taste (outing_votes → crew_taste), which the plans for that crew then follow.
import { AppState } from 'react-native';
import { APP, getApp, savePrefs } from './session';
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

/** Whether "Cum a fost?" may be asked: the outing has started (checked in, or the hour came) — the server takes the
 * crew's vote only from then on — and it is not rated yet. */
export function canRate(pl: Plan, now = new Date()) {
  const t = startsAt(pl).getTime();
  return !pl.rated && t <= now.getTime() && (!!pl.inAt || t + 2 * 3600e3 <= now.getTime());
}

export async function rateOuting(pl: Plan, r: Rating) {
  const id = pl.placeId;
  const liked = ((APP.prefs.liked as string[] | undefined) ?? []).filter((x) => x !== id);
  const disliked = ((APP.prefs.disliked as string[] | undefined) ?? []).filter((x) => x !== id);
  savePrefs(r === 'no' ? { liked, disliked: [...disliked, id] } : { liked: [...liked, id], disliked });
  const vote = r === 'super' ? 2 : r === 'yes' ? 1 : -1;
  updPlan(pl.pid, { rated: r, voteDue: pl.sid ? vote : undefined });
  const sent = pl.sid ? await voteOuting(pl.sid, vote).catch(() => false) : false;
  if (sent) updPlan(pl.pid, { voteDue: undefined });
  toast(r === 'no' ? 'Notat. Data viitoare vă arăt altceva.'
    : !pl.sid ? 'Notat! Îți arăt mai des locuri ca ăsta.'
    : sent ? 'Notat! Și gașca învață din votul tău.' : 'Notat! Votul ajunge la gașcă imediat ce ai internet.');
}

/** The crew votes the server did not take yet (no internet when they were given): sent again, quietly. */
export async function sendDueVotes() {
  const list = (getApp().board.plans as Plan[] | undefined) ?? [];
  for (const pl of list) {
    if (!pl.sid || pl.voteDue === undefined) continue;
    if (await voteOuting(pl.sid, pl.voteDue).catch(() => false)) updPlan(pl.pid, { voteDue: undefined });
  }
}
AppState.addEventListener('change', (st) => { if (st === 'active') void sendDueVotes(); });
setTimeout(() => { void sendDueVotes(); }, 4000);
