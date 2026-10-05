// The app's wallpaper (decision Cornel, 05.10: "ca wallpaperul de la WhatsApp"): the questions friends ask each other
// before going out, scattered over the background so faintly that you see them only when you look for them. Fixed
// behind a screen's content (it does not scroll); cards and buttons cover it.
import { memo, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { T } from './kit';
import { F, useTheme } from './theme';

const QUESTIONS = [
  'Ce facem?', 'Unde mergem?', 'Cu cine ies?', 'Unde ieșim?', 'Când ieșim?', 'Vine cineva?', 'Ieșim diseară?', 'Cine mai vine?',
  'Pe la ce oră?', 'Unde ne vedem?', 'Facem ceva?', 'O bere?', 'Ce zici?', 'Băgăm un film?', 'Cine conduce?', 'Avem rezervare?',
  'Câți suntem?', 'Și după?', 'Mâncăm ceva?', 'Mai stăm?', 'Unde e lumea?', 'Ce e nou?', 'Hai afară?', 'La ce oră vii?',
  'Mai e deschis?', 'Club sau terasă?', 'Bowling?', 'Karaoke?', 'Mergem pe jos?', 'Iau mașina?', 'Ce chef ai?', 'Vii și tu?',
  'Weekendul ăsta?', 'Când ne vedem?', 'Plecăm acum?', 'Ne strângem toți?', 'Pizza sau shaorma?', 'Cine organizează?',
];
const FONTS = [F.hand, F.display, F.sb];

/** A number from 0 to 1, the same each time for the same i and salt (the questions stay where they are). */
const rnd = (i: number, salt: number) => { const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453; return x - Math.floor(x); };

export const Doodles = memo(function Doodles({ strength = 1 }: { strength?: number }) {
  const { t } = useTheme();
  const { width, height } = useWindowDimensions();
  const color = t.dark ? 'rgba(255,255,255,' + (0.045 * strength).toFixed(3) + ')' : 'rgba(14,20,64,' + (0.045 * strength).toFixed(3) + ')';
  // a grid of 4 columns × 10 rows, one question per cell, nudged a little so it does not look like a grid
  const items = useMemo(() => {
    const cols = 4, rows = 10, cw = width / cols, ch = height / rows;
    return Array.from({ length: cols * rows }, (_, i) => {
      const c = i % cols, r = Math.floor(i / cols);
      return {
        q: QUESTIONS[(i * 7 + r) % QUESTIONS.length],
        left: c * cw + rnd(i, 1) * cw * 0.35 - cw * 0.12,
        top: r * ch + rnd(i, 2) * ch * 0.45,
        rot: (rnd(i, 3) - 0.5) * 34,
        size: 11 + Math.round(rnd(i, 4) * 6),
        font: FONTS[Math.floor(rnd(i, 5) * FONTS.length)],
      };
    });
  }, [width, height]);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width, height, overflow: 'hidden' }} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {items.map((x, i) => (
        <T key={i} numberOfLines={1} maxFontSizeMultiplier={1}
          style={{ position: 'absolute', left: x.left, top: x.top, transform: [{ rotate: x.rot.toFixed(0) + 'deg' }], fontFamily: x.font, fontSize: x.font === F.hand ? x.size + 4 : x.size, color }}>
          {x.q}
        </T>
      ))}
    </View>
  );
});
