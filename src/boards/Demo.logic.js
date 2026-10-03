// Generated from design/Demo.dc.html by scripts/extract-boards.mjs. Do not edit; change the patches.
/* eslint-disable */
import { APP } from '../app/bridge';
export function make(DCLogic) {

const ICONS = {
  fork: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7',
  beer: 'M17 11h1a3 3 0 0 1 0 6h-1M9 12v6M13 12v6M14 7.5c-1 0-1.44.5-3 .5s-2-.5-3-.5-1.72.5-2.5.5a2.5 2.5 0 0 1 0-5c.78 0 1.57.5 2.5.5S9.44 2 11 2s2 1.5 3 1.5 1.72-.5 2.5-.5a2.5 2.5 0 0 1 0 5c-.78 0-1.5-.5-2.5-.5ZM5 8v12a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8',
  bowl: 'M12 3a2 2 0 0 0-2 2c0 1.5 1 2 1 3.5 0 1-3 3-3 7a4 4 0 0 0 8 0c0-4-3-6-3-7 0-1.5 1-2 1-3.5a2 2 0 0 0-2-2zM10.6 9.5h2.8',
  burger: 'M4 11a8 5.5 0 0 1 16 0zM3 14h18M4 17h16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z',
  key: 'M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4zM16.5 7.5h.01',
  mic: 'M12 19v3M19 10v2a7 7 0 0 1-14 0v-2M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3z',
  club: 'M9 18V6l10-2v12M5 18a2 2 0 1 0 4 0 2 2 0 1 0-4 0M15 16a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  waves: 'M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1',
  sweet: 'm7 11 4.08 10.35a1 1 0 0 0 1.84 0L17 11M17 7A5 5 0 0 0 7 7M17 7a2 2 0 0 1 0 4H7a2 2 0 0 1 0-4',
  film: 'M20.2 6 3 11l-.9-2.4c-.3-1.1.3-2.2 1.3-2.5l13.5-4c1.1-.3 2.2.3 2.5 1.3ZM6.2 5.3l3.1 3.9M12.4 3.4l3.1 4M3 11h18v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z',
  target: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0M6 12a6 6 0 1 0 12 0 6 6 0 1 0-12 0M10 12a2 2 0 1 0 4 0 2 2 0 1 0-4 0',
  dice: 'M4 7a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v10a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3zM9 9h.01M15 15h.01M12 12h.01M15 9h.01M9 15h.01',
  landmark: 'M3 22h18M6 18v-7M10 18v-7M14 18v-7M18 18v-7M12 2 20 7H4z',
  coffee: 'M10 2v2M14 2v2M6 2v2M16 8a1 1 0 0 1 1 1v8a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V9a1 1 0 0 1 1-1h14a4 4 0 1 1 0 8h-1',
  vr: 'M3 8h18v8h-6l-3-3-3 3H3zM7 12h.01M17 12h.01',
  cocktail: 'M8 22h8M12 11v11M3 3l9 9 9-9zM7 7h10',
  pizza: 'M4 6l16 0-8 15zM4 6q8-3.5 16 0M10.5 10h.01M13.5 13.5h.01',
  smile: 'M2 12a10 10 0 1 0 20 0 10 10 0 1 0-20 0M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  star: 'M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.756a.53.53 0 0 1 .294.904l-3.736 3.638a2.123 2.123 0 0 0-.611 1.878l.882 5.14a.53.53 0 0 1-.771.56l-4.618-2.428a2.122 2.122 0 0 0-1.973 0L6.396 21.01a.53.53 0 0 1-.77-.56l.881-5.139a2.122 2.122 0 0 0-.611-1.879L2.16 9.795a.53.53 0 0 1 .294-.906l5.165-.755a2.122 2.122 0 0 0 1.597-1.16z',
  bolt: 'M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z',
  heart: 'M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z'
};
const ALL = ['now', 'eve', 'tom', 'we'];
const SEAT_ROWS = ['D', 'E', 'F', 'G'];
const SEAT_TAKEN = ['D1', 'D2', 'D3', 'D4', 'D9', 'E7', 'E8', 'F1', 'F2', 'F10', 'G5', 'G6', 'G9', 'G10'];
const PLACES = APP.places;
const PLACES_DESIGN = [
  { id: 'pista9', name: 'Pista 9', title: 'Bowling', icon: 'bowl', bg: '#2F5BFF', fg: '#FFFFFF', dot: '#8EA6FF', price: 45, dur: 2, dist: 8, vibes: ['Competitiv', 'Fun'], min: 1, max: 8, when: ALL, res: 'required', verified: true, partner: true, t: '20:00' },
  { id: 'casagrill', name: 'Casa Grill', title: 'Burgeri la grătar', icon: 'burger', bg: '#FF6A4D', fg: '#0E1440', dot: '#FFD43B', price: 55, dur: 1.5, dist: 6, vibes: ['Mâncare bună', 'Chill'], min: 1, max: 10, when: ALL, res: 'recommended', verified: true, t: '20:00', contact: { phone: '0721 000 111', wa: true, unit: 'o masă' } },
  { id: 'laborator', name: 'Laboratorul', title: 'Escape room „Formula pierdută”', icon: 'key', bg: '#8C6CFF', fg: '#0E1440', dot: '#B7A3FF', price: 70, dur: 1.5, dist: 12, vibes: ['Competitiv', 'Fun'], min: 2, max: 6, when: ['eve', 'tom', 'we'], res: 'required', verified: true, partner: true, fresh: true, t: '20:30' },
  { id: 'notafalsa', name: 'Nota Falsă', title: 'Seară de karaoke', icon: 'mic', bg: '#FFD43B', fg: '#0E1440', dot: '#FF6A4D', price: 40, dur: 3, dist: 10, vibes: ['Fun', 'Party'], min: 2, max: 12, when: ['eve', 'we'], res: 'recommended', verified: true, t: '21:00', contact: { phone: '0744 000 222', wa: true, unit: 'o masă' } },
  { id: 'neon', name: 'Club Neon 21', title: 'Noapte de club, DJ până la 4', icon: 'club', bg: '#0E1440', fg: '#FFD43B', dot: '#8C6CFF', price: 50, dur: 5, dist: 14, vibes: ['Party', 'Fun'], min: 1, max: 12, when: ['eve', 'we'], res: 'none', verified: true, partner: true, age: true, t: '23:00', entry: { kind: 'app', price: 40, door: 60, left: 23 } },
  { id: 'lac', name: 'Lacul Buftea', title: 'Plimbare pe malul lacului', icon: 'waves', bg: '#8EA6FF', fg: '#0E1440', dot: '#FFD43B', price: 0, dur: 1, dist: 5, vibes: ['Aer liber', 'Chill'], min: 1, max: 20, when: ALL, res: 'none', t: '20:00' },
  { id: 'mia', name: 'Cofetăria Mia', title: 'Desert și cafea', icon: 'sweet', bg: '#FF8A73', fg: '#0E1440', dot: '#FFE58A', price: 25, dur: 1, dist: 4, vibes: ['Chill', 'Mâncare bună'], min: 1, max: 8, when: ALL, res: 'none', verified: true, partner: true, t: '20:00' },
  { id: 'cinema', name: 'Cinema Nord', title: 'Film în premieră', icon: 'film', bg: '#1D2660', fg: '#F3F5FF', dot: '#2F5BFF', price: 35, dur: 2.5, dist: 15, vibes: ['Chill', 'Cultură'], min: 1, max: 20, when: ALL, res: 'none', verified: true, partner: true, t: '20:15', entry: { kind: 'app', price: 35, left: 18, seats: true } },
  { id: 'padel', name: 'Padel Chitila', title: 'Padel, 2 contra 2', icon: 'target', bg: '#B7A3FF', fg: '#0E1440', dot: '#FFD43B', price: 60, dur: 1.5, dist: 11, vibes: ['Competitiv', 'Aer liber'], min: 2, max: 4, when: ['eve', 'tom', 'we'], res: 'required', verified: true, t: '19:30', contact: { phone: '0755 000 333', web: true, unit: 'un teren' } },
  { id: 'zarul', name: 'Zarul', title: 'Jocuri de societate', icon: 'dice', bg: '#FFE58A', fg: '#0E1440', dot: '#8C6CFF', price: 30, dur: 2.5, dist: 7, vibes: ['Fun', 'Chill'], min: 2, max: 8, when: ALL, res: 'recommended', t: '20:00', contact: { phone: '0766 000 444', unit: 'o masă' } },
  { id: 'mogosoaia', name: 'Mogoșoaia', title: 'Palatul și parcul', icon: 'landmark', bg: '#FFD43B', fg: '#0E1440', dot: '#8EA6FF', price: 20, dur: 2, dist: 13, vibes: ['Cultură', 'Aer liber'], min: 1, max: 20, when: ['tom', 'we'], res: 'none', verified: true, t: '11:00' },
  { id: 'boabe', name: 'Boabe', title: 'Cafea de specialitate', icon: 'coffee', bg: '#DCE0EA', fg: '#0E1440', dot: '#FF6A4D', price: 20, dur: 1, dist: 3, vibes: ['Chill'], min: 1, max: 6, when: ['tom', 'we'], res: 'none', t: '10:30' },
  { id: 'vr', name: 'Arena VR', title: 'Realitate virtuală', icon: 'vr', bg: '#2F5BFF', fg: '#FFFFFF', dot: '#FF6A4D', price: 65, dur: 1, dist: 16, vibes: ['Competitiv', 'Fun'], min: 1, max: 6, when: ALL, res: 'required', fresh: true, t: '20:00', contact: { phone: '0733 000 555', web: true, unit: 'o sesiune' } },
  { id: 'rooftop', name: 'Rooftop 9', title: 'Cocktailuri pe terasă', icon: 'cocktail', bg: '#FF6A4D', fg: '#0E1440', dot: '#8C6CFF', price: 60, dur: 2.5, dist: 12, vibes: ['Party', 'Chill'], min: 2, max: 10, when: ['now', 'eve', 'we'], res: 'recommended', verified: true, age: true, fresh: true, t: '21:00', contact: { phone: '0722 000 666', wa: true, unit: 'o masă' } },
  { id: 'forno', name: 'Forno', title: 'Pizza la cuptor cu lemne', icon: 'pizza', bg: '#FFD43B', fg: '#0E1440', dot: '#FF6A4D', price: 45, dur: 1.5, dist: 9, vibes: ['Mâncare bună'], min: 1, max: 10, when: ALL, res: 'recommended', verified: true, t: '20:00', contact: { phone: '0745 000 777', unit: 'o masă' } },
  { id: 'subsol', name: 'Subsol', title: 'Stand-up comedy', icon: 'smile', bg: '#8C6CFF', fg: '#0E1440', dot: '#FFD43B', price: 50, dur: 2, dist: 18, vibes: ['Cultură', 'Fun'], min: 1, max: 20, when: ['eve', 'we'], res: 'none', fresh: true, t: '20:30', entry: { kind: 'web', price: 50 } }
];
const VIBES = ['Chill', 'Fun', 'Competitiv', 'Party', 'Aer liber', 'Mâncare bună', 'Cultură'];
const WHO = { 1: { label: 'Doar eu', n: 1, text: 'Doar tu' }, 2: { label: 'În doi', n: 2, text: 'În doi' }, 34: { label: '3–4', n: 4, text: 'Gașca, 4' }, 5: { label: '5+', n: 5, text: 'Gașca de vineri' } };
const WHEN = { now: { label: 'Acum', word: 'acum?', date: 'Azi, acum', day: 'azi' }, eve: { label: 'Diseară', word: 'diseară?', date: 'Azi, 28 sept.', day: 'azi' }, tom: { label: 'Mâine', word: 'mâine?', date: 'Mâine, 29 sept.', day: 'mâine' }, we: { label: 'Weekend', word: 'în weekend?', date: 'Sâmbătă, 3 oct.', day: 'sâm.' } };
APP.fixWhen(WHEN);
const DUR = { 1: { label: '1 oră', max: 1.5, text: '1 oră' }, 23: { label: '2–3 ore', max: 3, text: '2–3 ore' }, 4: { label: '4+ ore', max: 99, text: '4+ ore' } };
const BUDGET = { 0: { label: 'Gratuit', max: 0, text: 'gratuit' }, 50: { label: '≤ 50', max: 50, text: 'până în 50 lei' }, 100: { label: '≤ 100', max: 100, text: 'până în 100 lei' }, 200: { label: '≤ 200', max: 200, text: 'până în 200 lei' }, any: { label: 'Oricât', max: 9999, text: 'orice buget' } };
const DIST = { 10: { label: '10 min', max: 10 }, 20: { label: '20 min', max: 20 }, 30: { label: '30 min', max: 30 } };
const FRIENDS = ['I', 'M', 'S', 'R', 'B', 'V', 'E'];
const VISITED = [];
const VISITED_DESIGN = [['Zarul', 'dice', 'var(--blue-ink)', '-7deg'], ['Casa Grill', 'burger', 'var(--coral-ink)', '5deg'], ['Lacul Buftea', 'waves', 'var(--yellow-ink)', '-3deg'], ['Boabe', 'coffee', 'var(--violet-ink)', '8deg'], ['Nota Falsă', 'mic', 'var(--violet-ink)', '-9deg'], ['Cofetăria Mia', 'sweet', 'var(--coral-ink)', '3deg'], ['Mogoșoaia', 'landmark', 'var(--yellow-ink)', '-5deg'], ['Cinema Nord', 'film', 'var(--blue-ink)', '6deg'], ['Padel Chitila', 'target', 'var(--blue-ink)', '-4deg']];

const DROPS = [];
const DROPS_DESIGN = [
  { placeId: 'neon', offer: 'Intrare liberă până la 23:30', mins: 185, stock: 20, left: 12 },
  { placeId: 'pista9', offer: '−25% la pistă până la 21:00', mins: 80, stock: 6, left: 3 },
  { placeId: 'mia', offer: 'Desert gratuit la 4+ persoane', mins: 70, stock: 10, left: 5, min: 4 },
  { placeId: 'rooftop', offer: '2 cocktailuri la 45 lei', mins: 95, stock: 16, left: 10 },
  { placeId: 'forno', offer: 'A doua pizza la jumătate', mins: 120, stock: 12, left: 8 },
  { placeId: 'vr', offer: '15 minute gratuite la o sesiune', mins: 150, stock: 8, left: 4 }
];
const GV = [
  { ini: 'I', name: 'Ioana', user: 'ioana.m', bg: '#8C6CFF', fg: '#0E1440', answer: 'da' },
  { ini: 'M', name: 'Mihai', user: 'mihai.d', bg: '#FF6A4D', fg: '#0E1440', answer: 'da' },
  { ini: 'S', name: 'Sara', user: 'sara.p', bg: '#FFD43B', fg: '#0E1440', answer: 'da' },
  { ini: 'R', name: 'Radu', user: 'radu.c', bg: '#3A4585', fg: '#F3F5FF', answer: 'nu' }
];
const PJ = [
  { ini: 'R', name: 'Radu', user: 'radu.c', bg: '#3A4585', fg: '#F3F5FF', answer: 'da' },
  { ini: 'B', name: 'Bianca', user: 'bia.t', bg: '#5B3FD9', fg: '#FFFFFF', answer: 'da' },
  { ini: 'V', name: 'Vlad', user: 'vlad.s', bg: '#8EA6FF', fg: '#0E1440', answer: 'nu' }
];
const IOANA = [{ ini: 'I', name: 'Ioana', user: 'ioana.m', bg: '#8C6CFF', fg: '#0E1440', answer: 'da' }];
const TUDOR = { name: 'Tudor Marin', user: 'tudor.m', ini: 'T', bg: '#FF8A73', fg: '#0E1440' };
const MARIA = { name: 'Maria Ionescu', user: 'maria.i', ini: 'M', bg: '#FFE58A', fg: '#0E1440' };
const LEVELS = ['', 'Boboc', 'Scânteie', 'Radar', 'Busolă', 'Motorul găștii', 'Legenda orașului'];
const LEVEL_XP = [0, 100, 400, 900, 1500, 2500, 4000];
const LEVEL_TAG = ['', 'Abia ai ieșit din casă. Bine ai venit!', 'Ai prins gustul ieșitului.', 'Simți de la distanță unde se întâmplă ceva.', 'Toți te întreabă pe tine unde mergem.', 'Fără tine, gașca stă acasă.', 'Localurile știu cum te cheamă.'];
const PLUS = {};
const PLUS_DESIGN = { pista9: [15, 'fără vineri și sâmbătă după 20:00'], laborator: [10, 'oricând'], neon: [20, 'la intrare, până la 01:00'], mia: [20, 'oricând'], cinema: [10, 'luni–joi'] };
const PLUS_PERKS = [
  ['M19 5 5 19M6.5 4a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5M17.5 15a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5', 'Reducere de 10–20% la partenerii CeFaci', 'De fiecare dată când ieși, nu doar la Live Drops.'],
  ['M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 3a4 4 0 1 0 0 8 4 4 0 1 0 0-8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75', 'Și pentru gașca ta', 'Până la 4 oameni la aceeași masă, cu codul tău.'],
  ['M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z', 'Live Drops cu 10 minute mai devreme', 'Prinzi reducerile fulger înaintea tuturor.'],
  ['M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2ZM13 5v2M13 17v2M13 11v2', 'Fără taxă de serviciu la bilete', 'Și acces la evenimentele doar pentru Plus.'],
  ['M12 2l2.9 6.9L22 9.3l-5.4 4.8L18.2 21 12 17.3 5.8 21l1.6-6.9L2 9.3l7.1-.4z', 'Bilu auriu și carnet auriu', 'Să se vadă de departe cine e Plus.']
];
const BON = {
  pista9: { cif: 'RO 41882306', lines: [['Pistă 2h', 90], ['Nachos x2', 44], ['Limonadă x4', 56]] },
  laborator: { cif: 'RO 39015472', lines: [['Escape room, 4 pers.', 280], ['Apă plată x4', 24]] },
  neon: { cif: 'RO 44710938', lines: [['Intrare x4', 160], ['Cocktail x4', 128]] },
  mia: { cif: 'RO 38266051', lines: [['Tort de ciocolată x3', 57], ['Cappuccino x3', 42]] },
  cinema: { cif: 'RO 40557219', lines: [['Popcorn mare x2', 50], ['Suc x4', 44]] }
};
const PLUS_SAVED = [];
const PLUS_SAVED_DESIGN = [['pista9', 27, 'bowling, 4 persoane, marți'], ['mia', 20, 'desert și cafea, 5 persoane, joi']];
const BL_ARMS = {
  rest: ['M24 88Q12 94 13 106', 13, 107, 'M96 88Q108 94 107 106', 107, 107],
  hi: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q112 76 112 58', 112, 56],
  up: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q110 72 108 50', 108, 48],
  down: ['M24 88Q12 94 13 106', 13, 107, 'M96 90Q110 98 116 112', 117, 114],
  left: ['M24 86Q8 80 2 66', 1, 64, 'M96 88Q108 94 107 106', 107, 107],
  wink: ['M24 88Q12 94 13 106', 13, 107, 'M96 88Q112 84 110 68', 110, 66],
  yay: ['M24 86Q8 74 10 54', 10, 52, 'M96 86Q112 74 110 54', 110, 52],
  oops: ['M24 90Q10 76 30 60', 31, 58, 'M96 90Q110 76 90 60', 89, 58],
  magic: ['M24 88Q12 94 13 106', 13, 107, 'M96 86Q110 72 108 50', 108, 48]
};
const BL_LOOK = { c: [0, 0], up: [0, -3.5], down: [0, 3.5], left: [-3.5, 0], right: [3.5, 0], ul: [-2.6, -2.6], ur: [2.6, -2.6], dl: [-2.6, 2.6], dr: [2.6, 2.6] };
function biluPose(mood, look) {
  const a = BL_ARMS[mood] || BL_ARMS.rest;
  const l = BL_LOOK[look || 'c'] || BL_LOOK.c;
  const open = 'M48 52Q60 70 72 52Z';
  const smile = 'M50 54Q60 64 70 54Q60 59 50 54Z';
  const p = {
    armL: a[0], hLx: a[1], hLy: a[2], armR: a[3], hRx: a[4], hRy: a[5],
    pLx: 46 + l[0], pLy: 41 + l[1], pRx: 74 + l[0], pRy: 41 + l[1],
    gLx: 47.6 + l[0], gLy: 38.6 + l[1], gRx: 75.6 + l[0], gRy: 38.6 + l[1],
    eL: 1, eR: 1, arcs: '', brow: 0, wand: 0, mouth: smile, tongue: '', cls: 'bilu m-' + mood
  };
  if (mood === 'hi') { p.mouth = open; p.tongue = 'M53 60Q60 67 67 60Q60 57 53 60Z'; }
  if (mood === 'wink') { p.eL = 0; p.arcs = 'M39 42Q46 35 53 42'; p.mouth = 'M49 53Q60 67 71 53Z'; p.tongue = 'M54 60Q60 64 66 60Q60 58 54 60Z'; }
  if (mood === 'yay') { p.eL = 0; p.eR = 0; p.arcs = 'M39 43Q46 32 53 43M67 43Q74 32 81 43'; p.mouth = 'M46 50Q60 76 74 50Z'; p.tongue = 'M52 62Q60 71 68 62Q60 58 52 62Z'; }
  if (mood === 'magic') { p.wand = 1; p.eL = 0; p.arcs = 'M39 42Q46 35 53 42'; p.mouth = 'M49 53Q60 67 71 53Z'; p.tongue = 'M54 60Q60 64 66 60Q60 58 54 60Z'; }
  if (mood === 'oops') { p.brow = 1; p.mouth = 'M55 58A5 6 0 1 0 65 58A5 6 0 1 0 55 58Z'; p.tongue = ''; }
  return p;
}
const PROFILES = {
  'ioana.m': { lvl: 5, outings: 31, together: 8, stamps: ['pista9', 'laborator', 'notafalsa', 'neon', 'lac', 'mia', 'cinema', 'zarul', 'mogosoaia', 'rooftop', 'forno', 'subsol'], mutual: ['mihai.d', 'sara.p', 'radu.c'] },
  'mihai.d': { lvl: 4, outings: 19, together: 6, stamps: ['pista9', 'casagrill', 'padel', 'vr', 'zarul', 'forno', 'neon', 'laborator'], mutual: ['ioana.m', 'sara.p'] },
  'sara.p': { lvl: 3, outings: 14, together: 5, stamps: ['mia', 'boabe', 'lac', 'cinema', 'mogosoaia', 'rooftop', 'forno'], mutual: ['ioana.m', 'mihai.d', 'elena.r'] },
  'radu.c': { lvl: 4, outings: 22, together: 7, stamps: ['pista9', 'padel', 'vr', 'laborator', 'neon', 'rooftop', 'zarul', 'casagrill', 'subsol'], mutual: ['ioana.m', 'bia.t', 'vlad.s'] },
  'bia.t': { lvl: 2, outings: 5, together: 2, stamps: ['padel', 'boabe', 'mia'], mutual: ['radu.c', 'vlad.s'] },
  'vlad.s': { lvl: 3, outings: 9, together: 2, stamps: ['padel', 'vr', 'neon', 'pista9', 'forno'], mutual: ['radu.c', 'bia.t'] },
  'elena.r': { lvl: 1, outings: 1, together: 0, stamps: ['lac'], mutual: ['sara.p'] },
  'tudor.m': { lvl: 2, outings: 6, together: 0, stamps: ['neon', 'rooftop', 'cinema', 'forno'], mutual: ['mihai.d'] },
  'maria.i': { lvl: 3, outings: 12, together: 0, stamps: [], mutual: ['ioana.m', 'sara.p'] }
};
const INKS = ['var(--blue-ink)', 'var(--coral-ink)', 'var(--yellow-ink)', 'var(--violet-ink)'];
const FRIEND_BASE = [
  { name: 'Ioana Munteanu', user: 'ioana.m', ini: 'I', bg: '#8C6CFF', fg: '#0E1440' },
  { name: 'Mihai Dobre', user: 'mihai.d', ini: 'M', bg: '#FF6A4D', fg: '#0E1440' },
  { name: 'Sara Popa', user: 'sara.p', ini: 'S', bg: '#FFD43B', fg: '#0E1440' },
  { name: 'Radu Constantin', user: 'radu.c', ini: 'R', bg: '#3A4585', fg: '#F3F5FF' },
  { name: 'Bianca Toma', user: 'bia.t', ini: 'B', bg: '#5B3FD9', fg: '#FFFFFF' },
  { name: 'Vlad Stan', user: 'vlad.s', ini: 'V', bg: '#8EA6FF', fg: '#0E1440', answer: 'nu' },
  { name: 'Elena Rusu', user: 'elena.r', ini: 'E', bg: '#B7A3FF', fg: '#0E1440' }
];
const DAYKEY = { now: 'azi', eve: 'azi', tom: 'mâine', we: 'sâm' };
const CREWS = [
  { id: 'gv', name: 'Gașca de vineri', icon: 'dice', c: 'var(--violet-ink)', rot: '-6deg', members: GV, admin: 'Ioana', outings: 6, invAt: null },
  { id: 'pj', name: 'Padel de joi', icon: 'target', c: 'var(--coral-ink)', rot: '5deg', members: PJ, admin: null, outings: 2, invAt: null }
];
const STAMP_ICONS = ['star', 'dice', 'club', 'target', 'cocktail', 'pizza', 'bolt', 'heart', 'smile', 'mic'];
const STAMP_NAMES = { star: 'Stea', dice: 'Zar', club: 'Note muzicale', target: 'Țintă', cocktail: 'Cocktail', pizza: 'Pizza', bolt: 'Fulger', heart: 'Inimă', smile: 'Zâmbet', mic: 'Microfon' };
const STAMP_COLORS = [
  { id: 'violet', label: 'Violet', sw: '#8C6CFF', ink: 'var(--violet-ink)' },
  { id: 'blue', label: 'Albastru', sw: '#2F5BFF', ink: 'var(--blue-ink)' },
  { id: 'coral', label: 'Coral', sw: '#FF6A4D', ink: 'var(--coral-ink)' },
  { id: 'yellow', label: 'Galben', sw: '#FFD43B', ink: 'var(--yellow-ink)' },
  { id: 'ink', label: 'Cerneală', sw: 'var(--ink)', ink: 'var(--ink)' }
];
const ROTS = ['-6deg', '5deg', '-3deg', '7deg'];
const PHASES = ['morning', 'day', 'dusk', 'night', 'late'];
const PHASE_INFO = {
  morning: { sky: 'morning', clock: '09:10', wx: '12°, răcoare', word: 'astăzi?', flip: ['…o cafea bună?', '…un brunch?', '…o plimbare la lac?', '…padel dimineața?', '…Mogoșoaia?'] },
  day: { sky: 'day', clock: '14:20', wx: '21°, soare', word: 'astăzi?', flip: ['…Mogoșoaia?', '…un escape room?', '…un film?', '…jocuri de societate?', '…o pizza la cuptor?'] },
  dusk: { sky: 'dusk', clock: '19:40', wx: '17°, apus la 19:05', word: 'în seara asta?', flip: ['…poate un bowling?', '…sau karaoke?', '…un film bun?', '…un escape room?', '…o pizza la cuptor?', '…padel cu gașca?'] },
  night: { sky: 'night', clock: '22:30', wx: '13°, senin', word: 'în seara asta?', flip: ['…un club?', '…karaoke?', '…cocktailuri pe terasă?', '…stand-up?', '…un film târziu?'] },
  late: { sky: 'night', clock: '01:15', wx: '10°, senin', word: 'acum?', flip: ['…un club?', '…ceva deschis non-stop?', '…karaoke?', '…o plimbare cu gașca?'] }
};
function phaseOfHour(h) {
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 17) return 'day';
  if (h >= 17 && h < 21) return 'dusk';
  if (h >= 21) return 'night';
  return 'late';
}

