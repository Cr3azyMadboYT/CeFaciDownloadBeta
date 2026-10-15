// Limba din aplicația de telefon: aceeași funcție tr() ca motorul (src/i18n). Alegerea stă în board.lang
// (se salvează și în cont); fără alegere, limba telefonului (română → RO, altfel EN, pentru turiști).
import { deviceLang, lang, setLang, type Lang } from '../../../src/i18n';
import { setBoard, useApp } from './session';

export { tr, trServer, pick, lang, locale, type Lang } from '../../../src/i18n';

export const chosenLang = (b: { lang?: unknown }): Lang => (b.lang === 'en' || b.lang === 'ro' ? b.lang : deviceLang());
/** Limba curentă, ca să se redeseneze ecranul când se schimbă. */
export function useLang(): Lang {
  const l = useApp((s) => chosenLang(s.board));
  if (l !== lang()) setLang(l);
  return l;
}
export function chooseLang(l: Lang) { setLang(l); setBoard({ lang: l }); }
