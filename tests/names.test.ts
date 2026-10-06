// Nume urâte (decizie Cornel, 06.10): aceeași regulă în aplicație (src/app/names.ts) și pe server (private.rude).
import { describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs';
import { isRudeName, LEET, LETTERS, RUDE_ANYWHERE, RUDE_EDGE, RUDE_EXACT } from '../src/app/names';

const MIGRATION = fs.readFileSync('supabase/migrations/20261006050000_cefaci_drepturi_nume.sql', 'utf8');

const RUDE = [
  'pula', 'Pula', 'PULA', 'pulă', 'pu1a', 'pu|a', 'pul@', 'pwla', 'puuuula', 'p.u.l.a', 'p u l a', 'p-u-l-a', 'pula_mea', 'pulamea', 'p.u.l.a.m.e.a', 'ionutpula', 'pulaionut',
  'pizda', 'pizdă', 'p1zda', 'pyzda', 'pizzzda', 'pizdi', 'pizdulice', 'p i z d a', 'pzd',
  'cacat', 'căcat', 'kakat', 'caccat', 'c4c4t', 'cacatu', 'cacaturi', 'kkkakat',
  'muie', 'mu1e', 'mui3', 'muiee', 'muie_ta', 'muje', 'mue', 'muist', 'muisti',
  'pisat', 'pișat', 'pisatu', 'p1sat', 'pisatoare',
  'sula', 'futu-ți', 'futui', 'futut', 'fut', 'fmm', 'plm', 'coaie', 'coi', 'curva', 'kurva', 'curvă', 'labagiu', 'bulangiu', 'poponar', 'sloboz',
  'fuck', 'fuckboy', 'fucking', 'f.u.c.k',  'shit', 'bitch', 'cunt', 'porno', 'sex', 'dildo', 'hitler', 'nazi', 'idiot', 'prost', 'retard',
];

const FINE = [
  'Ana', 'Ana-Maria', 'Ursula', 'Paula', 'Paul', 'Pavel', 'Puiu', 'Mihai', 'Ioana', 'Cornel', 'Teodora', 'Ștefan', 'Țuțu', 'Răzvan', 'Bianca', 'Cristi', 'Matei',
  'Mata', 'Fănel', 'Curelea', 'Popa', 'Pisică', 'Pisa', 'Mortimer', 'Muiu', 'Cucu', 'Sulina', 'Pulisic', 'Futurist', 'Dracula', 'Nazira', 'Scunthorpe', 'Penelope',
  'ana.p', 'bob', 'cris', 'teen', 'cornel1987', 'ana_99', 'mihai.ies', 'populara', 'manipulare', 'superman', 'curve', 'pornire',
  'Gașca de vineri', 'Gașca pornită', 'Pe Nisip', 'Băieții de la bloc', 'Fetele', 'Tu, Ana și Bob', 'Cafeaua de duminică', 'Vin și brânză', 'Echipa 2004',
];

describe('nume urâte', () => {
  it('prinde vorbele urâte și variantele lor', () => {
    expect(RUDE.filter((n) => !isRudeName(n))).toEqual([]);
  });

  it('nu blochează nume bune', () => {
    expect(FINE.filter((n) => isRudeName(n))).toEqual([]);
  });

  it('listele sunt scrise cum le vede regula (altfel un cuvânt n-ar fi prins niciodată)', () => {
    const tr = (w: string) => [...w].map((ch) => { const i = LETTERS[0].indexOf(ch); return i < 0 ? ch : LETTERS[1][i]; }).join('').replace(/(.)\1+/g, '$1');
    expect([...RUDE_ANYWHERE, ...RUDE_EDGE, ...RUDE_EXACT].filter((w) => tr(w) !== w || !/^[a-z]+$/.test(w))).toEqual([]);
  });

  it('aplicația și serverul au aceleași liste', () => {
    const arr = (name: string) => JSON.parse('[' + new RegExp(name + ` text\\[\\] := array\\[([^\\]]*)\\]`).exec(MIGRATION)![1].replace(/'/g, '"') + ']');
    expect(arr('anywhere')).toEqual(RUDE_ANYWHERE);
    expect(arr('edge')).toEqual(RUDE_EDGE);
    expect(arr('exact')).toEqual(RUDE_EXACT);
    expect(MIGRATION).toContain(`translate(lower(p), '${LETTERS[0]}', '${LETTERS[1]}')`);
    expect(MIGRATION).toContain(`translate(base, '${LEET[0]}', '${LEET[1]}')`);
  });

  it('serverul răspunde la fel ca aplicația', async () => {
    const db = new PGlite();
    const fn = /create or replace function private\.rude[\s\S]*?end \$\$;/.exec(MIGRATION)![0];
    await db.exec('create schema private;\n' + fn);
    const all = [...RUDE, ...FINE];
    const got = (await db.query<{ r: boolean }>(`select private.rude(x) r from unnest($1::text[]) with ordinality t(x, i) order by i`, [all])).rows.map((r) => r.r);
    expect(all.filter((n, i) => got[i] !== isRudeName(n))).toEqual([]);
  }, 30000);
});
