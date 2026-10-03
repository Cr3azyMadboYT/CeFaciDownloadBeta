// Reading Romanian fiscal receipts from OCR text: CUI with its check digit, date, time, total.
import { describe, expect, it } from 'vitest';
import { cuiValid, parseBon } from '../supabase/functions/citeste-bon/bon';

describe('bon fiscal', () => {
  it('checks the CUI control digit', () => {
    expect(cuiValid('RO14399840')).toBe(true);  // Dante International (eMAG)
    expect(cuiValid('14399841')).toBe(false);
    expect(cuiValid('18547290')).toBe(true);    // Orange Romania
  });
  it('reads a typical restaurant receipt', () => {
    const text = `S.C. CARU CU BERE S.R.L.
STR. STAVROPOLEOS 5, BUCURESTI
C.I.F.: RO14399840
BON FISCAL
2 x 12,50 = 25,00
BERE 0,5L  15,00
SUBTOTAL 40,00
TOTAL TVA 3,30
TOTAL LEI 40,00
NUMERAR 50,00
REST 10,00
02.10.2026  21:47:13
ID UNIC: 1234567`;
    expect(parseBon(text)).toEqual({ cui: '14399840', cuiValid: true, date: '2026-10-02', time: '21:47', total: 40 });
  });
  it('finds the amount on the next line and thousands separators', () => {
    const text = `COD FISCAL: 18547290\nDATA: 2026-10-03 ORA: 01:05\nTOTAL\n1.234,50\nCARD 1.234,50`;
    expect(parseBon(text)).toMatchObject({ cui: '18547290', cuiValid: true, date: '2026-10-03', time: '01:05', total: 1234.5 });
  });
  it('says when the CUI does not check out', () => {
    expect(parseBon('CIF 12345678\nTOTAL 10,00')).toMatchObject({ cui: '12345678', cuiValid: false, total: 10 });
  });
  it('copes with an empty or unreadable text', () => {
    expect(parseBon('')).toEqual({ cui: null, cuiValid: false, date: null, time: null, total: null });
  });
});
