// Limba din aplicația de telefon: aceeași funcție tr() ca motorul (src/i18n). Alegerea stă în board.lang
// (se salvează și în cont); fără alegere, limba telefonului (română → RO, altfel EN, pentru turiști).
import { lang, setLang, type Lang } from '../../../src/i18n';
import { firstLang } from './e2e';
import { getApp, setBoard, useApp } from './session';
import { registerPush } from './push';

export { tr, trServer, pick, lang, locale, type Lang } from '../../../src/i18n';

export const chosenLang = (b: { lang?: unknown }): Lang => (b.lang === 'en' || b.lang === 'ro' ? b.lang : firstLang());
/** Limba curentă, ca să se redeseneze ecranul când se schimbă. */
export function useLang(): Lang {
  const l = useApp((s) => chosenLang(s.board));
  if (l !== lang()) setLang(l);
  return l;
}
export function chooseLang(l: Lang) {
  setLang(l); setBoard({ lang: l });
  if (getApp().known) void registerPush(); // notifications in the new language too
}