class Component extends DCLogic {
  constructor(props) {
    super(props);
    this.timers = [];
    this.qrTimer = null;
    this.clock = null;
    this.qTimer = null;
    this.pid = 0;
    this.cid = 0;
    this.eid = 0;
    this.state = {
      screen: 'home', from: 'home', ...APP.homeDefaults(),
      draft: null, sheet: 'closed', page: 0, plans: [], cur: null, lastSurprise: null,
      celebrate: false, qr: 'closed', seed: 7, theme: null, doodles: true, tick: 0,
      conflict: null, sendOpen: false, toast: '', toastUntil: -1,
      vote: null,
      q: '', settled: false, sent: false, req: 'pending',
      lvPhase: 'ask', lvXp: 1420, lvChoice: '', lvChips: [], lvTags: [], lvReason: '', levelDone: false,
      tut: { on: true, step: 0, bump: 0, replay: false, lv: false }, plus: 'locked', plusDay: 1, plusSaved: 0, plusModal: null, plusBusy: false, bill: null, billDone: true, billXp: 0, vscan: null, crew: null, crewOpen: false, crewDraft: null, crews: CREWS.slice(), nc: null, crewView: null, crewFrom: 'plans', ended: [], delArm: false, tixSheet: null, tixView: null, person: null, personFrom: 'friends', personArm: false, removed: [], claim: null, dropTaken: {}, proposal: null, phaseOverride: null
    };
    const ph = phaseOfHour(new Date().getHours());
    this.state.when = ph === 'dusk' || ph === 'night' ? 'eve' : 'now';
  }
  componentDidMount() {
    this.clock = setInterval(() => this.setState({ tick: this.state.tick + 1 }), 1000);
  }
  componentWillUnmount() {
    this.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
    clearInterval(this.qrTimer);
    clearInterval(this.clock);
    clearTimeout(this.qTimer);
  }
  later(fn, ms) { this.timers.push(setTimeout(fn, ms)); }
  toast(msg) { this.setState({ toast: msg, toastUntil: this.state.tick + 4 }); }
  filtersOf(src) {
    const s = src || this.state;
    return { who: s.who, when: s.when, dur: s.dur, budget: s.budget, vibes: s.vibes, dist: s.dist };
  }
  matches(f) {
    return APP.matches(f);
    const n = WHO[f.who].n;
    const list = PLACES.filter((p) => (
      p.price <= BUDGET[f.budget].max && p.dist <= DIST[f.dist].max && p.dur <= DUR[f.dur].max &&
      p.when.indexOf(f.when) !== -1 && n >= p.min && n <= p.max &&
      (f.vibes.length === 0 || p.vibes.some((v) => f.vibes.indexOf(v) !== -1))
    ));
    const score = (p) => 3 * p.vibes.filter((v) => f.vibes.indexOf(v) !== -1).length - p.dist / 12 - p.price / 150 + (p.verified ? 0.3 : 0);
    return list.sort((a, b) => score(b) - score(a));
  }
  mins(t) { if (t === 'acum') return 19 * 60 + 45; const [h, m] = t.split(':').map(Number); return h * 60 + m; }
  timeShift(t, d) {
    const x = this.mins(t) + d;
    return String(Math.floor(x / 60) % 24).padStart(2, '0') + ':' + String(x % 60).padStart(2, '0');
  }
  place(id) { return APP.byId(id) || PLACES[0]; }
  planWindow(pl) {
    const p = this.place(pl.placeId);
    const start = this.mins(pl.slot);
    return [start, start + Math.round(p.dur * 60)];
  }
  findConflict(placeId, when, slot) {
    const probe = { placeId, when, slot };
    const [a0, a1] = this.planWindow(probe);
    return this.state.plans.find((pl) => {
      if (DAYKEY[pl.when] !== DAYKEY[when] || pl.placeId === placeId) return false;
      const [b0, b1] = this.planWindow(pl);
      return a0 < b1 && b0 < a1;
    });
  }
  createPlan(placeId, opts, force) {
    const o = opts || {};
    const s = this.state;
    const p = this.place(placeId);
    const later = this.mins(p.t) > this.mins('acum');
    const when = o.drop != null ? (later ? 'eve' : 'now') : s.when;
    const slot = o.drop != null ? (later ? p.t : 'acum') : (s.when === 'now' ? 'acum' : p.t);
    let group = null;
    let groupName = '';
    let people = WHO[s.who].n;
    let rsvpAt = null;
    let temp = false;
    let crewId = null;
    if (o.group) {
      group = o.group; groupName = o.groupName || ''; people = 1 + o.group.length; rsvpAt = o.rsvpAt != null ? o.rsvpAt : s.tick;
      temp = !!o.temp; crewId = o.crewId || null;
    } else if (o.party === 'me' || o.solo) {
      people = 1;
    } else if (o.party === 'n') {
      people = o.n || people;
    } else if (s.crew) {
      group = s.crew.members; groupName = s.crew.name; people = 1 + group.length; rsvpAt = s.tick;
      temp = !s.crew.id; crewId = s.crew.id || null;
    }
    const same = s.plans.find((pl) => pl.placeId === placeId && DAYKEY[pl.when] === DAYKEY[when]);
    if (same && !force) {
      if (o.drop != null && same.drop == null) {
        const need = o.party === 'me' ? 1 : same.people;
        if (this.dropLeft(o.drop) < need) {
          this.setState({ claim: null });
          this.toast('Mai sunt doar ' + this.dropLeft(o.drop) + ' locuri la ofertă, voi sunteți ' + need + '.');
          return;
        }
        this.updPlan(same.pid, { drop: o.drop, claimedAt: s.tick, dropFor: need });
        this.takeDrop(o.drop, need);
        if (need === 1 && same.people > 1) this.toast('Oferta e doar pentru tine. Planul gășcii rămâne cum era.');
      }
      this.setState({ screen: 'ticket', cur: same.pid, from: o.from || 'home', qr: 'closed', celebrate: false, claim: null });
      return;
    }
    const clash = force ? null : this.findConflict(placeId, when, slot);
    if (clash) {
      this.setState({ conflict: { placeId, opts: o, withPid: clash.pid }, claim: null });
      return;
    }
    this.pid += 1;
    const pl = {
      pid: this.pid, placeId, when, slot, people, res: 'none', stamp: false,
      drop: o.drop != null ? o.drop : null, claimedAt: s.tick, group, groupName, rsvpAt, temp, crewId
    };
    if (o.drop != null) this.takeDrop(o.drop, people);
    clearInterval(this.qrTimer);
    this.setState((st) => ({ plans: st.plans.concat([pl]), cur: pl.pid, screen: 'ticket', from: o.from || 'home', qr: 'closed', celebrate: false, sheet: 'closed', conflict: null, claim: null }));
    if (group && !o.quiet && rsvpAt >= 0) this.toast(group.length === 1 ? 'I-ai trimis invitația lui ' + group[0].name + '.' : 'Invitațiile au plecat la ' + (groupName || 'prieteni') + '.');
  }
  openClaim(i, from) {
    const taken = this.state.plans.find((q) => q.drop === i);
    if (taken) { this.setState({ screen: 'ticket', cur: taken.pid, from }); return; }
    this.setState({ claim: { i, from } });
  }
  takeDrop(i, n) {
    this.setState((st) => { const t = Object.assign({}, st.dropTaken); t[i] = (t[i] || 0) + n; return { dropTaken: t }; });
  }
  dropLeft(i) {
    const x = DROPS[i];
    return Math.max(0, x.left - Math.floor(this.state.tick / 45) - (this.state.dropTaken[i] || 0));
  }
  removePlan(pid) {
    const old = this.state.plans.find((x) => x.pid === pid);
    this.setState((st) => {
      const t = Object.assign({}, st.dropTaken);
      if (old && old.drop != null) t[old.drop] = Math.max(0, (t[old.drop] || 0) - old.people);
      return { dropTaken: t, plans: st.plans.filter((x) => x.pid !== pid) };
    });
    return old;
  }
  proposeMove() {
    const c = this.state.conflict;
    const old = this.state.plans.find((x) => x.pid === c.withPid);
    const target = this.place(c.placeId);
    const who = old.group.length === 1 ? old.group[0].name : old.groupName;
    this.setState({ conflict: null, proposal: { oldPid: old.pid, placeId: c.placeId, opts: c.opts, at: this.state.tick, who } });
    this.toast('Am întrebat ' + (old.group.length === 1 ? 'pe ' + who : who) + ' dacă vă mutați la ' + target.name + '. Planul vechi rămâne până răspund.');
    this.later(() => {
      const cur = this.state.plans.find((x) => x.pid === old.pid);
      if (!cur) { this.setState({ proposal: null }); return; }
      const yes = cur.group.filter((m) => m.answer === 'da').length;
      const agree = yes + 1 > cur.group.length / 2;
      this.setState({ proposal: null });
      if (!agree) { this.toast(who + ' a zis nu. Rămâneți la ' + this.place(cur.placeId).name + '.'); return; }
      this.removePlan(cur.pid);
      this.createPlan(c.placeId, Object.assign({}, c.opts, { group: cur.group, groupName: cur.groupName, rsvpAt: -100, quiet: true, temp: cur.temp, crewId: cur.crewId }), true);
      this.toast((cur.group.length === 1 ? who + ' a zis da' : who + ' a zis da (' + (yes + 1) + ' din ' + (cur.group.length + 1) + ')') + '. V-ați mutat la ' + target.name + ', iar ' + this.place(cur.placeId).name + ' e anunțat.');
    }, 3200);
  }
  friendsAll() {
    const rm = this.state.removed || [];
    return (this.state.req === 'accepted' ? [TUDOR] : []).concat(FRIEND_BASE).filter((f) => rm.indexOf(f.user) === -1);
  }
  openPerson(user, from) {
    this.setState({ screen: 'person', person: user, personFrom: from || this.state.personFrom || 'friends', personArm: false });
  }
  memberIn(crew, k) {
    return crew.invAt == null || this.state.tick - crew.invAt >= 2 + k * 1.6;
  }
  joinedOf(crew) {
    return crew.members.filter((m, k) => this.memberIn(crew, k));
  }
  autoCrewName(members) {
    const firsts = members.map((m) => m.name);
    if (!firsts.length) return 'Gașca nouă';
    if (firsts.length === 1) return 'În doi cu ' + firsts[0];
    if (firsts.length === 2) return 'Tu, ' + firsts[0] + ' și ' + firsts[1];
    if (firsts.length === 3) return 'Tu, ' + firsts[0] + ', ' + firsts[1] + ' și ' + firsts[2];
    return 'Tu, ' + firsts[0] + ', ' + firsts[1] + ' și încă ' + (firsts.length - 2);
  }
  whoOf(n) { return n === 1 ? '1' : (n === 2 ? '2' : (n <= 4 ? '34' : '5')); }
  asMember(fr) {
    return { ini: fr.ini, name: fr.name.split(' ')[0], user: fr.user, bg: fr.bg, fg: fr.fg, answer: fr.answer || 'da' };
  }
  openNewCrew(opts) {
    const o = opts || {};
    this.setState({ screen: 'newcrew', crewOpen: false, nc: { name: '', icon: o.icon || 'star', c: o.c || 'violet', f: o.f || [], from: o.from || 'friends', endedId: o.endedId || null, hint: o.hint || '' } });
  }
  createCrew() {
    const nc = this.state.nc;
    if (!nc) return;
    const members = this.friendsAll().filter((fr) => nc.f.indexOf(fr.user) !== -1).map((fr) => this.asMember(fr));
    if (members.length < 2) return;
    const name = nc.name.trim() || nc.hint || this.autoCrewName(members);
    const col = STAMP_COLORS.find((c) => c.id === nc.c) || STAMP_COLORS[0];
    this.cid += 1;
    const crew = { id: 'n' + this.cid, name, icon: nc.icon, c: col.ink, rot: ROTS[this.cid % ROTS.length], members, admin: null, outings: nc.endedId ? 1 : 0, invAt: this.state.tick, isNew: true };
    const patch = { nc: null, delArm: false };
    if (nc.from === 'sheet') {
      Object.assign(patch, { crew: { id: crew.id, name, members }, who: this.whoOf(members.length + 1), page: 0, screen: 'home' });
    } else {
      Object.assign(patch, { screen: 'crewview', crewView: crew.id, crewFrom: nc.from === 'friends' ? 'friends' : 'plans' });
    }
    this.setState((st) => Object.assign({ crews: st.crews.concat([crew]), ended: st.ended.filter((e) => e.id !== nc.endedId) }, patch));
    this.toast(nc.from === 'sheet' ? 'Gașca „' + name + '” e gata. Primesc invitație în gașcă, iar planul îl primesc când alegi.' : 'Invitațiile au plecat. Intră în gașcă doar cine acceptă.');
  }
  endPlan(pid) {
    const old = this.state.plans.find((x) => x.pid === pid);
    if (!old) return;
    const pn = this.place(old.placeId).name;
    const came = (old.group || []).filter((m) => m.answer === 'da');
    let entry = null;
    if (old.temp && came.length >= 2) {
      this.eid += 1;
      entry = { id: this.eid, name: old.groupName, members: came, placeName: pn };
    }
    this.setState((st) => ({
      plans: st.plans.filter((x) => x.pid !== pid),
      ended: entry ? st.ended.concat([entry]) : st.ended,
      crews: old.crewId ? st.crews.map((c) => (c.id === old.crewId ? Object.assign({}, c, { outings: c.outings + 1 }) : c)) : st.crews,
      crew: st.crew && !st.crew.id && old.temp ? null : st.crew
    }));
    if (entry) this.toast('Ieșirea la ' + pn + ' s-a terminat. Grupul temporar se șterge, dacă nu-l păstrați.');
    else if (old.temp && old.group) this.toast('Ieșirea la ' + pn + ' s-a terminat. Grupul temporar s-a șters.');
    else if (old.crewId) this.toast('Ieșirea la ' + pn + ' s-a terminat. ' + old.groupName + ' rămâne, cu o ieșire în plus.');
    else this.toast('Ieșirea la ' + pn + ' s-a terminat.');
  }
  // reservations at places that are not partners: call, WhatsApp, their site
  extGo(pid, via) {
    this.updPlan(pid, { res: 'extgo', resVia: via });
    this.later(() => { const x = this.state.plans.find((q) => q.pid === pid); if (x && x.res === 'extgo') this.updPlan(pid, { res: 'extback' }); }, 1400);
  }
  saveNoted(pid) {
    this.updPlan(pid, { res: 'noted', stamp: false });
    this.setState({ celebrate: true });
    this.later(() => { this.updPlan(pid, { stamp: true }); this.setState({ celebrate: false }); }, 1800);
    const x = this.state.plans.find((q) => q.pid === pid);
    if (x && x.group && x.group.length) this.toast('Am notat rezervarea. Gașca o vede pe bilet.');
  }
  // tickets
  goingOf(pl) {
    const t = this.state.tick;
    return (pl.group || []).filter((m, k) => !(pl.rsvpAt != null && t - pl.rsvpAt >= (k + 1) * 1.5 && m.answer === 'nu'));
  }
  needOf(pl) { return pl.group && pl.group.length ? 1 + this.goingOf(pl).length : pl.people; }
  autoSeats(n) {
    for (const r of ['F', 'E', 'G', 'D']) {
      let best = null;
      for (let a = 1; a + n - 1 <= 10; a += 1) {
        const block = [];
        for (let k = 0; k < n; k += 1) block.push(r + (a + k));
        if (block.some((x) => SEAT_TAKEN.indexOf(x) !== -1)) continue;
        const d = Math.abs(a + (n - 1) / 2 - 5.5);
        if (!best || d < best.d) best = { d, block };
      }
      if (best) return best.block;
    }
    return [];
  }
  openTix(mode) {
    const pl = this.curPlan();
    if (!pl) return;
    const p = this.place(pl.placeId);
    const have = pl.tix ? pl.tix.n : 0;
    const n = Math.max(1, Math.min(8, this.needOf(pl) - have));
    this.setState({ tixSheet: { pid: pl.pid, mode, step: 'pick', n, seats: mode === 'buy' && p.entry && p.entry.seats ? this.autoSeats(n) : [], add: have > 0 } });
  }
  setTix(patch) { this.setState({ tixSheet: Object.assign({}, this.state.tixSheet, patch) }); }
  tixBusy(step, ms, then) {
    this.setTix({ step });
    this.later(() => { if (this.state.tixSheet && this.state.tixSheet.step === step) then(); }, ms);
  }
  saveTix(pid, n, seats, src) {
    const pl = this.state.plans.find((q) => q.pid === pid);
    if (!pl) return;
    const old = pl.tix || { n: 0, seats: [], holders: [] };
    const going = this.goingOf(pl).map((m) => m.name).filter((nm) => old.holders.indexOf(nm) === -1);
    const pool = (old.holders.indexOf('Tu') === -1 ? ['Tu'] : []).concat(going);
    const fresh = pool.slice(0, n);
    while (fresh.length < n) fresh.push('Invitat ' + (old.holders.length + fresh.length));
    const tix = { n: old.n + n, seats: old.seats.concat(seats), holders: old.holders.concat(fresh), src };
    this.updPlan(pid, { tix });
    this.setState({ tixSheet: null });
    const others = fresh.filter((h) => h !== 'Tu' && h.indexOf('Invitat') !== 0);
    const joinN = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' și ' + xs[xs.length - 1]);
    this.toast(others.length ? 'Biletele sunt în aplicație. ' + joinN(others) + (others.length === 1 ? ' îl primește pe al lui' : ' le primesc pe ale lor') + ' direct în CeFaci.' : (n > 1 ? 'Biletele sunt salvate în aplicație. Merg și fără internet.' : 'Biletul e salvat în aplicație. Merge și fără internet.'));
  }
  openTixView(i) { this.setState({ tixView: { i: i || 0, st: 'open' } }); }
  closeTixView() {
    if (!this.state.tixView || this.state.tixView.st !== 'open') return;
    this.setState({ tixView: Object.assign({}, this.state.tixView, { st: 'closing' }) });
    this.later(() => this.setState({ tixView: null }), 170);
  }
  seatText(seats) {
    if (!seats.length) return '';
    const sorted = seats.slice().sort((a, b) => (a[0] === b[0] ? Number(a.slice(1)) - Number(b.slice(1)) : (a < b ? -1 : 1)));
    const row = sorted[0][0];
    const nums = sorted.map((x) => Number(x.slice(1)));
    const sameRow = sorted.every((x) => x[0] === row);
    const contiguous = sameRow && nums.every((v, k) => k === 0 || v === nums[k - 1] + 1);
    if (sorted.length === 1) return 'Rândul ' + row + ', locul ' + nums[0];
    if (contiguous) return 'Rândul ' + row + ', locurile ' + nums[0] + '–' + nums[nums.length - 1];
    return 'Locurile ' + sorted.join(', ');
  }
  updPlan(pid, patch) {
    this.setState((st) => ({ plans: st.plans.map((pl) => (pl.pid === pid ? Object.assign({}, pl, patch) : pl)) }));
  }
  curPlan() { return this.state.plans.find((pl) => pl.pid === this.state.cur) || null; }
  surprise() {
    const m = this.matches(this.filtersOf());
    const pool = (m.length ? m : PLACES).filter((p) => p.id !== this.state.lastSurprise);
    const pick = pool[Math.floor(Math.random() * pool.length)];
    this.setState({ lastSurprise: pick.id });
    this.createPlan(pick.id, { from: this.state.screen === 'results' ? 'results' : 'home' });
  }
  openFilters() { this.setState({ sheet: 'open', draft: this.filtersOf() }); }
  closeFilters() {
    if (this.state.sheet !== 'open') return;
    this.setState({ sheet: 'closing' });
    this.later(() => this.setState({ sheet: 'closed', draft: null }), 200);
  }
  applyFilters() {
    this.setState(Object.assign({}, this.state.draft, { page: 0, sheet: 'closing', screen: 'results' }));
    this.later(() => this.setState({ sheet: 'closed', draft: null }), 200);
  }
  setDraft(k, v) { this.setState({ draft: Object.assign({}, this.state.draft, { [k]: v }) }); }
  sendRes() {
    const pid = this.state.cur;
    this.updPlan(pid, { res: 'pending' });
    this.later(() => { this.updPlan(pid, { res: 'confirmed', stamp: false }); this.setState({ celebrate: true }); }, 1800);
    this.later(() => { this.updPlan(pid, { stamp: true }); this.setState({ celebrate: false }); }, 3600);
  }
  openQr() {
    if (this.state.qr !== 'closed') return;
    this.setState({ qr: 'open' });
    clearInterval(this.qrTimer);
    this.qrTimer = setInterval(() => this.setState({ seed: this.state.seed + 1 }), 6000);
  }
  closeQr() {
    if (this.state.qr !== 'open') return;
    clearInterval(this.qrTimer);
    this.setState({ qr: 'closing' });
    this.later(() => this.setState({ qr: 'closed' }), 170);
  }
  makeQr(seed0) {
    let seed = seed0;
    const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
    const finders = [[0, 0], [14, 0], [0, 14]];
    let d = '';
    for (let y = 0; y < 21; y += 1) {
      for (let x = 0; x < 21; x += 1) {
        let on;
        const f = finders.find(([fx, fy]) => x >= fx && x < fx + 7 && y >= fy && y < fy + 7);
        if (f) {
          const dx = x - f[0];
          const dy = y - f[1];
          on = dx === 0 || dx === 6 || dy === 0 || dy === 6 || (dx >= 2 && dx <= 4 && dy >= 2 && dy <= 4);
        } else if (finders.some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7)) {
          on = false;
        } else if (y === 6) {
          on = x % 2 === 0;
        } else if (x === 6) {
          on = y % 2 === 0;
        } else {
          on = rnd() > 0.5;
        }
        if (on) d += 'M' + (x + 2) + ' ' + (y + 2) + 'h1v1h-1z';
      }
    }
    return d;
  }
  fmtDur(h) {
    if (h >= 4) return '4+ h';
    if (h === Math.floor(h)) return h + ' h';
    return Math.floor(h) + ' h 30';
  }
  clockFmt(sec) {
    const x = Math.max(0, sec);
    const h = Math.floor(x / 3600);
    const m = Math.floor((x % 3600) / 60);
    const s = x % 60;
    return (h ? h + ':' + String(m).padStart(2, '0') : String(m)) + ':' + String(s).padStart(2, '0');
  }
  reason(p, f) {
    const fromEngine = APP.reason(p.id);
    if (fromEngine) return fromEngine;
    const hit = p.vibes.filter((v) => f.vibes.indexOf(v) !== -1);
    const parts = [];
    if (hit.length) parts.push(hit.join(' și '));
    parts.push('la ' + p.dist + ' min');
    if (p.price === 0) parts.push('gratuit');
    else if (p.price <= BUDGET[f.budget].max * 0.6) parts.push('ieftin');
    else parts.push('în buget');
    const txt = parts.join(', ');
    return txt.charAt(0).toUpperCase() + txt.slice(1) + '.';
  }
  slice() {
    const q = String(this.state.sq || '').trim();
    const all = q.length > 1 ? APP.search(q) : this.matches(this.filtersOf());
    let page = this.state.page;
    if (page * 3 >= all.length) page = 0;
    return { all, page, items: all.slice(page * 3, page * 3 + 3) };
  }
  startVote() {
    const ids = this.slice().items.map((p) => p.id);
    if (!ids.length) return;
    this.setState({ voteFrom: this.state.screen === 'home' ? 'home' : 'results', screen: 'vote', vote: { opts: ids, i: 0, votes: [], superUsed: false, phase: 'vote', startTick: this.state.tick, waitTick: 0 } });
  }
  castVote(kind) {
    const v = this.state.vote;
    if (!v || v.phase !== 'vote') return;
    if (kind === 'super' && v.superUsed) return;
    const votes = v.votes.concat([kind]);
    const next = Object.assign({}, v, { votes, i: v.i + 1, superUsed: v.superUsed || kind === 'super' });
    if (next.i >= v.opts.length) { next.phase = 'wait'; next.waitTick = this.state.tick; }
    this.setState({ vote: next });
  }
  tallyOf(v) {
    const base = [3, 2, 1];
    return v.opts.map((id, i) => {
      const mine = v.votes[i] === 'da' || v.votes[i] === 'super' ? 1 : 0;
      return { id, yes: Math.min(5, (base[i] || 1) + mine), sup: v.votes[i] === 'super' };
    });
  }
  lvCountTo(target, ms) {
    const start = this.state.lvXp;
    const steps = Math.max(1, Math.round(ms / 40));
    let k = 0;
    const id = setInterval(() => {
      k += 1;
      const eased = 1 - Math.pow(1 - k / steps, 3);
      this.setState({ lvXp: k >= steps ? target : Math.round(start + (target - start) * eased) });
      if (k >= steps) clearInterval(id);
    }, 40);
    this.timers.push(id);
  }
  lvAnswer(choice) {
    if (this.state.lvPhase !== 'ask') return;
    if (choice === 'no') { this.setState({ lvPhase: 'nowent', lvChoice: choice }); return; }
    if (choice === 'meh') { this.setState({ lvPhase: 'meh', lvChoice: choice }); return; }
    this.lvReward(choice);
  }
  lvReward(choice) {
    const chips = [
      { n: '+100', t: 'Ieșire bifată', cls: 'xpchip yel', d: '0ms' },
      { n: '+50', t: 'Loc nou pentru tine', cls: 'xpchip blu second', d: '220ms' }
    ];
    this.setState({ lvPhase: 'xp', lvChoice: choice, lvChips: chips });
    this.later(() => { this.setState({ lvPhase: 'fill' }); this.lvCountTo(1570, 650); }, 1250);
    this.later(() => this.setState({ lvPhase: 'level' }), 2150);
  }
  tutStart(replay, magicOnly) {
    this.setState({ screen: magicOnly ? 'plus' : 'home', sheet: 'closed', tut: { on: true, step: 0, bump: 0, replay: !!replay, magicOnly: !!magicOnly, lv: false } });
    if (magicOnly) this.tutMagic();
  }
  tutSet(patch) { this.setState({ tut: Object.assign({}, this.state.tut, patch) }); }
  tutEnd(to) {
    const t = this.state.tut;
    const first = !t.replay && !t.magicOnly;
    const patch = { tut: Object.assign({}, t, { on: false }) };
    if (to) patch.screen = to;
    if (to === 'results') patch.page = 0;
    this.setState(patch);
    if (!to && first) this.toast(this.state.plus === 'locked' ? 'Ai sărit turul. XP-ul de bun venit ți-a intrat oricum, iar jos, la Plus, te așteaptă un cadou de la Bilu.' : 'Ai sărit turul. Îl revezi oricând din Profil.');
  }
  tutMagic() {
    this.later(() => { if (this.state.plus === 'locked') this.setState({ plus: 'trial', plusDay: 1, plusSaved: 0 }); }, 950);
    this.later(() => {
      const t = this.state.tut;
      if (!t || !t.on) return;
      this.setState({ screen: 'plus', tut: Object.assign({}, t, { step: t.step + 1 }) });
    }, 2900);
  }
  tutVals(heroWord, summary) {
    const t = this.state.tut || { on: false, step: 0, bump: 0 };
    const h1 = heroWord.length > 10 ? 88.3 : 114.1;
    const lines = Math.min(3, Math.max(1, Math.ceil(summary.length / 34)));
    const fh = Math.max(46, lines * 18.2 + 18);
    const who = 210 + h1;
    const crewEnd = who + 18 + 10 + 46 + 10 + 54;
    const cta = crewEnd + 10 + fh + 12;
    const S = (x, y, w, h, r) => [x, y, w, h, r];
    const FULL = S(195, 330, 0, 0, 0);
    const TAB = (i) => S(13 + i * 73.2, 766, 71, 62, 18);
    const replay = !!t.replay;
    const ALL = [
      { spot: FULL, dim: 0.8, mood: 'hi', look: 'c', b: [95, 118, 200], q: [24, 380, 342], text: 'Salutare! Bine ai venit în CeFaci. Sperăm să te scăpăm de plictiseală și să te distrezi cu vârf și îndesat!', hint: 'Apasă oriunde pe ecran' },
      { spot: FULL, dim: 0.8, mood: 'wink', look: 'c', b: [95, 118, 200], q: [24, 380, 342], text: 'Înainte de toate, un mic tur prin aplicație. Durează jumătate de minut, promit.', hint: 'Apasă oriunde' },
      { spot: S(12, 94, 366, 44, 16), mood: 'up', look: 'ul', b: [284, 148, 94], q: [20, 158, 262], text: 'Sus vezi vremea, ora și câte Live Drops sunt acum: reduceri fulger la localuri din jur, care țin doar o oră-două.', hint: 'Apasă oriunde' },
      { spot: S(10, who - 10, 370, crewEnd - who + 20, 22), mood: 'up', look: 'up', b: [284, crewEnd + 18, 94], q: [20, crewEnd + 24, 262], text: 'Aici spui cu cine ieși. Cu gașca, fiecare votează din telefonul lui și câștigă varianta cu cele mai multe voturi.', hint: 'Apasă oriunde' },
      { spot: S(10, cta - 8, 370, 74, 24), mood: 'down', look: 'dr', b: [12, cta - 150, 94], q: [112, cta - 206, 262], text: 'Butonul magic. Apeși și primești 3 variante pe gustul tău, nu 300. Zarul din dreapta e pentru curajoși: Surprinde-mă.', hint: 'Apasă oriunde' },
      { spot: TAB(2), mood: 'down', look: 'dr', b: [12, 612, 94], q: [112, 566, 262], text: 'În Planuri ai tot ce ai stabilit: voturile cu prietenii, rezervările și biletele, gata de scanat la intrare.', hint: 'Apasă oriunde' },
      { id: 'prof', spot: TAB(3), hot: 'profile', hotLabel: 'Deschide Profilul', mood: t.oops ? 'oops' : 'down', look: 'dr', b: [12, 612, 94], q: [112, 580, 262], text: t.oops ? 'Aproape! Profil e al patrulea de jos, unde e lumină.' : 'Acum apasă tu pe Profil. Acolo sunt carnetul, prietenii și gășcile tale.', hint: 'Apasă pe zona luminată' },
      { id: 'xp', spot: FULL, dim: 0.84, final: 'xp', mood: 'yay', look: 'c', b: [132, 58, 126], q: [24, 214, 342], text: replay ? 'Ăsta e carnetul tău: ieșirile reale îți aduc ștampile și XP, iar o poză la notă îți aduce XP de detectiv. Ne vedem pe afară!' : 'Ăsta e carnetul tău: ieșirile reale îți aduc ștampile și XP, iar o poză la notă îți aduce XP de detectiv. Și ca să nu pleci cu mâna goală, poftim experiență de bun venit!', hint: '' },
      { id: 'plus', spot: TAB(4), hot: 'plus', hotLabel: 'Deschide Plus', mood: t.oops ? 'oops' : 'down', look: 'dr', b: [12, 612, 94], q: [112, 566, 262], text: t.oops ? 'Aproape! Iconița încețoșată, ultima din dreapta jos.' : 'Și încă ceva! Iconița încețoșată din dreapta jos ascunde un cadou. Apasă pe ea.', hint: 'Apasă pe zona luminată' },
      { id: 'magic', spot: S(195, 380, 0, 0, 0), dim: 0.12, magic: true, mood: 'magic', look: 'ur', b: [110, 214, 160], q: [70, 452, 250], text: 'Hocus… pocus!', big: true, hint: 'Stai puțin…' },
      { id: 'gift', spot: FULL, dim: 0.84, final: 'gift', mood: 'yay', look: 'c', b: [132, 58, 126], q: [24, 214, 342], text: 'Poftim: 7 zile de CeFaci Plus, cadou de la mine! Când se termină, pagina se încețoșează iar, dar o reactivezi oricând.', hint: '' }
    ];
    const seq = replay ? ALL.slice(0, 8) : (t.magicOnly ? ALL.slice(9) : ALL);
    const k = Math.max(0, Math.min(seq.length - 1, t.step));
    const st = seq[k];
    const pose = biluPose(st.mood, st.look);
    if (st.mood === 'oops' && t.bump % 2 === 0) pose.cls = 'bilu m-oops2';
    const px = (n) => n + 'px';
    const full = st.spot[2] === 0;
    const nick = LEVELS[1];
    const CONF = ['#FFD43B', '#FF6A4D', '#2F5BFF', '#8C6CFF', '#FFFFFF', '#5FD39A'];
    const isXp = st.final === 'xp';
    const isGift = st.final === 'gift';
    return {
      on: !!t.on, isFinal: !!st.final, hot: !!st.hot, hotLabel: st.hotLabel || '', confetti: !!st.final, magic: !!st.magic,
      spotCls: full ? 'tspot' : 'tspot ring',
      sx: px(st.spot[0]), sy: px(st.spot[1]), sw: px(st.spot[2]), sh: px(st.spot[3]), sr: px(st.spot[4]),
      shadow: '0 0 0 2400px rgba(4, 7, 24, ' + (st.dim || 0.68) + ')',
      bl: pose, bx: px(st.b[0]), by: px(st.b[1]), bw: px(st.b[2]),
      qx: px(st.q[0]), qy: px(st.q[1]), qw: px(st.q[2]),
      bubCls: 'tbub ' + ((k + (t.bump || 0)) % 2 ? 'sb' : 'sa'),
      textCls: st.big ? 'ttext big' : 'ttext',
      text: st.text, hint: st.hint,
      dots: seq.map((x, i) => ({ cls: i === k ? 'on' : '' })),
      catchLabel: st.hot ? 'Apasă pe zona luminată' : (st.final || st.magic ? 'Așteaptă' : 'Mai departe'),
      showSkip: !st.final && !st.magic,
      tap: () => {
        const cur = this.state.tut;
        const s0 = seq[Math.min(seq.length - 1, cur.step)];
        if (s0.final || s0.magic) return;
        if (s0.hot) { this.tutSet({ oops: true, bump: (cur.bump || 0) + 1 }); return; }
        this.tutSet({ step: cur.step + 1, oops: false });
      },
      hit: () => {
        const cur = this.state.tut;
        if (st.hot === 'profile') { this.setState({ screen: 'profile', tut: Object.assign({}, cur, { step: cur.step + 1, oops: false }) }); return; }
        this.setState({ screen: 'plus', tut: Object.assign({}, cur, { step: cur.step + 1, oops: false }) });
        this.tutMagic();
      },
      skip: () => this.tutEnd(null),
      cardTop: isGift ? '372px' : '396px', mx: '281px', my: '258px',
      showCard: isXp && !replay && !t.lv, showLevels: isXp && !replay && !!t.lv, showGift: isGift,
      nick, nickTag: LEVEL_TAG[1],
      letters: nick.split('').map((ch, n) => ({ ch, d: (700 + n * 70) + 'ms' })),
      levels: LEVELS.slice(1).map((name, i) => ({ n: String(i + 1), name, tag: LEVEL_TAG[i + 1], xp: LEVEL_XP[i + 1].toLocaleString('ro-RO') + ' XP', op: i === 0 ? '1' : '0.78', bg: i === 0 ? '#FFD43B' : 'rgba(255, 255, 255, 0.12)', fg: i === 0 ? '#0E1440' : '#FFFFFF' })),
      goLabel: isGift ? 'Arată-mi Plus' : (replay ? 'Hai să vedem ce faci diseară!' : 'Mai departe'),
      go: () => {
        if (isGift) { this.tutEnd('plus'); return; }
        if (replay) { this.tutEnd('results'); return; }
        this.tutSet({ step: this.state.tut.step + 1, lv: false });
      },
      altLabel: isGift ? 'Hai să vedem ce faci diseară!' : (replay ? 'Rămân pe profil' : (t.lv ? 'Înapoi la nivelul meu' : 'Vezi toate nivelurile')),
      alt: () => {
        if (isGift) { this.tutEnd('results'); return; }
        if (replay) { this.tutEnd('profile'); return; }
        this.tutSet({ lv: !this.state.tut.lv });
      },
      conf: Array.from({ length: 16 }, (x, i) => ({ x: ((i * 23 + 7) % 96 + 2) + '%', w: (6 + (i % 3) * 3) + 'px', h: (10 + (i % 4) * 3) + 'px', bg: CONF[i % CONF.length], r: i % 3 === 0 ? '99px' : '2px', d: ((i * 0.37) % 2.6).toFixed(2) + 's', t: (2.6 + (i % 5) * 0.35).toFixed(2) + 's' })),
      sparks: Array.from({ length: 14 }, (x, i) => { const a = (i / 14) * Math.PI * 2; const r = 90 + (i % 3) * 45; return { dx: Math.round(Math.cos(a) * r) + 'px', dy: Math.round(Math.sin(a) * r) + 'px', w: (6 + (i % 3) * 3) + 'px', c: CONF[i % 5], d: (0.45 + (i % 4) * 0.06).toFixed(2) + 's' }; })
    };
  }
  plusVals(s) {
    const st = s.plus;
    const unlocked = st === 'trial' || st === 'active';
    const saved = s.plusSaved || 0;
    const day = s.plusDay || 1;
    const left = Math.max(1, 8 - day);
    const tagOf = { trial: ['Probă · ' + left + (left === 1 ? ' zi' : ' zile'), '#FFD43B', '#0E1440'], active: ['Activ', 'var(--blue-soft)', 'var(--blue-ink)'], off: ['Oprit', 'var(--s2)', 'var(--ink2)'], locked: ['Cadou', '#FFD43B', '#0E1440'] }[st] || ['', '', ''];
    const blurred = st === 'locked' || st === 'off';
    const touring = !!(s.tut && s.tut.on);
    const partners = Object.keys(PLUS).map((id) => { const p = PLACES.find((x) => x.id === id); return { name: p.name, note: PLUS[id][1], pct: '−' + PLUS[id][0] + '%', icon: ICONS[p.icon], bg: p.bg, fg: p.fg, cls: unlocked ? 'plus' : 'plusoff' }; });
    return {
      tag: tagOf[0], tagBg: tagOf[1], tagFg: tagOf[2],
      bodyCls: 'scr hs pbody' + (blurred ? ' blur' : ''), hidden: blurred ? 'true' : 'false',
      lockCard: st === 'locked' && !touring, offCard: st === 'off' && !s.plusModal,
      bl: biluPose(st === 'off' ? 'hi' : 'wink', 'c'),
      gift: () => this.tutStart(false, true),
      resume: () => this.setState({ plusModal: 'pay' }),
      offText: saved > 0 ? 'Ai economisit ' + saved + ' de lei cât l-ai avut. Reducerile de 10–20% la partenerii tăi te așteaptă.' : 'Reducerile de 10–20% la partenerii tăi te așteaptă.',
      kicker: st === 'trial' || st === 'locked' ? 'Probă gratuită · ziua ' + (st === 'locked' ? 1 : day) + ' din 7' : (st === 'active' ? 'Plus activ · 20 lei pe lună' : 'Plus e oprit'),
      saved: saved + ' lei', savedSub: st === 'off' ? 'economisiți cât ai avut Plus' : 'economisiți cu Plus până acum',
      isTrial: st === 'trial', daysAria: 'Ziua ' + day + ' din 7 de probă',
      days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({ cls: d <= day ? 'on' : '' })),
      note: st === 'trial' ? 'După probă, 20 lei pe lună. Nu-ți cerem cardul și nu-ți luăm nimic automat: te întreabă Bilu.' : (st === 'active' ? 'Următoarea plată: 29 octombrie. Anulezi oricând, dintr-un tap.' : 'Poți reveni oricând. Reducerile te așteaptă.'),
      hasBtn: st === 'active', btn: st === 'off' ? 'Reia Plus · 20 lei pe lună' : 'Anulează abonamentul', btnCls: st === 'off' ? 'press btnp' : 'press chip',
      btnGo: () => this.setState({ plusModal: st === 'off' ? 'pay' : 'cancel' }),
      hasSaved: saved > 0,
      savedList: saved > 0 ? PLUS_SAVED.map(([id, amt, sub], k) => { const p = PLACES.find((x) => x.id === id); return { name: p.name + ' · −' + PLUS[id][0] + '%', sub, amt: '−' + amt + ' lei', icon: ICONS[p.icon], bg: p.bg, fg: p.fg, bt: k ? '1px solid var(--line)' : '0' }; }) : [],
      perks: PLUS_PERKS.map(([icon, title, sub]) => ({ icon, title, sub })),
      partners, partnerCount: partners.length + ' localuri',
      day5: () => this.setState({ plusDay: 5, plusSaved: 47, plusModal: 'day5' }),
      day7: () => this.setState({ plusDay: 7, plusSaved: 47, plusModal: 'expired', plus: 'off' })
    };
  }
  plusModalVals(s) {
    const m = s.plusModal;
    const saved = s.plusSaved || 0;
    const M = {
      day5: ['wink', 'Mai ai 3 zile de Plus! Până acum ai economisit ' + saved + ' de lei. Mai prinde o reducere până se termină.', 'Mersi, Bilu!', null],
      expired: ['hi', 'Hei, săptămâna de probă a expirat! Ai economisit ' + saved + ' de lei cu Plus. Vrei să continui sau ne oprim aici? Poți reveni oricând!', 'Continui cu Plus · 20 lei pe lună', 'Ne oprim aici'],
      pay: ['wink', 'Super! Plătești 20 de lei pe lună cu cardul salvat sau cu Apple Pay. Anulezi oricând, dintr-un tap, din tab-ul Plus.', 'Plătește 20 de lei', 'Mă mai gândesc'],
      cancel: ['oops', 'Sigur te oprești? Pierzi reducerile de 10–20% la partenerii tăi. Poți reveni oricând, dar mi-ar părea rău.', 'Rămân cu Plus', 'Da, opresc Plus']
    }[m] || ['hi', '', '', null];
    const close = (patch, msg) => { this.setState(Object.assign({ plusModal: null, plusBusy: false }, patch || {})); if (msg) this.toast(msg); };
    return {
      on: !!m, bl: biluPose(M[0], 'c'), text: M[1], goLabel: M[2], altLabel: M[3] || '', hasAlt: !!M[3] && !s.plusBusy,
      busy: !!s.plusBusy, idle: !s.plusBusy,
      go: () => {
        if (m === 'day5') { close(); return; }
        if (m === 'expired') { this.setState({ plusModal: 'pay' }); return; }
        if (m === 'pay') { this.setState({ plusBusy: true }); this.later(() => close({ plus: 'active' }, 'Gata! Plus e activ. Bilu e mândru de tine.'), 1100); return; }
        if (m === 'cancel') { close(); }
      },
      alt: () => {
        if (m === 'expired') { close({ plus: 'off' }, 'Ne oprim aici. Poți reveni oricând din tab-ul Plus.'); return; }
        if (m === 'pay') { close(); return; }
        if (m === 'cancel') { close({ plus: 'off' }, 'Am oprit Plus. Te așteptăm înapoi oricând.'); }
      }
    };
  }
  billVals(s) {
    const b = s.bill;
    const ph = b ? b.phase : null;
    const bpl = b && b.pid ? s.plans.find((q) => q.pid === b.pid) : null;
    const bp = this.place(bpl ? bpl.placeId : 'pista9');
    const bon = BON[bp.id] || BON.pista9;
    const pct = PLUS[bp.id] ? PLUS[bp.id][0] : 0;
    const plusOn = pct > 0 && (bpl ? (s.plus === 'trial' || s.plus === 'active') : (s.plus === 'trial' || s.plus === 'active' || s.plus === 'off'));
    const sub = bon.lines.reduce((a, l) => a + l[1], 0);
    const disc = plusOn ? Math.round(sub * pct) / 100 : 0;
    const lei2 = (v) => v.toFixed(2).replace('.', ',');
    const inAt = bpl && bpl.inAt ? bpl.inAt : '20:04';
    const bonAt = this.timeShift(inAt, 104);
    const fromTicket = !!bpl;
    return {
      billAsk: !s.billDone, billOpen: () => this.setState({ bill: { phase: 'cam', ok: null, pid: null } }),
      isBill: !!b, billClose: () => this.setState({ bill: null }),
      billTitle: 'Bonul fiscal · ' + bp.name,
      billShop: bp.name.toUpperCase(), billCif: 'CIF ' + bon.cif, billStamp: '29.09.2026 ' + bonAt,
      billLines: bon.lines.map((l) => ({ t: l[0], v: lei2(l[1]) })).concat(plusOn ? [{ t: 'Reducere Plus ' + pct + '%', v: '-' + lei2(disc) }] : []),
      billTotal: lei2(sub - disc), billTotalLei: lei2(sub - disc) + ' lei',
      billFrame: ph === 'read' ? '#5FD39A' : '#FFD43B', billReading: ph === 'read', billCam: ph === 'cam',
      billHint: ph === 'read' ? 'Citim bonul…' : (ph === 'cam' ? 'Încadrează bonul fiscal. Citim noi totalul, localul și ora.' : 'Mulțumim!'),
      billShoot: () => { this.setState({ bill: Object.assign({}, this.state.bill, { phase: 'read' }) }); this.later(() => { if (this.state.bill) this.setState({ bill: Object.assign({}, this.state.bill, { phase: 'check' }) }); }, 1300); },
      billSheet: ph === 'check' || ph === 'done', billCheck: ph === 'check', billDoneOpen: ph === 'done',
      billTotalLine: 'Total la ' + bp.name + (plusOn ? ', cu reducerea Plus de ' + pct + '% scăzută.' : '.'),
      billProof: [
        { t: 'Bonul e de la ' + bp.name + ', CIF-ul se potrivește' },
        { t: 'Ora de pe bon: ' + bonAt + '. Ai intrat la ' + inAt }
      ],
      billAskPlus: plusOn, billPlusQ: 'Ți-au aplicat reducerea Plus?',
      billYesLabel: plusOn ? 'Da, −' + pct + '%' : 'Trimite', billNoLabel: plusOn ? 'Nu mi-au aplicat' : 'Refac poza',
      billYes: () => this.setState({ bill: Object.assign({}, this.state.bill, { phase: 'done', ok: true }) }),
      billNo: () => { if (!plusOn) { this.setState({ bill: Object.assign({}, this.state.bill, { phase: 'cam' }) }); return; } this.setState({ bill: Object.assign({}, this.state.bill, { phase: 'done', ok: false }) }); },
      billBl: biluPose('yay', 'c'),
      billDoneText: b && b.ok === false ? 'Am notat. Diferența de ' + lei2(disc) + ' lei o primești ca reducere la următoarea ieșire, iar ' + bp.name + ' o plătește din decontul lui.' : 'Mersi! Bonul se potrivește cu locul și ora în care ai fost acolo, așa că ieșirea e confirmată.',
      billFinishLabel: fromTicket ? 'Înapoi la bilet' : 'Înapoi la profil',
      billFinish: () => {
        if (fromTicket) {
          this.updPlan(bpl.pid, { bonDone: true });
          this.setState({ bill: null, billXp: this.state.billXp + 25 });
          this.toast('+25 XP. Ieșirea la ' + bp.name + ' e confirmată.');
          return;
        }
        this.setState({ bill: null, billDone: true, billXp: this.state.billXp + 25, screen: 'profile' });
        this.toast('+25 XP în carnet.');
      }
    };
  }
  // arrival: the guest scans the one CeFaci code at the venue (bar or entrance), or confirms by location
  checkVals(s, pl, p, isDrop, drop) {
    const v = s.vscan;
    const ph = v ? v.phase : null;
    const pct = PLUS[p.id] && (s.plus === 'trial' || s.plus === 'active') ? PLUS[p.id][0] : 0;
    const perk = pct ? '−' + pct + '% cu Plus e activ' : (isDrop && drop ? drop.offer : '');
    const inAt = pl.slot && pl.slot !== 'acum' ? this.timeShift(pl.slot, 4) : '19:49';
    const scanIc = 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10';
    const bonIc = 'M5 2v20l2-1.5L9 22l2-1.5L13 22l2-1.5L17 22l2-1.5V2l-2 1.5L15 2l-2 1.5L11 2 9 3.5 7 2 5 3.5ZM9 8h6M9 12h6M9 16h4';
    const okIc = 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM8.5 12l2.5 2.5 4.5-5';
    const stage = pl.bonDone ? 'done' : (pl.inAt ? 'in' : 'pre');
    const go = () => {
      const pid = pl.pid;
      this.setState({ vscan: { phase: 'cam', pid, how: 'qr' } });
      this.later(() => { const x = this.state.vscan; if (x && x.pid === pid && x.phase === 'cam') this.setState({ vscan: Object.assign({}, x, { phase: 'read' }) }); }, 1500);
      this.later(() => { const x = this.state.vscan; if (x && x.pid === pid && x.phase === 'read') this.setState({ vscan: Object.assign({}, x, { phase: 'ok' }) }); }, 2400);
    };
    return {
      ciShow: !!p.partner,
      ciBg: stage === 'pre' ? 'var(--yellow-soft)' : 'var(--blue-soft)',
      ciIcon: stage === 'pre' ? scanIc : (stage === 'in' ? bonIc : okIc),
      ciIconC: stage === 'pre' ? 'var(--yellow-ink)' : 'var(--blue-ink)',
      ciTitle: stage === 'pre' ? 'Ai ajuns la ' + p.name + '?' : (stage === 'in' ? 'Ești la ' + p.name + ' din ' + pl.inAt : 'Ieșire confirmată cu bonul'),
      ciSub: stage === 'pre' ? 'Scanează codul CeFaci de la bar sau de la intrare.' : (stage === 'in' ? (perk ? perk + '. La plecare, pune bonul: +25 XP.' : 'La plecare, pune poza bonului fiscal: +25 XP.') : '+25 XP în carnet. Mersi că ții CeFaci corect.'),
      ciHasBtn: stage !== 'done', ciBtn: stage === 'pre' ? 'Scanează' : 'Pune bonul',
      ciGo: stage === 'pre' ? go : () => this.setState({ bill: { phase: 'cam', ok: null, pid: pl.pid } }),
      vsShown: !!v, vsCam: ph === 'cam', vsReading: ph === 'read', vsOk: ph === 'ok',
      vsName: p.name, vsQr: this.makeQr(97 + p.id.length * 13),
      vsFrame: ph === 'read' ? '#5FD39A' : '#FFD43B',
      vsHint: ph === 'read' ? 'Am găsit codul. Verificăm și locația…' : 'Îndreaptă camera spre codul CeFaci de la bar sau de la intrare.',
      vsClose: () => this.setState({ vscan: null }),
      vsLoc: () => this.setState({ vscan: Object.assign({}, v, { phase: 'ok', how: 'loc' }) }),
      vsBl: biluPose('yay', 'c'),
      vsTitle: 'Bun venit la ' + p.name + '!',
      vsHasPerk: !!perk, vsPerk: perk,
      vsText: (v && v.how === 'loc' ? 'Te-am găsit după locație, la ' + inAt + '.' : 'Ai intrat la ' + inAt + '.') + (perk ? ' Arată ecranul ospătarului pentru reducere.' : '') + ' La plecare, pune poza bonului fiscal și primești 25 XP.',
      vsDone: () => { if (v) this.updPlan(v.pid, { inAt }); this.setState({ vscan: null }); }
    };
  }
  renderVals() {
    const s = this.state;
    const f = this.filtersOf();
    const d = s.draft || f;
    const themeKey = s.theme || this.props.theme || 'zi';
    const themeClass = ({ zi: 'light day', noapte: 'graphite', luminos: 'light day', 'hârtie': 'light day', grafit: 'graphite' })[themeKey] || 'light day';
    const sl = this.slice();
    const all = sl.all;
    const page = sl.page;
    const items = sl.items;
    const nearest = items.length ? items.reduce((a, b) => (b.dist < a.dist ? b : a)) : null;
    let usedNew = false;
    let usedNear = false;
    const roleOf = (p, i) => {
      if (i === 0 && page === 0) return ['Pariu sigur', 'var(--blue-soft)', 'var(--blue-ink)'];
      if (p.fresh && !usedNew) { usedNew = true; return ['Ceva nou pentru voi', 'var(--violet-soft)', 'var(--violet-ink)']; }
      if (p === nearest && !usedNear) { usedNear = true; return ['Cel mai la îndemână', 'var(--yellow-soft)', 'var(--yellow-ink)']; }
      return ['Tot pe gustul vostru', 'var(--s2)', 'var(--ink)'];
    };
    const cards = items.map((p, i) => {
      const r = roleOf(p, i);
      return {
        title: p.title, name: p.name, icon: ICONS[p.icon], bg: p.bg, fg: p.fg, dot: p.dot,
        role: r[0], roleBg: r[1], roleInk: r[2],
        resReq: p.res === 'required', ticket: !!p.entry, age: !!p.age, verified: !!p.verified, partner: !!p.partner,
        price: p.price === 0 ? 'Gratuit' : '~' + p.price + ' lei', dur: this.fmtDur(p.dur), dist: p.dist + ' min',
        hasPlus: !!PLUS[p.id] && s.plus !== 'locked', plusTag: PLUS[p.id] ? (s.plus === 'trial' || s.plus === 'active' ? '−' + PLUS[p.id][0] + '% cu Plus' : 'Plus −' + PLUS[p.id][0] + '%') : '', plusCls: s.plus === 'trial' || s.plus === 'active' ? 'tag plus' : 'tag plusoff',
        reason: this.reason(p, f), delay: (i * 70) + 'ms', pick: () => this.createPlan(p.id, { from: 'results' })
      };
    });
    const words = ['nimic', 'una', 'două', 'trei'];
    const remaining = all.length - (page * 3 + items.length);
    const vibeText = f.vibes.length ? f.vibes.join(', ') : 'orice vibe';
    const summary = DUR[f.dur].text + ', ' + BUDGET[f.budget].text + ', ' + vibeText + ', max. ' + DIST[f.dist].max + ' min';
    const draftCount = this.matches(d).length;
    const opt = (key, list, order) => order.map((k) => ({ label: list[k].label, on: d[key] === k, cls: d[key] === k ? 'chip on' : 'chip', pick: () => this.setDraft(key, k) }));
    const rows = [
      { id: 'f-who', label: 'Cine vine?', flex: '1 1 0', opts: opt('who', WHO, ['1', '2', '34', '5']) },
      { id: 'f-when', label: 'Când?', flex: '1 1 0', opts: opt('when', WHEN, ['now', 'eve', 'tom', 'we']) },
      { id: 'f-dur', label: 'Cât timp aveți?', flex: '1 1 0', opts: opt('dur', DUR, ['1', '23', '4']) },
      { id: 'f-dist', label: 'Cât de departe?', flex: '1 1 0', opts: opt('dist', DIST, ['10', '20', '30']) },
      { id: 'f-budget', label: 'Buget de persoană, în lei', flex: '0 0 auto', opts: opt('budget', BUDGET, ['0', '50', '100', '200', 'any']) }
    ];

    // plans
    const plans = s.plans.slice().sort((a, b) => (DAYKEY[a.when] === DAYKEY[b.when] ? this.mins(a.slot) - this.mins(b.slot) : (a.when === 'we' ? 1 : -1)));
    const pl = this.curPlan() || { pid: 0, placeId: 'pista9', when: s.when, slot: '20:00', people: 4, res: 'none', stamp: false, drop: null, claimedAt: 0, group: null, groupName: '', rsvpAt: null };
    const p = this.place(pl.placeId);
    const isDrop = pl.drop != null;
    const needsRes = p.res !== 'none' && !isDrop;
    const confirmed = pl.res === 'confirmed';
    const slotBase = p.t;
    const slots = [[this.timeShift(slotBase, -30), false], [slotBase, false], [this.timeShift(slotBase, 30), false], [this.timeShift(slotBase, 60), true]];
    const dots = { none: '#D93A1C', sheet: '#D93A1C', pending: '#8A6A00', confirmed: '#2F5BFF' };
    const resTexts = { none: 'Încă nefăcută', sheet: 'Încă nefăcută', pending: 'În așteptare', confirmed: 'Confirmată' };
    const members = pl.group || [];
    const rsvp = members.map((m, k) => {
      const answered = pl.rsvpAt != null && s.tick - pl.rsvpAt >= (k + 1) * 1.5;
      const st = answered ? m.answer : 'wait';
      return Object.assign({}, m, { st, ml: k ? '-8px' : '0', op: st === 'wait' ? '0.55' : '1', dot: st === 'da' ? '#2F5BFF' : (st === 'nu' ? '#FF6A4D' : '#C9CEDC') });
    });
    const yes = rsvp.filter((m) => m.st === 'da');
    const no = rsvp.filter((m) => m.st === 'nu');
    const wait = rsvp.filter((m) => m.st === 'wait');
    const joinNames = (xs) => (xs.length <= 1 ? xs.map((x) => x.name).join('') : xs.slice(0, -1).map((x) => x.name).join(', ') + ' și ' + xs[xs.length - 1].name);
    const rsvpBits = [];
    if (yes.length) rsvpBits.push(joinNames(yes) + (yes.length === 1 ? ' vine' : ' vin'));
    if (no.length) rsvpBits.push(joinNames(no) + ' nu poate');
    if (wait.length) rsvpBits.push(wait.length === 1 ? 'mai așteptăm un răspuns' : 'mai așteptăm ' + wait.length + ' răspunsuri');
    const people = members.length ? 1 + yes.length : pl.people;
    const dayWord = { now: 'azi', eve: 'azi', tom: 'mâine', we: 'sâm.' };
    const drop = isDrop ? DROPS[pl.drop] : null;
    const joinStr = (xs) => (xs.length <= 1 ? xs.join('') : xs.slice(0, -1).join(', ') + ' și ' + xs[xs.length - 1]);
    const dayLong = { now: 'azi', eve: 'azi', tom: 'mâine', we: 'sâmbătă' }[pl.when];
    const atSlot = pl.slot === 'acum' ? 'acum' : dayLong + ' la ' + pl.slot;
    // reservation outside CeFaci
    const noted = pl.res === 'noted';
    const isExt = ['ext', 'extgo', 'extback', 'extform', 'extfull'].indexOf(pl.res) !== -1;
    const book = p.partner ? 'app' : 'contact';
    const via = pl.resVia || 'telefon';
    const ct = p.contact || { phone: '', unit: 'o masă' };
    const resText = noted ? 'Prin ' + via : (resTexts[pl.res] || 'Încă nefăcută');
    const resDotC = noted ? '#2F5BFF' : (dots[pl.res] || '#D93A1C');
    const extOpts = [];
    if (ct.phone) extOpts.push({ label: 'Sună', sub: ct.phone, icon: 'M13.832 16.568a1 1 0 0 0 1.213-.303l.355-.465A2 2 0 0 1 17 15h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v3a2 2 0 0 1-.8 1.6l-.468.351a1 1 0 0 0-.292 1.233 14 14 0 0 0 6.392 6.384', bg: 'var(--blue)', fg: '#FFFFFF', via: 'telefon' });
    if (ct.wa) extOpts.push({ label: 'Scrie pe WhatsApp', sub: 'Mesajul e deja scris', icon: 'M7.9 20A9 9 0 1 0 4 16.1L2 22Z', bg: '#25A35A', fg: '#FFFFFF', via: 'WhatsApp' });
    if (ct.web) extOpts.push({ label: 'Rezervă pe site-ul lor', sub: p.name + ' are rezervări online', icon: 'M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20M2 12h20M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20', bg: 'var(--violet)', fg: '#0E1440', via: 'site' });
    // tickets
    const tixPlace = !!p.entry && !isDrop;
    const tix = pl.tix || null;
    const need = this.needOf(pl);
    const ts = s.tixSheet && s.tixSheet.pid === pl.pid ? s.tixSheet : null;
    const tv = s.tixView && tix ? s.tixView : null;
    const tvI = tv ? Math.min(tv.i, tix.n - 1) : 0;
    const goingNames = this.goingOf(pl).map((m) => m.name);
    const missing = tix ? goingNames.filter((nm) => tix.holders.indexOf(nm) === -1) : goingNames;
    const missingCount = tix ? Math.max(0, need - tix.n) : need;
    const tixExtra = tix ? tix.holders.filter((h) => h.indexOf('Invitat') === 0).length : 0;
    const en = p.entry || { kind: 'app', price: 0 };
    const tsNames = ts ? ((tix && tix.holders.indexOf('Tu') !== -1 ? [] : ['tine']).concat(missing)) : [];
    const holdLeft = isDrop ? 45 * 60 - (s.tick - pl.claimedAt) : 0;
    const planLabel = (x) => {
      const px = this.place(x.placeId);
      const bits = [px.name];
      if (x.drop != null) bits.push('ofertă luată');
      else if (px.entry) bits.push(x.tix ? (x.tix.n === 1 ? 'ai bilet' : x.tix.n + ' bilete') : 'fără bilete încă');
      else if (px.res !== 'none') bits.push(x.res === 'confirmed' ? 'rezervat' : (x.res === 'noted' ? 'rezervat prin ' + (x.resVia || 'telefon') : 'fără rezervare încă'));
      if (x.groupName) bits.push(x.groupName);
      return bits.join(', ');
    };
    const next = plans[0] || null;

    // vote
    const v = s.vote;
    const voteOpt = v && v.phase === 'vote' ? this.place(v.opts[v.i]) : this.place((v && v.opts[0]) || 'pista9');
    const waitEl = v && v.phase !== 'vote' ? s.tick - v.waitTick : 0;
    const voteResult = v && v.phase !== 'vote' && waitEl >= 3;
    const voters = [
      { ini: 'CA', name: 'Tu', bg: '#2F5BFF', fg: '#FFFFFF', done: !!v && v.phase !== 'vote' },
      { ini: 'I', name: 'Ioana', bg: '#8C6CFF', fg: '#0E1440', done: true },
      { ini: 'M', name: 'Mihai', bg: '#FF6A4D', fg: '#0E1440', done: true },
      { ini: 'S', name: 'Sara', bg: '#FFD43B', fg: '#0E1440', done: !!v && v.phase !== 'vote' && waitEl >= 1 },
      { ini: 'R', name: 'Radu', bg: '#3A4585', fg: '#F3F5FF', done: !!v && v.phase !== 'vote' && waitEl >= 2 }
    ].map((m) => Object.assign(m, { op: m.done ? '1' : '0.5' }));
    const tally = v ? this.tallyOf(v) : [];
    const win = tally.length ? tally.reduce((a, b) => (b.yes > a.yes ? b : a)) : null;
    const voteSecs = 12 * 60 - (v ? s.tick - v.startTick : 0);

    // friends
    const friendList = this.friendsAll().map((x) => Object.assign({}, x, { isNew: x.user === 'tudor.m', cls: x.user === 'tudor.m' ? 'newrow' : '', open: () => this.openPerson(x.user, 'friends') }));
    // friend profile
    const friendsNow = this.friendsAll();
    const prU = s.person;
    const prFriend = prU ? friendsNow.find((f) => f.user === prU) : null;
    const prBase = prFriend || (prU === 'tudor.m' ? TUDOR : (prU === 'maria.i' ? MARIA : null));
    const prData = prU ? PROFILES[prU] : null;
    const prFirst = prBase ? prBase.name.split(' ')[0] : '';
    const myPlaces = VISITED.map((x) => x[0]).concat(s.levelDone ? ['Pista 9'] : []);
    const prMutualList = prData ? prData.mutual.map((u) => friendsNow.find((f) => f.user === u)).filter(Boolean) : [];
    const prStampList = prData && prFriend ? prData.stamps.filter((id) => APP.byId(id)).map((id, k) => {
      const px = this.place(id);
      const shared = myPlaces.indexOf(px.name) !== -1;
      return { label: px.name, icon: ICONS[px.icon], c: INKS[k % INKS.length], rot: ROTS[k % ROTS.length], shared, delay: (k * 40) + 'ms', aria: px.name + (shared ? ', ai fost și tu' : '') };
    }) : [];
    const prSharedN = prStampList.filter((x) => x.shared).length;
    const prCrewList = prU ? s.crews.filter((c) => c.members.some((m) => m.user === prU)) : [];
    const qn = String(s.q || '').trim().replace(/^@+/, '').toLowerCase();

    // level
    const inFb = s.screen === 'feedback';
    const leveled = s.lvPhase === 'after';
    const cap = inFb ? (leveled ? 2500 : 1500) : (s.levelDone ? 2500 : 1500);
    const xpNow = inFb ? s.lvXp : (s.levelDone ? 1570 : 1420) + (s.billXp || 0);
    const full = inFb && (s.lvPhase === 'fill' || s.lvPhase === 'level');
    const pct = full ? 100 : Math.min(100, (xpNow / cap) * 100);
    const lvLocked = s.lvPhase !== 'ask';
    const rewarding = s.lvPhase === 'xp' || s.lvPhase === 'fill' || s.lvPhase === 'level';
    const meh = s.lvChoice === 'meh';
    const fbCls = (key) => 'fb' + (s.lvChoice === key ? ' on' : '') + (lvLocked ? ' lock' : '');
    const colors = ['#FFD43B', '#8EA6FF', '#FF6A4D', '#B7A3FF', '#FFFFFF', '#2F5BFF'];
    const shapes = [['8px', '14px', '2px'], ['9px', '9px', '99px'], ['13px', '6px', '2px'], ['6px', '11px', '2px']];
    const confetti = [];
    for (let k = 0; k < 36; k += 1) {
      const sh = shapes[k % shapes.length];
      confetti.push({ cls: 'cfp c' + ((k % 12) + 1), w: sh[0], h: sh[1], r: sh[2], c: colors[(k * 7) % colors.length], d: (460 + (k % 3) * 60 + Math.floor(k / 12) * 90) + 'ms' });
    }
    const reasonList = [
      { id: 'plans', label: 'S-au schimbat planurile', text: 'Am notat. Nu contează la nivel, dar nici nu pierzi nimic.' },
      { id: 'closed', label: 'Era închis', text: 'Mulțumim. Verificăm programul, ca să nu mai trimitem pe nimeni degeaba.' },
      { id: 'full', label: 'Era plin', text: 'Mulțumim. Data viitoare îți arătăm din timp dacă trebuie rezervare.' }
    ];
    const chosen = reasonList.find((r) => r.id === s.lvReason);
    const visited = VISITED.concat(s.levelDone ? [['Pista 9', 'bowl', 'var(--blue-ink)', '-6deg']] : []);
    const nowSec = s.tick;

    const realPhase = phaseOfHour(new Date().getHours());
    const phase = s.phaseOverride || realPhase;
    const now = new Date();
    const clockText = s.phaseOverride ? PHASE_INFO[phase].clock : String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    const heroWord = f.when === 'now' ? PHASE_INFO[phase].word : ({ eve: 'în seara asta?', tom: 'mâine?', we: 'în weekend?' })[f.when];
    const cOld = s.conflict ? s.plans.find((x) => x.pid === s.conflict.withPid) : null;
    const cOthers = !!(cOld && cOld.group && cOld.group.length);
    const cMoveBlocked = !!(cOld && cOthers && s.conflict.opts.drop != null && this.dropLeft(s.conflict.opts.drop) < cOld.people);
    const allCrews = s.crews;
    const cd = s.crewDraft || { g: null, f: [], save: false };
    const cdCrew = cd.g ? allCrews.find((c) => c.id === cd.g) : null;
    const cdCount = cdCrew ? this.joinedOf(cdCrew).length + 1 : cd.f.length + 1;
    const outingsText = (n) => (n === 0 ? 'nicio ieșire încă' : (n === 1 ? 'o ieșire împreună' : n + ' ieșiri împreună'));
    const avs = (list, size) => list.slice(0, 4).map((m, k) => ({ ini: m.ini, bg: m.bg, fg: m.fg, ml: k ? '-' + Math.round(size * 0.27) + 'px' : '0' }));

    // new crew form
    const nc = s.nc;
    const ncCol = nc ? (STAMP_COLORS.find((c) => c.id === nc.c) || STAMP_COLORS[0]) : STAMP_COLORS[0];
    const ncPicked = nc ? this.friendsAll().filter((fr) => nc.f.indexOf(fr.user) !== -1).map((fr) => this.asMember(fr)) : [];
    const ncSet = (patch) => this.setState({ nc: Object.assign({}, this.state.nc, patch) });

    // crew detail
    const cv = s.crews.find((c) => c.id === s.crewView) || null;
    const cvJoined = cv ? this.joinedOf(cv) : [];
    const cvPending = cv ? cv.members.filter((m, k) => !this.memberIn(cv, k)) : [];
    const cvAdminMe = !!cv && cv.admin == null;
    const cl = s.claim ? DROPS[s.claim.i] : null;
    const clLeft = s.claim ? this.dropLeft(s.claim.i) : 0;
    const crewN = s.crew ? s.crew.members.length + 1 : WHO[s.who].n;
    const zq = String(s.sq || '');
    return {
      todayText: APP.todayText(), placesText: APP.count.toLocaleString('ro-RO') + ' de locuri reale',
      askFeedbackReal: false, meName: APP.prefs.name || 'Tu', meUser: APP.prefs.user || 'tu',
      appZone: APP.zoneName(), zoneAria: 'Zona ta: ' + APP.zoneName() + '. Schimbă zona', openZone: () => this.setState({ zoneOpen: true }),
      zoneOpen: !!s.zoneOpen, zoneClose: () => this.setState({ zoneOpen: false }),
      zoneGroups: ['București', 'Ilfov'].map((area) => ({ area, zones: APP.zones().filter((z) => z.area === area).map((z) => ({ name: z.name, on: z.id === APP.prefs.zone, cls: z.id === APP.prefs.zone ? 'press chip on' : 'press chip', pick: () => { APP.savePrefs({ zone: z.id }); this.setState({ zoneOpen: false, page: 0 }); this.toast('Pleci din ' + z.name + '. Am refăcut recomandările.'); } })) })),
      sq: zq, sqOn: zq.length > 0, sqHints: zq.trim().length < 2,
      onSq: (e) => this.setState({ sq: e && e.target ? String(e.target.value).slice(0, 60) : '', page: 0 }),
      sqClear: () => this.setState({ sq: '', page: 0 }),
      sqExamples: ['pizza sector 2', 'bar cu terasă', 'escape room', 'cafenea deschisă acum', 'muzeu', 'club'].map((label) => ({ label, pick: () => this.setState({ sq: label, page: 0 }) })),
      tut: this.tutVals(heroWord, summary), tutReplay: () => this.tutStart(true), bluIdle: biluPose('wink', 'c'),
      ...this.billVals(s), isPlus: s.screen === 'plus', pl: this.plusVals(s), pm: this.plusModalVals(s),
      plusTabCls: 'tab plus' + (s.plus === 'locked' || s.plus === 'off' ? ' veil' : '') + (s.screen === 'plus' ? ' on' : ''),
      plusTabLabel: s.plus === 'locked' ? 'Plus: un cadou de la Bilu' : (s.plus === 'off' ? 'CeFaci Plus, oprit' : 'CeFaci Plus'),
      plusTab: () => this.setState({ screen: 'plus' }),
      themeClass,
      showDoodles: s.doodles,
      isHome: s.screen === 'home', isResults: s.screen === 'results', isTicket: s.screen === 'ticket',
      isPlans: s.screen === 'plans', isProfile: s.screen === 'profile', isVote: s.screen === 'vote',
      isFriends: s.screen === 'friends', isDrops: s.screen === 'drops', isFeedback: inFb,
      isNewCrew: s.screen === 'newcrew' && !!nc, isCrewView: s.screen === 'crewview' && !!cv,
      showTabs: ['home', 'plans', 'profile', 'plus'].indexOf(s.screen) !== -1,
      tabHome: s.screen === 'home' ? 'tab on' : 'tab', tabPlans: s.screen === 'plans' ? 'tab on' : 'tab', tabProfile: s.screen === 'profile' ? 'tab on' : 'tab',
      goHome: () => this.setState({ screen: 'home' }), goPlans: () => this.setState({ screen: 'plans' }), goProfile: () => this.setState({ screen: 'profile' }),
      goDrops: () => this.setState({ screen: 'drops' }), goFriends: () => this.setState({ screen: 'friends', fromFriends: s.screen }),
      friendsBack: () => this.setState({ screen: s.fromFriends === 'plans' ? 'plans' : 'profile' }),
      showResults: () => this.setState({ screen: 'results', page: 0 }),
      surprise: () => this.surprise(),
      whenWord: heroWord,
      h1Size: heroWord.length > 10 ? '48px' : '62px',
      whoOpts: ['1', '2', '34', '5'].map((k) => ({ label: WHO[k].label, on: s.who === k, cls: s.who === k ? 'chip on' : 'chip', skyCls: s.who === k ? 'press skychip on' : 'press skychip', pick: () => this.setState({ who: k, crew: null }) })),
      skyCls: PHASE_INFO[phase].sky,
      wxIcon: phase === 'morning' || phase === 'day' ? 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' : 'M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z',
      wxText: PHASE_INFO[phase].wx,
      dayText: clockText,
      cyclePhase: () => { const cur = this.state.phaseOverride || realPhase; const nx = PHASES[(PHASES.indexOf(cur) + 1) % PHASES.length]; this.setState({ phaseOverride: nx === realPhase ? null : nx, when: nx === 'dusk' || nx === 'night' ? 'eve' : 'now', page: 0 }); },
      whenPlain: f.when === 'now' ? (phase === 'dusk' || phase === 'night' ? 'în seara asta' : (phase === 'late' ? 'acum' : 'azi')) : ({ eve: 'în seara asta', tom: 'mâine', we: 'în weekend' })[f.when],
      liveCount: DROPS.length,
      flipWords: (() => {
        const W = PHASE_INFO[phase].flip;
        const idx = Math.floor(s.tick / 2.5) % W.length;
        const prev = (idx + W.length - 1) % W.length;
        return W.map((text, k) => ({ text, cls: k === idx ? 'fw on' : (k === prev ? 'fw prev' : 'fw'), hidden: k !== idx }));
      })(),
      crewSet: !!s.crew, crewUnset: !s.crew && s.who !== '1', showCrewRow: s.who !== '1' || !!s.crew,
      crewLabel: s.crew ? s.crew.name : 'Alege cu cine ieși',
      crewSub: s.crew ? (s.crew.temp ? (s.crew.members.length === 1 ? 'în doi, primește invitație când alegi planul' : 'grup temporar, doar pentru planul ăsta') : s.crew.members.length === 1 ? 'primește invitație când alegi planul' : (s.crew.members.length + 1) + ' cu tine, primesc invitație când alegi planul') : 'o gașcă sau prieteni, primesc invitație',
      crewAvatars: (s.crew ? s.crew.members : []).slice(0, 4).map((m, k) => ({ ini: m.ini, bg: m.bg, fg: m.fg, ml: k ? '-9px' : '0' })),
      openCrew: () => this.setState({ crewOpen: true, crewDraft: { g: s.crew && s.crew.id ? s.crew.id : null, f: s.crew && !s.crew.id ? s.crew.members.map((m) => m.user) : [], save: false } }),
      moods: [
        ['Competitiv', 'target', '#2F5BFF', '#FFFFFF', '#5C80FF'],
        ['Party', 'club', '#0E1440', '#FFD43B', '#2B3575'],
        ['Chill', 'coffee', '#B7A3FF', '#0E1440', '#CFC2FF'],
        ['Mâncare bună', 'burger', '#FF6A4D', '#0E1440', '#FF8A73'],
        ['Aer liber', 'waves', '#FFD43B', '#0E1440', '#FFE58A'],
        ['Fun', 'dice', '#8EA6FF', '#0E1440', '#B7C6FF'],
        ['Cultură', 'landmark', '#FFE58A', '#0E1440', '#FFD43B']
      ].map(([label, icon, bg, fg, dot]) => {
        const n = this.matches(Object.assign({}, f, { vibes: [label] })).length;
        return { label, icon: ICONS[icon], bg, fg, dot, count: n === 1 ? '1 loc' : n + ' locuri', pick: () => this.setState({ vibes: [label], page: 0, screen: 'results' }) };
      }),
      trending: [['pista9', '41 de ieșiri'], ['notafalsa', '33 de ieșiri'], ['neon', '29 de ieșiri']].map(([id, txt], i) => {
        const px = this.place(id);
        return { rank: i + 1, title: px.title, sub: px.name + ', ' + txt, bg: px.bg, fg: px.fg, icon: ICONS[px.icon], pick: () => this.createPlan(id, { from: 'home' }) };
      }),
      voteFromHome: () => { this.setState({ page: 0 }); this.startVote(); },
      summary,
      ctaHome: all.length ? 'Arată variante (' + all.length + ')' : 'Arată variante',
      hasNext: !!next, nextTime: next ? (next.slot === 'acum' ? 'acum' : next.slot) : '',
      nextText: next ? (dayWord[next.when] === 'azi' ? 'Azi: ' : (dayWord[next.when] === 'mâine' ? 'Mâine: ' : 'Sâmbătă: ')) + this.place(next.placeId).title + (plans.length > 1 ? ' și încă ' + (plans.length - 1) : '') : '',
      openNext: () => next && this.setState({ screen: 'ticket', cur: next.pid, from: 'home' }),
      dropCount: DROPS.length,
      drops: DROPS.slice(0, 5).map((x, i) => {
        const px = this.place(x.placeId);
        return { name: px.name, bg: px.bg, fg: px.fg, icon: ICONS[px.icon], offer: x.offer, left: this.clockFmt(x.mins * 60 - nowSec), stock: 'rămân ' + this.dropLeft(i), pick: () => this.openClaim(i, 'home') };
      }),
      dropsAll: DROPS.map((x, i) => {
        const px = this.place(x.placeId);
        const left = this.dropLeft(i);
        const taken = s.plans.some((q) => q.drop === i);
        return {
          name: px.name, dist: px.dist, bg: px.bg, fg: px.fg, icon: ICONS[px.icon], offer: x.offer, delay: (i * 50) + 'ms',
          left: this.clockFmt(x.mins * 60 - nowSec), stock: 'rămân ' + left + ' din ' + x.stock, pct: Math.round((1 - left / x.stock) * 100) + '%',
          btn: taken ? 'Vezi biletul' : 'Ia oferta', btnCls: 'press', btnBg: taken ? 'var(--s2)' : 'var(--blue)', btnFg: taken ? 'var(--ink)' : '#FFFFFF',
          pick: () => (taken ? this.createPlan(x.placeId, { drop: i, from: 'drops' }) : this.openClaim(i, 'drops'))
        };
      }),
      openFilters: () => this.openFilters(),
      tokens: WHO[f.who].label + ', ' + WHEN[f.when].label.toLowerCase() + ', ' + summary,
      resTitle: String(s.sq || '').trim().length > 1 ? (all.length ? 'Uite ce am găsit.' : 'N-am găsit nimic.') : items.length ? 'Am găsit ' + words[Math.min(3, items.length)] + '.' : 'N-am găsit nimic.',
      resSub: (String(s.sq || '').trim().length > 1 ? (all.length ? all.length + (all.length === 1 ? ' loc' : (all.length < 20 ? ' locuri' : ' de locuri')) + ' pentru „' + String(s.sq).trim() + '”' + (page ? ', pagina ' + (page + 1) : '') : 'Încearcă un nume, „pizza”, „sector 2” sau „bar cu terasă”.') : all.length ? (all.length + ' locuri se potrivesc cu filtrele tale' + (page ? ', pagina ' + (page + 1) : '')) : 'Niciun loc nu bifează tot ce ai ales.') + APP.priceNote(String(s.sq || ''), String(this.filtersOf().budget)),
      hasCards: items.length > 0, noCards: items.length === 0, noCardsFlag: items.length === 0, cards,
      more: () => this.setState({ page: (page + 1) * 3 >= all.length ? 0 : page + 1 }),
      noMore: all.length <= 3,
      moreLabel: all.length <= 3 ? 'Doar atât' : (remaining > 0 ? 'Altele (' + remaining + ')' : 'De la început'),
      relaxVibes: () => this.setState({ vibes: [], page: 0 }), relaxBudget: () => this.setState({ budget: 'any', page: 0 }), relaxDist: () => this.setState({ dist: '30', page: 0 }),
      startVote: () => this.startVote(),
      sheetShown: s.sheet !== 'closed',
      sheetCls: s.sheet === 'closing' ? 'sheetout' : 'sheet', scrimCls: s.sheet === 'closing' ? 'scrimout' : 'scrim',
      closeFilters: () => this.closeFilters(), applyFilters: () => this.applyFilters(),
      ...(() => {
        // the budget range typed in the filter sheet becomes a key like '50-120', registered in BUDGET so the summary reads it
        const key = String((this.state.draft || this.filtersOf()).budget);
        const r = /^(\d*)-(\d*)$/.exec(key);
        const cur = r ? [r[1], r[2]] : (key === 'any' ? ['', ''] : ['', key === '0' ? '0' : key]);
        const put = (lo, hi) => {
          lo = String(lo).replace(/\D/g, '').slice(0, 4); hi = String(hi).replace(/\D/g, '').slice(0, 4);
          if (!lo && !hi) { this.setDraft('budget', 'any'); return; }
          const k = lo + '-' + hi;
          BUDGET[k] = { label: (lo || '0') + '–' + (hi || '∞'), max: hi ? Number(hi) : 9999, text: lo && hi ? 'între ' + lo + ' și ' + hi + ' lei' : (lo ? 'de la ' + lo + ' lei' : 'până în ' + hi + ' lei') };
          this.setDraft('budget', k);
        };
        return {
          bMin: r ? cur[0] : '', bMax: r ? cur[1] : '',
          bMinCls: r && cur[0] ? 'chip on' : 'chip', bMaxCls: r && cur[1] ? 'chip on' : 'chip',
          onBMin: (e) => put(e && e.target ? e.target.value : '', r ? cur[1] : ''),
          onBMax: (e) => put(r ? cur[0] : '', e && e.target ? e.target.value : ''),
        };
      })(),
      applyLabel: draftCount ? 'Arată ' + draftCount + (draftCount === 1 ? ' variantă' : ' variante') : 'Nimic nu se potrivește',
      rows,
      vibeOpts: VIBES.map((vb) => {
        const on = d.vibes.indexOf(vb) !== -1;
        return { label: vb, on, cls: on ? 'chip multi on' : 'chip multi', pick: () => { const cur = (this.state.draft || this.filtersOf()).vibes; this.setDraft('vibes', cur.indexOf(vb) !== -1 ? cur.filter((x) => x !== vb) : cur.concat([vb])); } };
      }),

      closeTicket: () => { clearInterval(this.qrTimer); this.setState({ screen: ['results', 'drops', 'plans'].indexOf(s.from) !== -1 ? s.from : 'home', qr: 'closed' }); },
      tWhen: WHEN[pl.when].date, tWho: pl.groupName || (pl.people === 1 ? 'Doar tu' : pl.people + ' persoane'), tTime: pl.slot,
      navUrl: 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.name + ' ' + (p.real ? p.real.lat + ',' + p.real.lon : '')),
      tTitle: p.title, tName: p.name, tVerified: !!p.verified, tPlus: !!PLUS[p.id] && (s.plus === 'trial' || s.plus === 'active'), tPlusText: PLUS[p.id] ? 'Plus · −' + PLUS[p.id][0] + '% pentru gașcă' : '',
      tFriends: members.length ? yes.map((m) => ({ ini: m.ini })) : FRIENDS.slice(0, Math.max(0, pl.people - 1)).map((x) => ({ ini: x })),
      tCount: people === 1 ? 'Doar tu' : 'Veniți ' + people,
      tCost: p.price === 0 ? 'Gratuit' : '~' + p.price + ' lei',
      needsRes, stubDot: needsRes || tixPlace, stubLabel: isDrop ? 'Ofertă' : (tixPlace ? 'Bilete' : (needsRes ? 'Rezervare' : 'Durată')),
      stubValue: isDrop ? 'Luată' : (tixPlace ? (tix ? tix.n + ' din ' + Math.max(need, tix.n) : 'Încă nu') : (needsRes ? resText : this.fmtDur(p.dur))),
      resDot: tixPlace ? (tix ? (tix.n >= need ? '#2F5BFF' : '#8A6A00') : '#D93A1C') : resDotC,
      showResAsk: needsRes && (pl.res === 'none' || pl.res === 'sheet' || isExt),
      askTitle: p.res === 'required' ? p.name + ' cere rezervare' : 'Se umple repede la ' + p.name,
      askBg: p.res === 'required' ? 'var(--coral-soft)' : 'var(--yellow-soft)',
      openRes: () => this.updPlan(pl.pid, { res: book === 'app' ? 'sheet' : 'ext' }), closeRes: () => this.updPlan(pl.pid, { res: 'none' }),
      isSheetRes: s.screen === 'ticket' && pl.res === 'sheet', isPending: pl.res === 'pending', isConfirmed: confirmed,
      sendRes: () => this.sendRes(),
      cancelRes: () => { clearInterval(this.qrTimer); this.updPlan(pl.pid, { res: 'none', stamp: false }); this.setState({ celebrate: false, qr: 'closed' }); },
      peopleText: pl.people + (pl.people === 1 ? ' persoană' : ' persoane'),
      fewer: () => this.updPlan(pl.pid, { people: Math.max(1, pl.people - 1) }),
      morePeople: () => this.updPlan(pl.pid, { people: Math.min(12, pl.people + 1) }),
      slots: slots.map(([label, isFull]) => ({ label, full: isFull, sub: isFull ? 'plin' : 'liber', on: pl.slot === label, cls: pl.slot === label ? 'slot on' : 'slot', pick: () => { if (!isFull) this.updPlan(pl.pid, { slot: label }); } })),
      confText: WHEN[pl.when].date + ', ' + pl.slot + ', ' + pl.people + (pl.people === 1 ? ' persoană' : ' persoane'),
      confLine: isDrop ? drop.offer + ', ' + p.name : p.name + ', ' + dayWord[pl.when] + ', ' + pl.slot + ', ' + pl.people + (pl.people === 1 ? ' persoană' : ' persoane'),
      stampSub: noted ? 'prin ' + via : dayWord[pl.when] + ', ' + pl.slot,
      bigSub: p.name + ', ' + pl.slot,
      celebrate: s.screen === 'ticket' && (confirmed || noted) && s.celebrate, showSmallStamp: (confirmed || noted) && pl.stamp,
      srStatus: confirmed ? 'Rezervarea e confirmată. Când ajungi, scanează codul CeFaci al localului.' : (noted ? 'Rezervarea e notată pe bilet.' : ''),
      showQrBtn: tixPlace && !!tix,
      qrBtnClick: () => this.openTixView(0),
      qrBtnLabel: 'Arată biletele',
      ...this.checkVals(s, pl, p, isDrop, drop),

      // reservation directly at the place
      extShown: s.screen === 'ticket' && isExt,
      extPick: pl.res === 'ext', extGoing: pl.res === 'extgo', extBack: pl.res === 'extback', extForm: pl.res === 'extform', extFull: pl.res === 'extfull',
      extIntro: p.name + ' nu primește încă rezervări prin CeFaci. Rezervi direct la ei, apoi o notezi aici, ca s-o vadă și gașca.',
      extOpts: extOpts.map((o) => Object.assign({}, o, { pick: () => this.extGo(pl.pid, o.via) })),
      extScript: 'Bună ziua! Aș vrea ' + ct.unit + ' pentru ' + pl.people + (pl.people === 1 ? ' persoană' : ' persoane') + ', ' + atSlot + ', pe numele ' + (APP.prefs.name || 'tău') + '.',
      copyScript: () => this.toast('Mesajul e copiat. Îl poți lipi oriunde.'),
      reportNum: () => this.toast('Mulțumim. Verificăm datele de la ' + p.name + ' și le corectăm.'),
      extGoText: via === 'telefon' ? 'Te ducem la telefon: ' + ct.phone + '…' : (via === 'WhatsApp' ? 'Deschidem WhatsApp cu mesajul scris…' : 'Deschidem site-ul ' + p.name + '…'),
      extYes: () => this.updPlan(pl.pid, { res: 'extform' }),
      extNoRoom: () => this.updPlan(pl.pid, { res: 'extfull' }),
      extLater: () => { this.updPlan(pl.pid, { res: 'none' }); this.toast('Butonul Rezervă rămâne pe bilet până rezervi.'); },
      extSave: () => this.saveNoted(pl.pid),
      extSearch: () => { this.removePlan(pl.pid); this.setState({ screen: 'results', page: 0 }); this.toast('Am scos ' + p.name + ' din planuri. Uite ce se mai potrivește.'); },
      extGoAnyway: () => { this.updPlan(pl.pid, { res: 'none' }); this.toast('Mergeți fără rezervare. Poate prindeți loc la intrare.'); },
      isNoted: noted,
      notedTitle: 'Rezervat prin ' + via + ' la ' + p.name,
      notedLine: (dayLong.charAt(0).toUpperCase() + dayLong.slice(1)) + ', ' + pl.slot + ', ' + pl.people + (pl.people === 1 ? ' persoană' : ' persoane') + ', pe numele ' + (APP.prefs.name || 'tău') + '. Spui numele la intrare, apoi spui numele la intrare.',
      cancelNoted: () => { this.updPlan(pl.pid, { res: 'none', stamp: false }); this.toast('Am scos rezervarea de pe bilet. Anunță-i și pe ei' + (ct.phone ? ': ' + ct.phone : '') + '.'); },

      // tickets
      showTixAsk: tixPlace && !tix,
      tixAskSub: en.kind === 'web' ? p.name + ' vinde biletele pe site-ul lor, ' + en.price + ' lei.' : (en.door ? 'Online ' + en.price + ' lei, la intrare ' + en.door + ' lei. Mai sunt ' + en.left + ' bilete online.' : 'Bilet ' + en.price + ' lei' + (pl.slot === 'acum' ? '' : ', filmul începe la ' + pl.slot) + '. Mai sunt ' + en.left + ' locuri.'),
      tixBuyLabel: en.kind === 'web' ? 'Cumpără de pe site' : 'Cumpără',
      buyTix: () => this.openTix(en.kind === 'web' ? 'web' : 'buy'), importTix: () => this.openTix('import'),
      showTixHave: tixPlace && !!tix,
      tixHaveTitle: tix ? (need <= 1 && tix.n === 1 ? 'Ai bilet' : 'Bilete: ' + tix.n + ' din ' + Math.max(need, tix.n)) : '',
      tixHaveSub: tix ? (missing.length && missingCount ? joinStr(missing.slice(0, missingCount)) + (Math.min(missing.length, missingCount) === 1 ? ' încă n-are bilet.' : ' încă n-au bilet.') : (missingCount ? 'Mai lipsesc ' + missingCount + ' bilete.' : (tixExtra ? (tixExtra === 1 ? 'Unul e pentru cine vine cu tine. Îl trimiți din bilet.' : tixExtra + ' sunt pentru cei care vin cu tine. Le trimiți din bilet.') : (tix.n > 1 ? 'Fiecare îl are pe al lui în aplicație.' : 'Merge și fără internet.')))) : '',
      tixMissing: !!tix && missingCount > 0,
      buyMore: () => this.openTix(en.kind === 'web' ? 'web' : 'buy'),
      openTixView: () => this.openTixView(0),
      tixSheetShown: s.screen === 'ticket' && !!ts,
      closeTix: () => this.setState({ tixSheet: null }),
      tsKicker: ts ? (ts.mode === 'buy' ? 'Cumperi prin CeFaci' : (ts.mode === 'web' ? 'Se vând pe site-ul lor' : 'Ai deja bilet')) : '',
      tsTitle: ts ? (ts.mode === 'import' ? (ts.step === 'back' ? 'Ai cumpărat? Adaugă biletele' : 'Adaugă biletul') : 'Bilete la ' + p.name) : '',
      tsText: ts ? (ts.mode === 'buy' ? p.title + ', ' + atSlot + '. ' + en.price + ' lei biletul' + (en.door ? ', la intrare ' + en.door + ' lei.' : '.') : (ts.mode === 'web' ? p.name + ' vinde biletele doar pe site-ul lor. Le cumperi acolo, apoi le adaugi aici, ca să le ai la intrare chiar și fără semnal.' : 'Din screenshot, PDF sau mail. Citim codul și îl punem pe biletul serii.')) : '',
      tsBuy: !!ts && ts.mode === 'buy' && ts.step === 'pick',
      tsSeats: !!ts && ts.mode === 'buy' && ts.step === 'pick' && !!en.seats,
      seatRows: ts && en.seats ? SEAT_ROWS.map((r) => ({
        name: r,
        seats: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((k) => {
          const id = r + k;
          const taken = SEAT_TAKEN.indexOf(id) !== -1;
          const on = ts.seats.indexOf(id) !== -1;
          return { label: 'Rândul ' + r + ', locul ' + k + (taken ? ', ocupat' : ''), taken, on, cls: on ? 'seat on' : 'seat', gap: k === 5 ? '10px' : '0',
            pick: () => { const cur = this.state.tixSheet; if (!cur) return; let seats = cur.seats.slice(); if (seats.indexOf(id) !== -1) seats = seats.filter((x) => x !== id); else { if (seats.length >= cur.n) seats.shift(); seats.push(id); } this.setTix({ seats }); } };
        })
      })) : [],
      seatText: ts && en.seats ? (ts.seats.length === ts.n ? this.seatText(ts.seats) : 'Alege încă ' + (ts.n - ts.seats.length) + (ts.n - ts.seats.length === 1 ? ' loc' : ' locuri')) : '',
      tsCountText: ts ? ts.n + (ts.n === 1 ? ' bilet' : ' bilete') : '',
      tsForText: ts ? (ts.n === 1 && tsNames[0] === 'tine' ? 'Doar pentru tine' : (tsNames.length >= ts.n ? 'Pentru ' + joinStr(tsNames.slice(0, ts.n)) : 'Pentru ' + ts.n + ' persoane')) : '',
      tsFewer: () => { const cur = this.state.tixSheet; const n = Math.max(1, cur.n - 1); this.setTix({ n, seats: en.seats ? this.autoSeats(n) : [] }); },
      tsMore: () => { const cur = this.state.tixSheet; const n = Math.min(8, cur.n + 1); this.setTix({ n, seats: en.seats ? this.autoSeats(n) : [] }); },
      tsTotal: ts ? (ts.n * en.price) + ' lei' : '',
      tsPayOff: !!ts && !!en.seats && ts.seats.length !== ts.n,
      tsPayLabel: ts ? 'Plătește ' + (ts.n * en.price) + ' lei' : '',
      tsPay: () => { const cur = this.state.tixSheet; if (!cur || (en.seats && cur.seats.length !== cur.n)) return; this.tixBusy('paying', 1500, () => this.saveTix(cur.pid, cur.n, cur.seats, 'app')); },
      tsBusy: !!ts && ['paying', 'reading', 'opening'].indexOf(ts.step) !== -1,
      tsBusyText: ts ? ({ paying: 'Se plătește…', reading: 'Citim codul de pe bilet…', opening: 'Deschidem site-ul ' + p.name + '…' })[ts.step] || '' : '',
      tsWeb: !!ts && ts.mode === 'web' && ts.step === 'pick',
      tsOpenSite: () => this.tixBusy('opening', 1300, () => this.setTix({ mode: 'import', step: 'back' })),
      tsImport: !!ts && ts.mode === 'import' && (ts.step === 'pick' || ts.step === 'back'),
      tsIsBack: !!ts && ts.step === 'back',
      importOpts: [
        ['Din poze', 'Screenshot cu codul biletului', 'M3 5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 9a2 2 0 1 0 0 .01M21 15l-3.09-3.09a2 2 0 0 0-2.82 0L6 21'],
        ['Din PDF sau mail', 'Biletul primit pe mail', 'M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7zM14 2v4a2 2 0 0 0 2 2h4M10 13h4M10 17h4'],
        ['Scanează codul', 'De pe hârtie sau alt ecran', 'M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2M7 12h10']
      ].map(([label, sub, icon]) => ({ label, sub, icon, pick: () => { const n = this.state.tixSheet.n; this.tixBusy('reading', 1400, () => this.setTix({ step: 'found', foundSeats: en.seats ? this.autoSeats(n) : [] })); } })),
      tsNotYet: () => { this.setState({ tixSheet: null }); this.toast('Când le cumperi, apasă Am deja bilet.'); },
      tsFound: !!ts && ts.step === 'found',
      tsFoundTitle: ts ? 'Am găsit ' + ts.n + (ts.n === 1 ? ' bilet' : ' bilete') : '',
      tsFoundLine1: p.title + ', ' + p.name,
      tsFoundLine2: ts ? (atSlot.charAt(0).toUpperCase() + atSlot.slice(1)) + ', ' + (ts.foundSeats && ts.foundSeats.length ? this.seatText(ts.foundSeats) : 'intrare generală') : '',
      tsSave: () => { const cur = this.state.tixSheet; this.saveTix(cur.pid, cur.n, cur.foundSeats || [], 'import'); },
      tsRetry: () => this.setTix({ step: 'pick' }),
      tvShown: s.screen === 'ticket' && !!tv,
      tvCls: tv && tv.st === 'closing' ? 'qrout' : 'qrin', tvScrimCls: tv && tv.st === 'closing' ? 'scrimout' : 'scrim',
      closeTixView: () => this.closeTixView(),
      tvIdx: tix ? 'Bilet ' + (tvI + 1) + ' din ' + tix.n : '',
      tvTitle: p.title, tvWhere: p.name + ', ' + atSlot,
      tvHolder: tix ? (tix.holders[tvI] === 'Tu' ? 'Pentru tine' : (tix.holders[tvI].indexOf('Invitat') === 0 ? 'Bilet în plus' : 'Pentru ' + tix.holders[tvI])) : '',
      tvHolderSub: tix ? (tix.holders[tvI] === 'Tu' ? 'Cornel Adrian' : (tix.holders[tvI].indexOf('Invitat') === 0 ? 'Îl poți trimite unui prieten din CeFaci' : 'Îl are și în aplicația lui')) : '',
      tvSeat: tix ? (tix.seats[tvI] ? this.seatText([tix.seats[tvI]]) : 'Intrare generală') : '',
      tvQr: tix ? this.makeQr(pl.pid * 31 + tvI * 7 + 11) : '',
      tvCode: tix ? String((pl.pid * 104729 + tvI * 7919 + 311) % 100000000).padStart(8, '0').replace(/(\d{4})(\d{4})/, '$1 $2') : '',
      tvFirst: tvI <= 0, tvLast: !tix || tvI >= tix.n - 1,
      tvPrev: () => { const t0 = this.state.tixView; if (t0 && t0.i > 0) this.setState({ tixView: Object.assign({}, t0, { i: t0.i - 1 }) }); },
      tvNext: () => { const t0 = this.state.tixView; if (t0 && tix && t0.i < tix.n - 1) this.setState({ tixView: Object.assign({}, t0, { i: t0.i + 1 }) }); },
      tvDots: tix ? tix.holders.map((h, k) => ({ cls: k === tvI ? 'tvd on' : 'tvd' })) : [],
      tvMine: !!tix && tix.holders[tvI] === 'Tu',
      addWallet: () => this.toast('Biletul e în Wallet. Îl găsești și fără CeFaci.'),
      tvFoot: tix ? (tix.src === 'import' ? 'Importat în CeFaci. ' : 'Cumpărat prin CeFaci. ') + 'Merge și fără internet.' + (p.age ? ' Intrarea e 18+, ia buletinul.' : '') : '',
      qrTitle: isDrop ? 'Arată codul la casă' : 'Arată codul la intrare',
      qrShown: s.qr !== 'closed', qrCardCls: s.qr === 'closing' ? 'qrout' : 'qrin', qrScrimCls: s.qr === 'closing' ? 'scrimout' : 'scrim',
      openQr: () => this.openQr(), closeQr: () => this.closeQr(),
      qrPath: this.makeQr(s.seed + p.id.length), digits: (() => { const x = String((s.seed * 7919 + 482915 + p.id.length * 101) % 1000000).padStart(6, '0'); return x.slice(0, 3) + ' ' + x.slice(3); })(),
      tickCls: s.seed % 2 === 0 ? 'tick' : 'tick2',
      isDropPlan: isDrop, dropOffer: drop ? drop.offer : '', holdLeft: this.clockFmt(holdLeft),
      hasRsvp: members.length > 0, rsvp, rsvpTitle: pl.groupName, rsvpTemp: !!pl.temp && members.length > 1, rsvpText: (() => { const t = rsvpBits.join('. ') + '.'; return t.charAt(0).toUpperCase() + t.slice(1); })(),
      remindText: members.length ? 'Gașca primește și ea reminder.' : 'Îți amintim cu 90 de minute înainte.',
      openSend: () => this.setState({ sendOpen: true }),
      showSend: s.screen === 'ticket' && s.sendOpen,
      closeSend: () => this.setState({ sendOpen: false }),
      sendLine: p.title + ', ' + dayWord[pl.when] + ', ' + pl.slot,
      groups: s.crews.filter((c) => this.joinedOf(c).length > 0).map((c) => {
        const j = this.joinedOf(c);
        return {
          name: c.name, icon: ICONS[c.icon], c: c.c, isCrew: true, notCrew: false, meta: (j.length + 1) + ' membri, gașcă permanentă',
          pick: () => { this.updPlan(pl.pid, { group: j, groupName: c.name, rsvpAt: this.state.tick, temp: false, crewId: c.id }); this.setState({ sendOpen: false }); this.toast('Planul a plecat la ' + c.name + '. Vezi răspunsurile pe bilet.'); }
        };
      }).concat([{
        name: 'Doar Ioana', icon: '', c: '', isCrew: false, notCrew: true, meta: 'în doi, fără gașcă',
        pick: () => { this.updPlan(pl.pid, { group: IOANA, groupName: 'În doi cu Ioana', rsvpAt: this.state.tick, temp: true, crewId: null }); this.setState({ sendOpen: false }); this.toast('I-ai trimis planul Ioanei. Vezi răspunsul pe bilet.'); }
      }]),

      hasPlans: plans.length > 0, noPlans: plans.length === 0, planCount: plans.length,
      planList: plans.map((x) => ({
        day: dayWord[x.when], time: x.slot, title: this.place(x.placeId).title, sub: planLabel(x), bg: x.drop != null ? '#FFE58A' : '#FFD43B',
        open: () => this.setState({ screen: 'ticket', cur: x.pid, from: 'plans' })
      })),

      showConflict: !!s.conflict,
      conflictTitle: cOld && cOthers ? 'Ai deja plan cu ' + (cOld.group.length === 1 ? cOld.group[0].name : 'gașca') + ' atunci.' : 'Ai deja un plan atunci.',
      conflictText: (() => {
        if (!s.conflict) return '';
        const po = this.place(cOld.placeId);
        const pn = this.place(s.conflict.placeId);
        const had = cOld.res === 'confirmed' ? 'rezervare confirmată' : (cOld.res === 'noted' ? 'rezervare' : (cOld.tix ? (cOld.tix.n === 1 ? 'bilet' : 'bilete') : (cOld.drop != null ? 'ofertă luată' : 'plan')));
        const at = ', ' + dayWord[cOld.when] + ' la ' + cOld.slot;
        const tixNote = cOld.tix ? ' ' + (cOld.tix.n === 1 ? 'Biletul e plătit și nu se returnează automat, dar îl poți da unui prieten din bilet.' : 'Biletele sunt plătite și nu se returnează automat, dar le poți da unor prieteni din bilet.') : '';
        if (!cOthers) return 'Ai ' + had + ' la ' + po.name + at + '. Nu poți fi în două locuri deodată. Dacă vrei să continui cu ' + pn.name + ', renunță mai întâi la ' + po.name + (cOld.res === 'confirmed' ? '. Localul e anunțat că eliberezi locul.' : '.') + tixNote;
        const who = cOld.group.length === 1 ? cOld.group[0].name : cOld.groupName;
        return 'Tu și ' + who + ' aveți ' + had + ' la ' + po.name + at + '. Nu mutăm pe nimeni fără să fie de acord. Poți ieși doar tu din plan, iar ' + (cOld.group.length === 1 ? cOld.group[0].name + ' e anunțată' : 'ei merg mai departe') + ', sau le propui să vă mutați toți la ' + pn.name + '.' + tixNote;
      })(),
      conflictSolo: !!s.conflict && !cOthers, conflictGroup: !!s.conflict && cOthers,
      conflictGo: cOld ? 'Renunț la ' + this.place(cOld.placeId).name + ' și continui' : '',
      conflictLeave: cOld && cOthers ? 'Ies doar eu, ' + (cOld.group.length === 1 ? cOld.group[0].name + ' e anunțată' : 'ei merg la ' + this.place(cOld.placeId).name) : '',
      conflictMoveLabel: cOld && cOthers ? (cOld.group.length === 1 ? 'Îi propun lui ' + cOld.group[0].name + ' să mergem la ' : 'Propun gășcii să ne mutăm la ') + this.place(s.conflict.placeId).name : '',
      moveBlocked: cMoveBlocked, moveNote: cMoveBlocked ? 'La oferta asta mai sunt doar ' + this.dropLeft(s.conflict.opts.drop) + ' locuri, voi sunteți ' + (cOld.people) + '.' : '',
      conflictStay: cOld ? (cOthers ? 'Rămân la planul cu ' + (cOld.group.length === 1 ? cOld.group[0].name : 'gașca') : 'Păstrez ' + this.place(cOld.placeId).name) : '',
      conflictReplace: () => {
        const c = this.state.conflict;
        const oldName = this.place(this.state.plans.find((x) => x.pid === c.withPid).placeId).name;
        this.removePlan(c.withPid);
        this.setState({ conflict: null });
        this.later(() => { this.createPlan(c.placeId, c.opts, false); this.toast('Ai renunțat la ' + oldName + '.'); }, 30);
      },
      conflictLeaveGo: () => {
        const c = this.state.conflict;
        const old = this.state.plans.find((x) => x.pid === c.withPid);
        const oldName = this.place(old.placeId).name;
        const who = old.group.length === 1 ? old.group[0].name : old.groupName;
        this.removePlan(c.withPid);
        this.setState({ conflict: null });
        const next = Object.assign({}, c.opts);
        if (next.party !== 'me') { next.solo = true; next.party = 'me'; }
        this.later(() => { this.createPlan(c.placeId, next, false); this.toast('Ai ieșit din planul de la ' + oldName + '. ' + who + (old.group.length === 1 ? ' e anunțată.' : ' merge mai departe fără tine, iar localul află că sunteți cu unul mai puțin.')); }, 30);
      },
      conflictMove: () => this.proposeMove(),
      conflictKeep: () => { const c = this.state.conflict; this.setState({ conflict: null }); this.toast('Ai păstrat planul la ' + this.place(this.state.plans.find((x) => x.pid === c.withPid).placeId).name + '.'); },
      proposalShown: !!s.proposal, proposalText: s.proposal ? 'Așteptăm răspunsul de la ' + s.proposal.who + '…' : '',
      crewOpen: s.crewOpen,
      closeCrew: () => this.setState({ crewOpen: false }),
      crewGroups: allCrews.map((c) => {
        const j = this.joinedOf(c);
        const pend = c.members.length - j.length;
        const off = j.length === 0;
        return {
          name: c.name, icon: ICONS[c.icon], c: c.c, rot: c.rot, off,
          meta: off ? 'Așteptăm să accepte invitația' : (j.length + 1) + ' cu tine: ' + j.map((m) => m.name).join(', ') + (pend ? ', ' + pend + ' invitați' : ''),
          cls: (cd.g === c.id ? 'press card pickrow on' : 'press card pickrow') + (off ? ' off' : ''), on: cd.g === c.id,
          pick: () => { if (!off) this.setState({ crewDraft: { g: cd.g === c.id ? null : c.id, f: [], save: false } }); }
        };
      }),
      tempHint: !cd.g && cd.f.length > 0 && !cd.save,
      tempHintText: cd.f.length === 1 ? 'Ieșiți în doi. Nu se creează nicio gașcă.' : 'Grup temporar: ține doar pentru planul ăsta și se șterge după ieșire.',
      crewFriends: this.friendsAll().map((fr) => {
        const on = cd.f.indexOf(fr.user) !== -1;
        return { ini: fr.ini, name: fr.name.split(' ')[0], bg: fr.bg, fg: fr.fg, on, cls: on ? 'press fchip on' : 'press fchip',
          pick: () => { const d0 = this.state.crewDraft; const nf = d0.f.indexOf(fr.user) !== -1 ? d0.f.filter((u) => u !== fr.user) : d0.f.concat([fr.user]); this.setState({ crewDraft: { g: null, f: nf, save: nf.length >= 2 ? d0.save : false } }); } };
      }),
      canSave: !cd.g && cd.f.length >= 2, saveOn: !!cd.save, saveCls: cd.save ? 'tg on' : 'tg',
      toggleSave: () => this.setState({ crewDraft: Object.assign({}, this.state.crewDraft, { save: !this.state.crewDraft.save }) }),
      crewCta: cd.save && !cd.g && cd.f.length >= 2 ? 'Continuă: nume și ștampilă' : (cdCount === 1 ? 'Merg singur' : (cdCount === 2 ? 'Gata, sunteți doi' : 'Gata, sunteți ' + cdCount)),
      applyCrew: () => {
        const d0 = this.state.crewDraft;
        let crew = null;
        if (d0.g) {
          const g = allCrews.find((c) => c.id === d0.g);
          crew = { id: g.id, name: g.name, members: this.joinedOf(g) };
        } else if (d0.f.length) {
          const members = this.friendsAll().filter((fr) => d0.f.indexOf(fr.user) !== -1).map((fr) => this.asMember(fr));
          if (d0.save && members.length >= 2) { this.openNewCrew({ from: 'sheet', f: d0.f }); return; }
          crew = { id: null, temp: true, name: this.autoCrewName(members), members };
        }
        const n = crew ? crew.members.length + 1 : 1;
        this.setState({ crew, crewOpen: false, who: this.whoOf(n), page: 0 });
      },
      newCrewFromSheet: () => this.openNewCrew({ from: 'sheet', f: (this.state.crewDraft || { f: [] }).f }),

      // permanent crews, temporary groups, keep-the-group cards
      permCrews: s.crews.map((c) => {
        const j = this.joinedOf(c).length;
        const pend = c.members.length - j;
        return {
          name: c.name, icon: ICONS[c.icon], c: c.c, rot: c.rot, pending: pend > 0,
          meta: pend ? (j + 1) + ' în gașcă, ' + (pend === 1 ? 'o invitație' : pend + ' invitații') + ' în așteptare' : (c.members.length + 1) + ' membri, ' + outingsText(c.outings),
          cls: c.isNew ? 'press card pop' : 'press card',
          open: () => this.setState({ screen: 'crewview', crewView: c.id, crewFrom: 'plans', delArm: false })
        };
      }),
      crewTotal: s.crews.length,
      tempGroups: plans.filter((x) => x.temp && x.group && x.group.length).map((x) => ({
        name: x.groupName,
        sub: 'Doar pentru ' + this.place(x.placeId).title + ', ' + (x.slot === 'acum' ? 'acum' : dayWord[x.when] + ' la ' + x.slot),
        avatars: avs(x.group, 30),
        end: () => this.endPlan(x.pid)
      })),
      hasTemp: plans.some((x) => x.temp && x.group && x.group.length),
      endedCards: s.ended.map((e) => ({
        text: 'Ieșirea la ' + e.placeName + ' s-a terminat, iar grupul „' + e.name + '” se șterge. Îl faceți gașcă permanentă? ' + joinNames(e.members) + ' primesc invitație.',
        avatars: avs(e.members, 34),
        keep: () => this.openNewCrew({ from: 'plans', f: e.members.map((m) => m.user), endedId: e.id, hint: this.autoCrewName(e.members) }),
        drop: () => { this.setState((st) => ({ ended: st.ended.filter((x) => x.id !== e.id) })); this.toast('Grupul temporar s-a șters.'); }
      })),
      hasEnded: s.ended.length > 0,
      newCrewFromFriends: () => this.openNewCrew({ from: 'friends' }),
      newCrewFromPlans: () => this.openNewCrew({ from: 'plans' }),

      ncTitle: nc && nc.endedId ? 'Păstrați gașca' : 'Gașcă nouă',
      ncBack: () => { const from = this.state.nc ? this.state.nc.from : 'friends'; this.setState({ screen: from === 'sheet' ? 'home' : from, nc: null, crewOpen: from === 'sheet' }); },
      ncName: nc ? nc.name : '',
      ncPlaceholder: nc && nc.hint ? nc.hint : (ncPicked.length >= 2 ? this.autoCrewName(ncPicked) : 'ex: Gașca de vineri'),
      ncOnName: (e) => { const val = e && e.target ? String(e.target.value) : ''; ncSet({ name: val.slice(0, 24) }); },
      ncIcon: ICONS[nc ? nc.icon : 'star'], ncInk: ncCol.ink,
      ncIcons: STAMP_ICONS.map((k) => {
        const on = !!nc && nc.icon === k;
        return { icon: ICONS[k], label: STAMP_NAMES[k], on, cls: on ? 'press stp on' : 'press stp', c: on ? ncCol.ink : 'var(--ink2)', pick: () => ncSet({ icon: k }) };
      }),
      ncColors: STAMP_COLORS.map((c) => {
        const on = !!nc && nc.c === c.id;
        return { sw: c.sw, label: c.label, on, cls: on ? 'sw on' : 'sw', pick: () => ncSet({ c: c.id }) };
      }),
      ncFriends: this.friendsAll().map((fr) => {
        const on = !!nc && nc.f.indexOf(fr.user) !== -1;
        return { ini: fr.ini, name: fr.name.split(' ')[0], bg: fr.bg, fg: fr.fg, on, cls: on ? 'press fchip on' : 'press fchip',
          pick: () => { const f0 = this.state.nc.f; ncSet({ f: f0.indexOf(fr.user) !== -1 ? f0.filter((u) => u !== fr.user) : (f0.length >= 14 ? f0 : f0.concat([fr.user])) }); } };
      }),
      ncCountText: nc && nc.f.length ? (nc.f.length === 1 ? '1 ales' : nc.f.length + ' aleși') : 'minim 2',
      ncBlocked: !nc || nc.f.length < 2,
      ncCta: !nc || nc.f.length < 2 ? 'Alege cel puțin 2 prieteni' : (nc.from === 'sheet' ? 'Creează gașca și continuă' : 'Trimite ' + nc.f.length + ' invitații'),
      ncCreate: () => this.createCrew(),

      cvName: cv ? cv.name : '', cvIcon: cv ? ICONS[cv.icon] : '', cvC: cv ? cv.c : 'var(--ink)', cvRot: cv ? cv.rot : '0deg',
      cvSub: cv ? 'Gașcă permanentă, ' + (cv.members.length + 1) + ' membri, ' + outingsText(cv.outings) : '',
      cvHasPending: cvPending.length > 0,
      cvPendText: cvPending.length ? 'Invitațiile au plecat. Așteptăm răspunsul de la ' + joinNames(cvPending) + '.' : '',
      cvAllIn: !!cv && cv.invAt != null && cvPending.length === 0,
      cvMeTag: cvAdminMe,
      cvMembers: cv ? cv.members.map((m, k) => {
        const isIn = this.memberIn(cv, k);
        const fresh = cv.invAt != null;
        const admin = cv.admin === m.name;
        return {
          ini: m.ini, name: m.name, user: m.user || m.name.toLowerCase(), bg: m.bg, fg: m.fg, op: isIn ? '1' : '0.5',
          open: () => this.openPerson(m.user, 'crewview'),
          hasTag: !isIn || fresh || admin,
          tag: !isIn ? 'Invitat' : (admin ? 'Admin' : 'A acceptat'),
          tagCls: !isIn ? 'tag' : 'tag pop',
          tagBg: !isIn ? 'var(--yellow-soft)' : (admin ? 'var(--s2)' : 'var(--blue-soft)'),
          tagFg: !isIn ? 'var(--yellow-ink)' : (admin ? 'var(--ink)' : 'var(--blue-ink)')
        };
      }) : [],
      cvCount: cv ? 'Membri (' + (cv.members.length + 1) + ')' : '',
      cvBack: () => this.setState({ screen: this.state.crewFrom || 'plans', delArm: false }),
      cvCanPlan: cvJoined.length > 0,
      cvNoPlan: cvJoined.length === 0,
      cvPlan: () => { if (!cv || !cvJoined.length) return; this.setState({ crew: { id: cv.id, name: cv.name, members: cvJoined }, who: this.whoOf(cvJoined.length + 1), page: 0, screen: 'home' }); },
      cvDelLabel: s.delArm ? (cvAdminMe ? 'Sigur? Apasă iar ca să ștergi gașca' : 'Sigur? Apasă iar ca să ieși') : (cvAdminMe ? 'Șterge gașca' : 'Ieși din gașcă'),
      cvDelCls: s.delArm ? 'press btns pop' : 'press btns',
      cvDel: () => {
        if (!cv) return;
        if (!this.state.delArm) { this.setState({ delArm: true }); return; }
        this.setState((st) => ({ crews: st.crews.filter((x) => x.id !== cv.id), crew: st.crew && st.crew.id === cv.id ? null : st.crew, delArm: false, screen: st.crewFrom || 'plans' }));
        this.toast(cvAdminMe ? 'Ai șters gașca „' + cv.name + '”. Membrii sunt anunțați.' : 'Ai ieșit din „' + cv.name + '”. Gașca rămâne pentru ceilalți.');
      },
      cvRule: cvAdminMe ? 'Gașca rămâne până o ștergi tu sau până ies toți membrii. Dacă ieși tu, adminul trece la cel mai vechi membru.' : 'Dacă ieși, gașca rămâne pentru ceilalți. Dispare doar când o șterge ' + (cv ? cv.admin : '') + ' sau când ies toți.',
      claimOpen: !!s.claim,
      closeClaim: () => this.setState({ claim: null }),
      claimTitle: cl ? cl.offer : '',
      claimSub: cl ? this.place(cl.placeId).name + ', mai sunt ' + clLeft + ' locuri' : '',
      claimOpts: cl ? (() => {
        const o2 = [];
        const minP = cl.min || 1;
        o2.push({ label: 'Doar pentru mine', sub: minP > 1 ? 'Oferta e pentru grupuri de ' + minP + '+' : '1 loc, ceilalți nu sunt implicați', off: minP > 1 || clLeft < 1, pick: () => this.createPlan(cl.placeId, { drop: s.claim.i, party: 'me', from: s.claim.from }) });
        if (s.crew) o2.push({ label: 'Pentru ' + s.crew.name, sub: clLeft < crewN ? 'Mai sunt doar ' + clLeft + ' locuri, voi sunteți ' + crewN : crewN + ' locuri, primesc invitație', off: clLeft < crewN || crewN < minP, pick: () => this.createPlan(cl.placeId, { drop: s.claim.i, party: 'crew', from: s.claim.from }) });
        else if (crewN > 1) o2.push({ label: 'Pentru ' + crewN + ' persoane', sub: clLeft < crewN ? 'Mai sunt doar ' + clLeft + ' locuri' : crewN + ' locuri, îi inviți după', off: clLeft < crewN || crewN < minP, pick: () => this.createPlan(cl.placeId, { drop: s.claim.i, party: 'n', n: crewN, from: s.claim.from }) });
        return o2.map((x) => Object.assign(x, { cls: x.off ? 'press card pickrow off' : 'press card pickrow' }));
      })() : [],
      toastShown: s.toast !== '' && s.tick <= s.toastUntil, toast: s.toast,

      voteBack: () => this.setState({ screen: s.voteFrom || 'results' }),
      voteTimer: this.clockFmt(voteSecs),
      voters,
      voteIsVote: !!v && v.phase === 'vote', voteIsWait: !!v && v.phase !== 'vote' && !voteResult, voteIsResult: !!v && voteResult,
      voteStep: v ? 'Varianta ' + Math.min(v.i + 1, v.opts.length) + ' din ' + v.opts.length : '',
      vo: { title: voteOpt.title, name: voteOpt.name, bg: voteOpt.bg, fg: voteOpt.fg, dot: voteOpt.dot, icon: ICONS[voteOpt.icon], meta: (voteOpt.price ? '~' + voteOpt.price + ' lei' : 'gratuit') + ', la ' + voteOpt.dist + ' min', reason: this.reason(voteOpt, f) },
      voteNo: () => this.castVote('nu'), voteYes: () => this.castVote('da'), voteSuper: () => this.castVote('super'),
      superUsed: !!v && v.superUsed, superCls: v && v.superUsed ? 'press super-used' : 'press',
      voteWaitText: waitEl < 1 ? 'Mai lipsesc Sara și Radu.' : (waitEl < 2 ? 'Sara a votat. Mai lipsește Radu.' : 'Toată gașca a votat.'),
      winCount: win ? win.yes + ' din 5 au zis da' : '',
      winTitle: win ? this.place(win.id).title + ', ' + this.place(win.id).name : '',
      tally: tally.map((t, i) => ({ name: this.place(t.id).title + (t.sup ? ' (Super)' : ''), count: t.yes + ' din 5', pct: (t.yes * 20) + '%', c: t === win ? 'var(--blue)' : 'var(--ink3)', d: (i * 90 + 200) + 'ms' })),
      makeWinner: () => {
        const members2 = GV.map((m) => Object.assign({}, m, { answer: win.yes >= 5 || m.name !== 'Radu' ? 'da' : 'nu' }));
        this.createPlan(win.id, { from: 'results', group: members2, groupName: 'Gașca de vineri', rsvpAt: -100, crewId: 'gv' });
      },
      voteAgain: () => this.startVote(),

      q: s.q, qNorm: qn,
      onQ: (e) => { const val = e && e.target ? e.target.value : ''; clearTimeout(this.qTimer); this.setState({ q: val, settled: false }); this.qTimer = setTimeout(() => this.setState({ settled: true }), 650); },
      showFound: qn === 'maria.i', showNotFound: qn !== 'maria.i' && s.settled && qn.length >= 3,
      addLabel: s.sent ? 'Trimisă' : 'Adaugă', addCls: s.sent ? 'press pop' : 'press', addBg: s.sent ? 'var(--s2)' : 'var(--blue)', addFg: s.sent ? 'var(--ink)' : '#FFFFFF',
      toggleAdd: () => this.setState({ sent: !this.state.sent }),
      showReq: s.req === 'pending', hasReq: s.req === 'pending',
      accept: () => this.setState({ req: 'accepted' }), decline: () => this.setState({ req: 'declined' }),
      friendList, friendCount: friendList.length + ' prieteni',
      openMaria: () => this.openPerson('maria.i', 'friends'), openTudor: () => this.openPerson('tudor.m', 'friends'),
      isPerson: s.screen === 'person' && !!prBase,
      prBack: () => this.setState({ screen: this.state.personFrom || 'friends', personArm: false }),
      prUser: prBase ? prBase.user : '', prName: prBase ? prBase.name : '', prIni: prBase ? prBase.ini : '', prBg: prBase ? prBase.bg : '#FFFFFF', prFg: prBase ? prBase.fg : '#0E1440',
      prFull: !!prFriend, prLimited: !!prBase && !prFriend,
      prLvl: prData ? 'Nivel ' + prData.lvl : '', prLvlName: prData ? LEVELS[prData.lvl] : '',
      prStats: prData ? (prData.outings === 1 ? 'O ieșire' : prData.outings + (prData.outings < 20 ? ' ieșiri' : ' de ieșiri')) + ', ' + (prData.stamps.length === 1 ? 'un loc încercat' : prData.stamps.length + ' locuri încercate') : '',
      prTogether: prData ? (prData.together ? (prData.together === 1 ? 'O ieșire împreună' : prData.together + ' ieșiri împreună') : 'N-ați ieșit încă împreună') : '',
      prMutualTitle: 'Prieteni comuni (' + prMutualList.length + ')',
      prHasMutual: prMutualList.length > 0,
      prMutual: prMutualList.map((f) => ({ ini: f.ini, name: f.name.split(' ')[0], bg: f.bg, fg: f.fg, open: () => this.openPerson(f.user) })),
      prMutualText: prMutualList.length ? (prMutualList.length === 1 ? '1 prieten comun: ' : prMutualList.length + ' prieteni comuni: ') + joinStr(prMutualList.map((f) => f.name.split(' ')[0])) : 'Niciun prieten comun',
      prHasCrews: prCrewList.length > 0,
      prCrews: prCrewList.map((c) => ({ name: c.name, icon: ICONS[c.icon], c: c.c, rot: c.rot, open: () => this.setState({ screen: 'crewview', crewView: c.id, crewFrom: 'friends', delArm: false }) })),
      prStampTitle: prData ? (prStampList.length === 1 ? 'Un loc încercat' : prStampList.length + ' locuri încercate') : '',
      prStampSub: prSharedN ? (prSharedN === 1 ? 'Unul l-ați încercat amândoi' : prSharedN + ' le-ați încercat amândoi') : 'Niciunul în comun încă',
      prStamps: prStampList,
      prFewStamps: prStampList.length > 0 && prStampList.length < 3,
      prFewText: prFirst + ' abia a început. Luați-o cu voi data viitoare.',
      prPlan: () => { if (!prFriend) return; this.setState({ crew: { id: null, temp: true, name: 'În doi cu ' + prFirst, members: [this.asMember(prFriend)] }, who: '2', page: 0, screen: 'home' }); this.toast(prFirst + ' primește invitația când alegi planul.'); },
      prInvite: () => { if (prFriend) this.openNewCrew({ from: 'friends', f: [prFriend.user] }); },
      prDelLabel: s.personArm ? 'Sigur? Apasă iar ca să confirmi' : 'Elimină din prieteni',
      prDelCls: s.personArm ? 'press btns pop' : 'press btns',
      prDel: () => {
        if (!prFriend) return;
        if (!this.state.personArm) { this.setState({ personArm: true }); return; }
        this.setState((st) => ({ removed: st.removed.concat([prFriend.user]), personArm: false, screen: 'friends', person: null, req: prFriend.user === 'tudor.m' ? 'declined' : st.req }));
        this.toast(prFirst + ' nu mai e în lista ta de prieteni. Nu primește nicio notificare.');
      },
      prNote: prFriend ? prFirst + ' îți vede profilul la fel: nivelul, ștampilele și prietenii comuni. Poza o văd doar prietenii.' : 'Nivelul, ștampilele și poza le vezi după ce vă împrieteniți.',
      prActLabel: prU === 'tudor.m' ? (s.req === 'pending' ? 'Acceptă cererea' : 'Cerere refuzată') : (s.sent ? 'Cerere trimisă' : 'Adaugă prieten'),
      prActOff: prU === 'tudor.m' ? s.req !== 'pending' : false,
      prActBg: prU !== 'tudor.m' && s.sent ? 'var(--s2)' : 'var(--blue)', prActFg: prU !== 'tudor.m' && s.sent ? 'var(--ink)' : '#FFFFFF',
      prAct: () => { if (prU === 'tudor.m') { if (this.state.req === 'pending') { this.setState({ req: 'accepted' }); this.toast('Acum sunteți prieteni. Îi vezi nivelul și ștampilele.'); } } else this.setState({ sent: !this.state.sent }); },
      prLimitedSub: prU === 'tudor.m' ? 'Vrea să fiți prieteni' : (s.sent ? 'Cererea așteaptă răspuns' : 'Nu sunteți încă prieteni'),

      askFeedback: !s.levelDone,
      goFeedback: () => this.setState({ screen: 'feedback', lvPhase: 'ask', lvXp: 1420, lvChoice: '', lvChips: [], lvTags: [], lvReason: '' }),
      fbBack: () => this.setState({ screen: 'profile', levelDone: this.state.levelDone || ['level', 'after'].indexOf(this.state.lvPhase) !== -1 }),
      fbReplay: () => this.setState({ lvPhase: 'ask', lvXp: 1420, lvChoice: '', lvChips: [], lvTags: [], lvReason: '' }),
      lvlName: inFb ? (leveled ? LEVELS[4] : LEVELS[3]) : (s.levelDone ? LEVELS[4] : LEVELS[3]),
      lvlText: leveled ? 'Nivel 4' : 'Nivel 3',
      lvlShort: s.levelDone ? 'Nivel 4' : 'Nivel 3',
      xpText: this.fmtNum(xpNow) + ' / ' + this.fmtNum(cap) + ' XP',
      nextLvl: 'Încă ' + this.fmtNum(Math.max(0, cap - xpNow)) + ' până la ' + (s.levelDone ? LEVELS[5] : LEVELS[4]),
      profBar: pct.toFixed(1) + '%',
      barW: pct.toFixed(1) + '%', barNow: Math.round(pct),
      trackCls: s.lvPhase === 'fill' ? 'track shine' : 'track',
      showAsk: s.lvPhase === 'ask' || (rewarding && !meh),
      showAfter: leveled,
      showMeh: s.lvPhase === 'meh' || (rewarding && meh),
      mehBtnCls: rewarding ? 'press lock' : 'press',
      mehDone: () => { if (this.state.lvPhase === 'meh') this.lvReward('meh'); },
      lvlSub: meh ? 'Nu toate serile ies bine, dar ai încercat deja 10 locuri din zonă.' : 'Ai încercat 10 locuri din zonă. Acum știi pe unde să ieși.',
      showNoWent: s.lvPhase === 'nowent',
      showChips: s.lvPhase === 'xp' || s.lvPhase === 'fill',
      isLevel: s.lvPhase === 'level',
      chips: s.lvChips,
      fb: { super: fbCls('super'), ok: fbCls('ok'), meh: fbCls('meh'), no: fbCls('no') },
      pickSuper: () => this.lvAnswer('super'), pickOk: () => this.lvAnswer('ok'), pickMeh: () => this.lvAnswer('meh'), pickNo: () => this.lvAnswer('no'),
      finish: () => this.setState({ lvPhase: 'after', levelDone: true }),
      letters: LEVELS[4].split('').map((ch, n) => ({ ch, d: (1150 + n * 45) + 'ms' })),
      confetti,
      tags: ['Prea scump', 'Prea aglomerat', 'Servire lentă', 'Nu era ce părea'].map((t) => {
        const on = s.lvTags.indexOf(t) !== -1;
        return { label: t, on, cls: (on ? 'chip on' : 'chip') + (rewarding ? ' lock' : ''), pick: () => { if (this.state.lvPhase === 'meh') this.setState({ lvTags: on ? this.state.lvTags.filter((x) => x !== t) : this.state.lvTags.concat([t]) }); } };
      }),
      reasons: reasonList.map((r) => ({ label: r.label, on: s.lvReason === r.id, cls: s.lvReason === r.id ? 'fb on' : 'fb', pick: () => this.setState({ lvReason: r.id }) })),
      hasReason: !!chosen, reasonText: chosen ? chosen.text : '',

      segZi: themeClass === 'graphite' ? 'seg' : 'seg on', segNoapte: themeClass === 'graphite' ? 'seg on' : 'seg',
      isZi: themeClass !== 'graphite', isNoapte: themeClass === 'graphite',
      pickZi: () => this.setState({ theme: 'zi' }), pickNoapte: () => this.setState({ theme: 'noapte' }),
      tgCls: s.doodles ? 'tg on' : 'tg', toggleDoodles: () => this.setState({ doodles: !this.state.doodles }),
      stampCount: visited.length + ' locuri încercate',
      stamps: visited.map(([label, icon, c, rot], i) => ({ label, icon: ICONS[icon], c, rot, border: 'solid', delay: (i * 50) + 'ms' })).concat([{ label: 'Loc nou', icon: 'M12 5v14M5 12h14', c: 'var(--line)', rot: '0deg', border: 'dashed', delay: '500ms' }])
    };
  }
  fmtNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
}

return Component;
}
