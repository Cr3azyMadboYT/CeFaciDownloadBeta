// Where you set off from and how far you would go (decision Cornel, 04.10): first the phone's location; or
// București / Ilfov, then the sector or the town; then the radius on a map (5–40 km, Bilu proposes one), the pin moved
// to where you live if you want. Used by the sign-up and by "De unde pleci?" from Acasă; saved in the account.
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { APP, RADII, type Home } from '../../../src/app/bridge';
import { locate } from '../lib/session';
import { Icon } from './Icon';
import { Chip, Lbl, Muted, Note, Press, T } from './kit';
import { RadiusMap } from './RadiusMap';
import { F, useTheme } from './theme';

/** "Folosește locația mea" / București / Ilfov → the sector or the town. */
export function WhereChooser({ value, live, onPick }: { value?: Home; live?: boolean; onPick: (h: Home, live: boolean) => void }) {
  const { t } = useTheme();
  const [area, setArea] = useState<Home['area'] | null>(value && !live ? value.area : null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const list = useMemo(() => (area ? APP.homes(area) : []), [area]);
  const here = async () => {
    if (busy) return;
    setBusy(true); setErr('');
    const p = await locate();
    setBusy(false);
    if (typeof p === 'string') { setErr(p); return; }
    onPick(APP.homeAt(p), true);
  };
  const Card = ({ a, sub }: { a: Home['area']; sub: string }) => {
    const on = area === a;
    return (
      <Press onPress={() => setArea(a)} accessibilityState={{ selected: on }} accessibilityLabel={a}
        style={{ flex: 1, minHeight: 88, padding: 14, borderRadius: 22, borderWidth: 2, borderColor: on ? t.ink : t.line, backgroundColor: on ? t.ink : t.s1, justifyContent: 'center', gap: 4 }}>
        <T style={{ fontFamily: F.display, fontSize: 22, color: on ? t.bg : t.ink }}>{a}</T>
        <T style={{ fontFamily: F.m, fontSize: 13, color: on ? t.bg : t.ink2 }}>{sub}</T>
      </Press>
    );
  };
  return (
    <View style={{ gap: 12 }}>
      <Press onPress={here} accessibilityLabel="Folosește locația mea" accessibilityState={{ selected: !!live }}
        style={{ minHeight: 60, borderRadius: 20, backgroundColor: live ? t.blue : '#0E1440', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16 }}>
        <Icon name="locate" size={20} color="#FFD43B" />
        <T style={{ fontFamily: F.b, fontSize: 16, color: '#FFFFFF' }}>{busy ? 'Caut unde ești…' : live && value ? 'Folosesc locația ta: ' + value.name : 'Folosește locația mea'}</T>
      </Press>
      {err ? <Note kind="err">{err}</Note> : null}
      <Lbl style={{ marginTop: 4 }}>Sau alege tu</Lbl>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Card a="București" sub="Sectoarele 1–6" />
        <Card a="Ilfov" sub="Otopeni, Buftea, Voluntari…" />
      </View>
      {area ? (
        <View style={{ gap: 8 }}>
          <Lbl style={{ marginTop: 4 }}>Unde mai exact?</Lbl>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {list.map((h) => <Chip key={h.name} label={h.name} on={!live && value?.name === h.name} onPress={() => onPick(h, false)} />)}
          </View>
        </View>
      ) : null}
    </View>
  );
}

/** The map with the circle, the radius chips (Bilu's with a badge) and what is inside the circle. */
export function RadiusChooser({ home, km, moves, onKm, onMove }: { home: Home; km: number; moves?: string[]; onKm: (km: number) => void; onMove: (h: Home) => void }) {
  const { t } = useTheme();
  const best = useMemo(() => APP.bestRadius(home, moves), [home, moves]);
  const inside = useMemo(() => APP.circle(home, km), [home, km]);
  const wider = useMemo(() => { const r = RADII.find((x) => x > km); return r ? { r, ...APP.circle(home, r) } : null; }, [home, km]);
  const onFoot = !!moves?.length && moves.every((m) => m === 'walk');
  const time = onFoot ? Math.round(km * 12.5) + ' min pe jos până la margine' : '~' + Math.max(5, Math.round(3 + km * 2.4)) + ' min cu mașina până la margine';
  return (
    <View style={{ gap: 10 }}>
      <RadiusMap point={home} km={km} onMove={(p) => onMove(APP.homeAt(p))} />
      <Muted>Ții apăsat pe pinul galben și îl muți unde stai, dacă vrei.</Muted>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        {RADII.map((r) => (
          <Press key={r} onPress={() => onKm(r)} accessibilityState={{ selected: r === km }} accessibilityLabel={r + ' km' + (r === best ? ', recomandat de Bilu' : '')}
            style={{ flex: 1, minHeight: 48, borderRadius: 14, borderWidth: 1.5, borderColor: r === km ? t.ink : t.line, backgroundColor: r === km ? t.ink : t.s1, alignItems: 'center', justifyContent: 'center' }}>
            {r === best ? <View style={{ position: 'absolute', top: -9, paddingHorizontal: 5, borderRadius: 99, backgroundColor: '#FFD43B' }}><T style={{ fontFamily: F.b, fontSize: 9.5, color: '#0E1440' }}>Bilu</T></View> : null}
            <T style={{ fontFamily: F.b, fontSize: 15, color: r === km ? t.bg : t.ink }}>{r + ' km'}</T>
          </Press>
        ))}
      </View>
      <T style={{ fontFamily: F.sb, fontSize: 14 }}>{'În cerc: ' + inside.count.toLocaleString('ro-RO') + ' locuri · ' + inside.kinds + ' feluri · ' + time}</T>
      {inside.count < 60 && wider ? <Note kind="err">{'În ' + km + ' km sunt doar ' + inside.count + ' locuri. Cu ' + wider.r + ' km prinzi ' + wider.count.toLocaleString('ro-RO') + '.'}</Note> : null}
    </View>
  );
}
