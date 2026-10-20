// Intrarea și bonul: regulile comune (10%, un bon numărat o dată, note separate adunate) și simularea „Simulează o seară”.
import { describe, expect, it } from 'vitest';
import { SimNight, daySummary, feeOf, groupName, sampleReceipt, totals } from '../shared/entries';

describe('intrarea și bonul', () => {
  it('10% din bon, rotunjit la bani', () => {
    expect(feeOf(420)).toBe(42);
    expect(feeOf(123.45)).toBe(12.35);
    expect(feeOf(0)).toBe(0);
    expect(totals([{ id: 'a', total: 100, at: '', number: '1', by: 'client', scanners: 1, disputed: false }, { id: 'b', total: 50, at: '', number: '2', by: 'staff', scanners: 0, disputed: true }])).toEqual({ total: 100, fee: 10 });
    expect(groupName({ name: 'Andrei', people: 5 })).toBe('Andrei + 4');
    expect(groupName({ name: 'Ana', people: 1 })).toBe('Ana');
  });
  it('simularea: o seară întreagă, cu toate cele trei căi ale bonului', () => {
    const s = new SimNight('2026-10-23');
    const a = s.arrive('p1', 'Andrei', 5, '20:14');
    expect(s.arrive('p1', 'Andrei', 5, '20:15').id).toBe(a.id); // al doilea din gașcă intră în aceeași intrare
    s.setTable(a.id, ' 7 ');
    const bon = sampleReceipt('2026-10-23', '21:52', '0187', [['Paste', 96], ['Vin', 87], ['Restul', 237]]);
    expect(s.addReceipt(a.id, bon, 'client', 'andrei').duplicate).toBe(false);
    expect(s.addReceipt(a.id, bon, 'client', 'mihai').duplicate).toBe(true);
    expect(s.get(a.id)).toMatchObject({ table: '7', total: 420, fee: 42, scanned_by: 2, state: 'closed' });
    expect(s.get(a.id).receipts[0].scanners).toBe(2);
    s.addReceipt(a.id, sampleReceipt('2026-10-23', '22:05', '0190', [['Notă separată', 86]]), 'client', 'ioana');
    expect(s.get(a.id)).toMatchObject({ total: 506, fee: 50.6, scanned_by: 3 });
    expect(() => s.addReceipt(a.id, sampleReceipt('2026-10-22', '21:00', '0001', [['Ieri', 50]]), 'client', 'andrei')).toThrow(/seara asta/);
    const b = s.arrive('p2', 'Ioana', 2, '20:40');
    expect(() => s.addReceipt(b.id, bon, 'staff')).toThrow(/altă intrare/);
    s.addReceipt(b.id, sampleReceipt('2026-10-23', '22:31', '0203', [['Risotto', 58], ['Paste', 48], ['Vin', 80]]), 'staff');
    expect(s.get(b.id)).toMatchObject({ total: 186, fee: 18.6, scanned_by: 0 });
    const c = s.arrive('p3', 'Ana', 1, '21:00');
    s.endOfNight();
    expect(s.get(c.id).state).toBe('no_bill');
    s.dispute(b.id, s.get(b.id).receipts[0].id);
    expect(s.get(b.id)).toMatchObject({ total: 0, fee: 0 });
    expect(daySummary(s.entries)).toEqual({ entries: 3, people: 8, total: 506, fee: 50.6, noBill: 1 });
  });
});
