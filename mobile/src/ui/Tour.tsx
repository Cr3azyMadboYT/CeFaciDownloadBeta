// Bilu's tour, drawn over the tabs: a dimmed screen with a lit window on the part being explained, Bilu and his
// bubble next to it. Two steps want a real tap (Profil, Plus); the last one gives the free Plus week.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, View, useWindowDimensions } from 'react-native';
import { router } from 'expo-router';
import { setBoard, getApp } from '../lib/session';
import { endTour, tourNext, tourOops, useTour, type Rect } from '../lib/tour';
import { Bilu, type Mood } from './Bilu';
import { Big, T } from './kit';
import { F } from './theme';
import { useModalInsets } from './insets';

interface Step { id?: string; mood: Mood; text: string; oops?: string; hot?: 'profil' | 'plus'; final?: 'xp' | 'gift'; magic?: boolean }
const STEPS: Step[] = [
  { mood: 'hi', text: 'Salutare! Bine ai venit în CeFaci. Sperăm să te scăpăm de plictiseală și să te distrezi cu vârf și îndesat!' },
  { mood: 'wink', text: 'Înainte de toate, un mic tur prin aplicație. Durează jumătate de minut, promit.' },
  { id: 'pills', mood: 'up', text: 'Sus vezi de unde pleci, vremea, ziua și ora. Apasă pe zonă ca s-o schimbi.' },
  { id: 'cta', mood: 'up', text: 'Butonul magic: Creează plan. Îmi răspunzi la 5 întrebări rapide și primești 3 planuri gata, verificate. Surprinde-mă e pentru curajoși.' },
  { id: 'tab-planuri', mood: 'down', text: 'În Planuri ai tot ce ai stabilit: biletele serii, rezervările și gășcile tale.' },
  { id: 'tab-profil', mood: 'down', hot: 'profil', text: 'Acum apasă tu pe Profil. Acolo sunt carnetul, prietenii și ștampilele tale.', oops: 'Aproape! Profil e al patrulea de jos, unde e lumină.' },
  { mood: 'yay', final: 'xp', text: 'Ăsta e carnetul tău: fă check-in când ajungi la local și primești ștampile și XP, iar poza bonului îți mai aduce 25 XP. Și ca să nu pleci cu mâna goală, ai deja 150 XP de bun venit!' },
  { id: 'tab-plus', mood: 'down', hot: 'plus', text: 'Și încă ceva! Iconița încețoșată din dreapta jos ascunde un cadou. Apasă pe ea.', oops: 'Aproape! Iconița încețoșată, ultima din dreapta jos.' },
  { mood: 'magic', magic: true, text: 'Hocus… pocus!' },
  { mood: 'yay', final: 'gift', text: 'Poftim: 7 zile de CeFaci Plus, cadou de la mine! Reducerile pornesc când intră primii parteneri. Când se termină, o reactivezi oricând.' },
];

const DIM = 'rgba(4,7,24,0.78)';

