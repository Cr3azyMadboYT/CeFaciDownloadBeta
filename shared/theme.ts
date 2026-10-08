// Colours and type from the design canvases (design/canvas/client): "zi" (light) and "noapte" (graphite).
import { createContext, useContext } from 'react';

export const zi = {
  dark: false,
  bg: '#E8EBF2', bgCont: '#EEF1FB', s1: '#FFFFFF', s2: '#DCE0EA', s3: '#D3D9EF', line: '#D2D7E3',
  ink: '#0E1440', ink2: '#454E7E', ink3: '#5A6390',
  blue: '#2F5BFF', blueInk: '#2447E0', blueSoft: 'rgba(47,91,255,0.12)',
  yellow: '#FFD43B', yellowInk: '#7A5E00', yellowSoft: 'rgba(255,212,59,0.3)',
  coral: '#FF6A4D', coralInk: '#A8341C', coralSoft: 'rgba(255,106,77,0.14)',
  violet: '#8C6CFF', violetInk: '#5B3FD9', violetSoft: 'rgba(140,108,255,0.14)',
  greenInk: '#1E7A4C', greenSoft: 'rgba(30,160,90,0.14)',
  navy: '#0E1440', scrim: 'rgba(14,20,64,0.42)', doodle: '#0E1440',
};
export type Theme = typeof zi;
export const noapte: Theme = {
  ...zi,
  dark: true,
  bg: '#121215', bgCont: '#121215', s1: '#1C1C21', s2: '#28282F', s3: '#35353D', line: '#35353D',
  ink: '#F4F4F6', ink2: '#B7B7C1', ink3: '#90909B',
  blueInk: '#8EA6FF', blueSoft: 'rgba(47,91,255,0.22)',
  yellowInk: '#FFD43B', yellowSoft: 'rgba(255,212,59,0.16)',
  coralInk: '#FF8A73', coralSoft: 'rgba(255,106,77,0.18)',
  violetInk: '#B7A3FF', violetSoft: 'rgba(140,108,255,0.2)',
  greenInk: '#5FD39A', greenSoft: 'rgba(60,200,130,0.16)',
  scrim: 'rgba(0,0,0,0.62)', doodle: '#FFFFFF',
};
// the night-sky card on Acasă is navy in both themes
export const night = {
  bg: '#0B1030', s1: '#141B45', s2: '#1D2660', line: '#2B3575', ink: '#F3F5FF', ink2: '#A9B1DA', ink3: '#8690C4',
};

export const F = {
  display: 'BricolageGrotesque_800ExtraBold',
  displayBold: 'BricolageGrotesque_700Bold',
  r: 'InstrumentSans_400Regular',
  m: 'InstrumentSans_500Medium',
  sb: 'InstrumentSans_600SemiBold',
  b: 'InstrumentSans_700Bold',
  hand: 'Caveat_700Bold',
};

export const ThemeCtx = createContext<{ t: Theme; name: 'zi' | 'noapte'; set: (n: 'zi' | 'noapte') => void }>({ t: zi, name: 'zi', set: () => {} });
export const useTheme = () => useContext(ThemeCtx);
