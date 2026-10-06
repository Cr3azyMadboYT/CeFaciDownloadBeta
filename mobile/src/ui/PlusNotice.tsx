// Bilu's notes about Plus (the gift, day 5 of the free week, the week ending, "payment comes later"),
// shown over whatever tab is open, so they are seen even without opening Plus.
import { Modal, View } from 'react-native';
import { setBoard, useApp } from '../lib/session';
import { toast } from '../lib/toast';
import { Bilu, type Mood } from './Bilu';
import { Big, T } from './kit';
import { F } from './theme';

const M: Record<string, [Mood, string, string, string | null]> = {
  gift: ['yay', 'Poftim: 7 zile de CeFaci Plus, cadou de la mine! Reducerile pornesc când intră primii parteneri. Când se termină, pagina se încețoșează iar, dar o reactivezi oricând.', 'Arată-mi Plus', null],
  day5: ['wink', 'Mai ai 3 zile din săptămâna de Plus. Nu-ți luăm nimic automat la final.', 'Mersi, Bilu!', null],
  expired: ['hi', 'Hei, săptămâna de probă a expirat! Vrei să continui sau ne oprim aici? Poți reveni oricând!', 'Continui cu Plus · 20 lei pe lună', 'Ne oprim aici'],
  used: ['hi', 'Săptămâna gratuită de Plus s-a folosit deja pe telefonul ăsta, cu alt cont. E una pe telefon, ca să fie corect pentru toți. Plus merge mai departe cu 20 lei pe lună.', 'Am înțeles', null],
  pay: ['wink', 'Plata pentru Plus vine curând, prin Google Play. Până atunci nu-ți luăm niciun ban.', 'Am înțeles', null],
};

export function PlusNotice() {
  const cur = useApp((s) => s.board.plusModal as string | undefined);
  const m = cur ? M[cur] : null;
  const close = (go: boolean) => {
    if (cur === 'expired') {
      if (go) { setBoard({ plusModal: 'pay' }); return; }
      setBoard({ plusModal: undefined, plus: 'off' });
      toast('Ne oprim aici. Poți reveni oricând din tab-ul Plus.');
      return;
    }
    setBoard({ plusModal: undefined });
  };
  return (
    <Modal visible={!!m} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent navigationBarTranslucent>
      <View style={{ flex: 1, backgroundColor: 'rgba(4,7,24,0.84)', paddingHorizontal: 24, justifyContent: 'center', gap: 16 }}>
        {m ? (
          <>
            <View style={{ alignItems: 'center' }}><Bilu size={150} mood={m[0]} /></View>
            <View style={{ padding: 16, borderRadius: 20, backgroundColor: '#FFFFFF' }}>
              <T style={{ fontFamily: F.sb, fontSize: 17, lineHeight: 24, color: '#0E1440' }}>{m[1]}</T>
            </View>
            <Big label={m[2]} color="#FFD43B" ink="#0E1440" onPress={() => close(true)} />
            {m[3] ? <Big label={m[3]} color="rgba(255,255,255,0.12)" onPress={() => close(false)} /> : null}
          </>
        ) : null}
      </View>
    </Modal>
  );
}