export function Tour() {
  const tour = useTour();
  const { width: W, height: H } = useWindowDimensions();
  const ins = useModalInsets();
  const steps = tour.replay ? STEPS.slice(0, 7) : STEPS;
  const st = steps[Math.min(tour.step, steps.length - 1)];
  const r: Rect | undefined = st?.id ? tour.rects[st.id] : undefined;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => { fade.setValue(0); Animated.timing(fade, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(); }, [tour.step, fade]);

  // the magic step opens the gift by itself after a moment
  useEffect(() => {
    if (!tour.on || !st?.magic) return;
    const a = setTimeout(() => { if ((getApp().board.plus ?? 'locked') === 'locked') setBoard({ plus: 'trial', plusDay: 1 }); }, 900);
    const b = setTimeout(() => tourNext(), 2600);
    return () => { clearTimeout(a); clearTimeout(b); };
  }, [tour.on, st?.magic]);

  if (!tour.on || !st) return null;
  const pad = 8;
  const hole = r ? { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 } : null;
  const below = hole ? hole.y + hole.h / 2 < H / 2 : false;
  const last = tour.step >= steps.length - 1;

  const tap = () => {
    if (st.final || st.magic) return;
    if (st.hot) { tourOops(); return; }
    tourNext();
  };
  const hit = () => {
    if (st.hot === 'profil') router.navigate('/profil');
    if (st.hot === 'plus') router.navigate('/plus');
    tourNext();
  };
  const finish = (to?: string) => { endTour(); if (to) router.navigate(to as never); };

  const bubble = (
    <Animated.View style={{ opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }], gap: 10, alignItems: 'center' }}>
      <Bilu size={st.final || !hole ? 130 : 92} mood={tour.oops && st.hot ? 'oops' : st.mood} />
      <View style={{ alignSelf: 'stretch', padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF' }}>
        <T style={{ fontFamily: st.magic ? F.display : F.sb, fontSize: st.magic ? 28 : 17, lineHeight: st.magic ? 30 : 24, color: '#0E1440', textAlign: st.magic ? 'center' : 'left' }}>
          {tour.oops && st.oops ? st.oops : st.text}
        </T>
        {!st.final && !st.magic ? <T style={{ marginTop: 6, fontFamily: F.m, fontSize: 13, color: '#5A6390' }}>{st.hot ? 'Apasă pe zona luminată' : 'Apasă oriunde pe ecran'}</T> : null}
      </View>
      {st.final === 'xp' ? (
        <View style={{ alignSelf: 'stretch', padding: 14, borderRadius: 20, backgroundColor: '#2F5BFF', gap: 4 }}>
          <T style={{ fontFamily: F.b, fontSize: 14, color: '#FFFFFF' }}>Nivel 1</T>
          <T style={{ fontFamily: F.display, fontSize: 30, color: '#FFFFFF' }}>Boboc</T>
          <T style={{ fontFamily: F.sb, fontSize: 13, color: '#FFFFFF' }}>Abia ai ieșit din casă. Bine ai venit!</T>
        </View>
      ) : null}
      {st.final ? (
        <View style={{ alignSelf: 'stretch', gap: 8 }}>
          {st.final === 'xp' ? (
            tour.replay
              ? <Big label="Hai să vedem ce faci diseară!" color="#FFD43B" ink="#0E1440" onPress={() => finish('/plan-nou')} />
              : <Big label="Mai departe" color="#FFD43B" ink="#0E1440" onPress={() => tourNext()} />
          ) : (
            <>
              <Big label="Arată-mi Plus" color="#FFD43B" ink="#0E1440" onPress={() => finish('/plus')} />
              <Big label="Hai să vedem ce faci diseară!" color="rgba(255,255,255,0.14)" onPress={() => finish('/plan-nou')} />
            </>
          )}
        </View>
      ) : null}
    </Animated.View>
  );

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent navigationBarTranslucent onRequestClose={() => (last ? finish() : tap())}>
      <Pressable style={{ flex: 1 }} onPress={tap} accessibilityLabel={st.hot ? 'Apasă pe zona luminată' : 'Mai departe'}>
        {hole ? (
          <>
            <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: Math.max(0, hole.y), backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: 0, right: 0, top: hole.y + hole.h, bottom: 0, backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: 0, width: Math.max(0, hole.x), top: hole.y, height: hole.h, backgroundColor: DIM }} />
            <View style={{ position: 'absolute', left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h, backgroundColor: DIM }} />
            <View pointerEvents="none" style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h, borderRadius: 18, borderWidth: 3, borderColor: '#FFD43B' }} />
            {st.hot ? <Pressable onPress={hit} accessibilityLabel={st.hot === 'profil' ? 'Deschide Profilul' : 'Deschide Plus'} style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h }} /> : null}
            <View pointerEvents="box-none" style={{ position: 'absolute', left: 20, right: 20, ...(below ? { top: Math.min(hole.y + hole.h + 16, H - 360) } : { bottom: Math.min(H - hole.y + 16, H - 360) }) }}>
              {bubble}
            </View>
          </>
        ) : (
          <View style={{ flex: 1, backgroundColor: st.magic ? 'rgba(4,7,24,0.35)' : DIM, justifyContent: 'center', paddingHorizontal: 24 }}>
            {bubble}
          </View>
        )}
        {!st.final && !st.magic ? (
          <Pressable onPress={() => finish()} hitSlop={10} style={{ position: 'absolute', right: 16, top: 48, paddingVertical: 8, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)' }} accessibilityLabel="Sari peste tur">
            <T style={{ fontFamily: F.sb, fontSize: 14, color: '#FFFFFF' }}>Sari peste</T>
          </Pressable>
        ) : null}
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: ins.bottom + 16, flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: hole && !below ? 0 : 1 }}>
          {steps.map((_, i) => <View key={i} style={{ width: i === tour.step ? 18 : 6, height: 6, borderRadius: 3, backgroundColor: i === tour.step ? '#FFD43B' : 'rgba(255,255,255,0.35)' }} />)}
        </View>
        <View style={{ width: W, height: 0 }} />
      </Pressable>
    </Modal>
  );
}
