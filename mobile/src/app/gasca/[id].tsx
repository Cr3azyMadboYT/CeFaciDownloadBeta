// One crew: its stamp, who is in and who is still invited, accept an invitation, leave or (admin) delete.
import { useCallback, useState } from 'react';
import { ScrollView, Share, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from '../../ui/insets';
import { acceptCrew, crewCode, crewOutings, deleteCrew, inviteToCrew, iconOf, leaveCrew, listCrews, newCrewCode, type Crew } from '../../lib/crews';
import { listFriends, type Person } from '../../lib/friends';
import { useApp } from '../../lib/session';
import { toast } from '../../lib/toast';
import { CrewMark } from '../../ui/CrewMark';
import { Icon } from '../../ui/Icon';
import { Big, Chip, H1, Lbl, Muted, Note, Press, Sheet, T, Tag } from '../../ui/kit';
import { F, useTheme } from '../../ui/theme';
import { TopShade } from '../../ui/TopShade';

export default function GascaView() {
  const { t } = useTheme();
  const ins = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id: string }>();
  const who = useApp((s) => s.who);
  const me = useApp((s) => s.prefs);
  const [crew, setCrew] = useState<Crew | null | undefined>(undefined);
  const [arm, setArm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [code, setCode] = useState<{ code: string; until: string } | null>(null);
  const [outings, setOutings] = useState<{ id: string; venueId: string; name: string; at: string }[]>([]);
  const [adding, setAdding] = useState(false);
  const [friends, setFriends] = useState<Person[]>([]);
  const [picked, setPicked] = useState<string[]>([]);
  const load = useCallback(() => {
    if (!who || !id) return;
    void listCrews(who.id).then((all) => setCrew(all.find((c) => c.id === id) ?? null));
    void crewCode(id).then(setCode);
    void crewOutings(id).then(setOutings);
    void listFriends(who.id).then((r) => setFriends(r.filter((x) => x.status === 'accepted').map((x) => x.person)));
  }, [who, id]);
  useFocusEffect(load);
  const back = () => (router.canGoBack() ? router.back() : router.replace('/planuri'));
  const admin = !!crew && crew.adminId === who?.id;
  const ink = (c: string) => (c === '#0E1440' && t.dark ? '#F4F4F6' : c);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: ins.top + 8, paddingHorizontal: 20, paddingBottom: 24, gap: 12 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', height: 44 }}>
          <Press onPress={back} accessibilityLabel="Înapoi" style={{ width: 44, height: 44, marginLeft: -12, alignItems: 'center', justifyContent: 'center' }}><Icon name="back" color={t.ink} /></Press>
        </View>
        {crew === undefined ? <Muted>Se încarcă…</Muted> : crew === null ? (
          <Note kind="err">Gașca nu mai există sau nu mai faci parte din ea.</Note>
        ) : (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              <CrewMark icon={crew.icon} color={ink(crew.color)} size={64} />
              <View style={{ flex: 1 }}>
                <H1 style={{ fontSize: 28, lineHeight: 30 }}>{crew.name}</H1>
                <Muted>{'Gașcă permanentă, ' + (crew.members.filter((m) => m.status === 'member').length + 1) + ' membri'}</Muted>
              </View>
            </View>
            {crew.mine === 'invited' ? (
              <View style={{ gap: 8, padding: 14, borderRadius: 18, backgroundColor: t.yellowSoft }}>
                <T style={{ fontFamily: F.b, fontSize: 15 }}>Ai fost invitat în gașca asta.</T>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Big style={{ flex: 1 }} label="Intru" disabled={busy} onPress={async () => { setBusy(true); const e = await acceptCrew(crew.id, who!.id); setBusy(false); if (e) setErr(e); else { toast('Ai intrat în ' + crew.name + '.'); load(); } }} />
                  <Big style={{ flex: 1 }} label="Nu, mersi" color={t.s1} ink={t.ink} disabled={busy} onPress={async () => { setBusy(true); await leaveCrew(crew.id, who!.id); setBusy(false); back(); }} />
                </View>
              </View>
            ) : null}
            <Lbl style={{ marginTop: 6 }}>{'Membri (' + (crew.members.length + 1) + ')'}</Lbl>
            <View style={{ gap: 8 }}>
              <Row name={(me.name ?? 'Tu') + ' (tu)'} user={me.user ?? ''} tag={admin ? 'Admin' : crew.mine === 'invited' ? 'Invitat' : ''} />
              {crew.members.map((m) => <Row key={m.person.id} name={m.person.first_name} user={m.person.username} tag={m.status === 'invited' ? 'Invitat' : crew.adminId === m.person.id ? 'Admin' : ''} />)}
            </View>
            <Muted style={{ marginTop: 4 }}>{admin ? 'Gașca rămâne până o ștergi tu sau până ies toți. Dacă ieși, adminul trece la cel mai vechi membru.' : 'Dacă ieși, gașca rămâne pentru ceilalți.'}</Muted>
            {crew.mine === 'member' ? (
              <View style={{ gap: 8, marginTop: 4 }}>
                <Big label="Pornește un vot" icon={<Icon name="users" color="#FFFFFF" />} onPress={() => { toast('Alege locurile, apoi „Trimite gășcii la vot” și alege ' + crew.name + '.'); router.push('/rezultate'); }} />
                <Big label="Adaugă prieteni în gașcă" color={t.s2} ink={t.ink} onPress={() => { setPicked([]); setAdding(true); }} />
                {code ? (
                  <View style={{ padding: 14, gap: 6, borderRadius: 18, borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.line }}>
                    <Lbl>Codul gășcii</Lbl>
                    <T selectable style={{ fontFamily: F.display, fontSize: 26, letterSpacing: 2 }}>{code.code}</T>
                    <Muted>{new Date(code.until).getTime() > Date.now() ? 'Merge până pe ' + new Date(code.until).toLocaleDateString('ro-RO', { day: 'numeric', month: 'long' }) + '. Cine îl are intră din Planuri → Intră cu un cod.' : 'Codul a expirat.'}</Muted>
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                      <Big style={{ flex: 1 }} label="Trimite codul" onPress={() => Share.share({ message: 'Intră în gașca „' + crew.name + '” pe CeFaci: deschide aplicația → Planuri → Intră cu un cod și scrie ' + code.code + '.' }).catch(() => {})} />
                      {admin ? <Big style={{ flex: 1 }} label="Cod nou" color={t.s2} ink={t.ink} onPress={async () => { const c = await newCrewCode(crew.id); if (c) { toast('Gata, codul vechi nu mai merge.'); load(); } else toast('Nu am putut face codul nou.'); }} /> : null}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
            <Lbl style={{ marginTop: 6 }}>Carnetul gășcii</Lbl>
            {outings.length ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {outings.map((o, k) => (
                  <View key={o.id} style={{ width: '30%', aspectRatio: 1, borderRadius: 16, borderWidth: 2.5, borderColor: ink(crew.color), alignItems: 'center', justifyContent: 'center', padding: 6, gap: 4, transform: [{ rotate: ['-5deg', '4deg', '-2deg', '6deg'][k % 4] }] }}>
                    <Icon name={iconOf(crew.icon) as never} size={20} color={ink(crew.color)} />
                    <T numberOfLines={2} style={{ fontFamily: F.b, fontSize: 11, lineHeight: 13, textAlign: 'center', color: ink(crew.color) }}>{o.name}</T>
                    <T style={{ fontFamily: F.sb, fontSize: 10, color: t.ink2 }}>{new Date(o.at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })}</T>
                  </View>
                ))}
              </View>
            ) : <Muted>Ieșirile făcute împreună (din vot sau din planul trimis gășcii) apar aici ca ștampile.</Muted>}
            {err ? <Note kind="err">{err}</Note> : null}
            {crew.mine === 'member' ? (
              <Big label={busy ? 'O clipă…' : arm ? (admin ? 'Sigur? Apasă iar ca să ștergi gașca' : 'Sigur? Apasă iar ca să ieși') : admin ? 'Șterge gașca' : 'Ieși din gașcă'} color="#D93A1C" disabled={busy}
                style={{ marginTop: 8 }}
                onPress={async () => {
                  if (!arm) { setArm(true); return; }
                  setBusy(true);
                  const e = admin ? await deleteCrew(crew.id) : await leaveCrew(crew.id, who!.id);
                  setBusy(false); setArm(false);
                  if (e) { setErr(e); return; }
                  toast(admin ? 'Ai șters gașca „' + crew.name + '”.' : 'Ai ieșit din „' + crew.name + '”.');
                  back();
                }} />
            ) : null}
          </>
        )}
      </ScrollView>
      <Sheet open={adding} onClose={() => setAdding(false)}>
        <H1 style={{ fontSize: 26 }}>Adaugă în gașcă</H1>
        <Muted style={{ marginTop: 6, marginBottom: 12, fontSize: 15, lineHeight: 21 }}>Primesc invitația și intră când acceptă.</Muted>
        {(() => {
          const free = friends.filter((f) => !crew?.members.some((m) => m.person.id === f.id));
          if (!free.length) return <Muted>Toți prietenii tăi sunt deja în gașcă sau invitați.</Muted>;
          return (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {free.map((f) => { const on = picked.includes(f.id); return <Chip key={f.id} label={f.first_name} on={on} onPress={() => setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))} />; })}
            </View>
          );
        })()}
        <View style={{ marginTop: 16, gap: 8 }}>
          <Big label={picked.length ? 'Trimite ' + (picked.length === 1 ? 'invitația' : picked.length + ' invitații') : 'Alege prieteni'} disabled={!picked.length || busy}
            onPress={async () => { if (!crew || !who) return; setBusy(true); const e = await inviteToCrew(crew.id, who.id, picked); setBusy(false); setAdding(false); toast(e ?? 'Invitațiile au plecat.'); load(); }} />
        </View>
      </Sheet>
      <TopShade />
    </View>
  );
}

function Row({ name, user, tag }: { name: string; user: string; tag: string }) {
  const { t } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 12, borderRadius: 16, borderWidth: 1, borderColor: t.line, backgroundColor: t.s1, opacity: tag === 'Invitat' ? 0.6 : 1 }}>
      <View style={{ width: 36, height: 36, borderRadius: 99, backgroundColor: '#FFD43B', alignItems: 'center', justifyContent: 'center' }}>
        <T style={{ fontFamily: F.b, fontSize: 14, color: '#0E1440' }}>{name.charAt(0).toUpperCase()}</T>
      </View>
      <View style={{ flex: 1 }}>
        <T style={{ fontFamily: F.sb, fontSize: 15 }}>{name}</T>
        {user ? <Muted>{'@' + user}</Muted> : null}
      </View>
      {tag ? <Tag text={tag} bg={tag === 'Invitat' ? t.yellowSoft : t.s2} fg={tag === 'Invitat' ? t.yellowInk : t.ink} /> : null}
    </View>
  );
}
