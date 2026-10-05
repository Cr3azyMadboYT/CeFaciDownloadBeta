// Real searches, the way people type them on a phone (typos, no diacritics), and what must come first.
// Used by search.test.ts against the real OpenStreetMap venues. Time: Friday 2 Oct 2026, 18:30, starting from the centre.

export interface Expect {
  first?: RegExp;          // the first result's name
  kinds?: string[];        // each of the top results is one of these kinds
  cats?: string[];         // ... or one of these categories
  food?: string;           // ... serves this (TOPICS id: cuisine or a telling name)
  near?: string;           // ... is close to this place (PLACES id)
  within?: number;         // km from `near` (default: the place's radius, doubled)
  open?: boolean;          // ... is known to be open at the asked time
  notClosed?: boolean;     // ... is not known to be closed at the asked time
  maxPrice?: number;       // ... costs at most this per person
  people?: number;         // ... takes a group this big
  outdoor?: boolean;       // ... has a terrace or is outside
  noChain?: boolean;       // ... is not a chain
  notKinds?: string[];     // none of the top results is one of these kinds
  n?: number;              // how many top results to check (default 3; 0 = nothing must come up)
  absent?: RegExp;         // no result is named so (a chain we do not list)
  note?: boolean;          // the app must say it relaxed the request
}
export interface Case { q: string; e: Expect }

const C = (q: string, e: Expect): Case => ({ q, e });

export const QUERIES: Case[] = [
  // food, with places
  C('pizza sector 2', { food: 'pizza', near: 's2', noChain: true }),
  C('pizza', { food: 'pizza', noChain: true }),
  C('piza', { food: 'pizza', noChain: true }),
  C('pizzerie militari', { food: 'pizza', near: 'militari', noChain: true }),
  C('sushi pipera', { food: 'sushi', near: 'pipera' }),
  C('sushi deschis acum', { food: 'sushi', open: true }),
  C('burger floreasca', { food: 'burger', near: 'floreasca', noChain: true }),
  C('burgeri buni in centru', { food: 'burger', near: 'centru', noChain: true }),
  C('shaorma', { food: 'kebab', noChain: true }),
  C('saorma deschisa acum', { food: 'kebab', open: true }),
  C('kebab ieftin s6', { food: 'kebab', near: 's6', maxPrice: 50 }),
  C('restaurant italian dorobanti', { food: 'italian', near: 'dorobanti', notKinds: ['fast_food', 'cafe'] }),
  C('mancare romaneasca', { food: 'romanesc', noChain: true }),
  C('traditional romanesc centru', { food: 'romanesc', near: 'centru', noChain: true }),
  C('chinezesc', { food: 'chinezesc' }),
  C('thailandez', { food: 'thai', n: 2 }),
  C('indian', { food: 'indian' }),
  C('mexican', { food: 'mexican' }),
  C('grecesc', { food: 'grecesc' }),
  C('libanez', { food: 'libanez' }),
  C('vegan', { food: 'vegan', n: 1 }), // 04.10: the other vegan places are closed (Google Maps check)
  C('steak', { food: 'steak' }),
  C('peste si fructe de mare', { food: 'peste' }),
  C('restaurnt', { kinds: ['restaurant'] }),
  C('restaurant sub 100 lei sector 1', { kinds: ['restaurant'], near: 's1', maxPrice: 100 }),
  C('brunch duminica pipera', { cats: ['mancare', 'cafea'], near: 'pipera', notClosed: true }),
  C('mic dejun', { food: 'brunch', n: 2 }),
  C('bistro', { food: 'bistro', n: 2 }),
  // coffee and sweets
  C('cafenea deschisa acum', { kinds: ['cafe'], open: true, noChain: true }),
  C('cafea langa universitate', { kinds: ['cafe'], near: 'universitate', noChain: true }),
  C('cafenia', { kinds: ['cafe'], noChain: true }),
  C('cafenea cu terasa in vitan', { kinds: ['cafe'], near: 'vitan', within: 3.5 }),
  C('inghetata', { kinds: ['ice_cream'] }),
  C('prajituri', { cats: ['desert', 'cafea', 'mancare'], food: 'desert' }),
  C('ceainarie', { food: 'ceai', n: 1 }),
  // drinks and night
  C('bar cu terasa', { kinds: ['bar', 'pub', 'biergarten'], outdoor: true }),
  C('terasa herastrau', { near: 'herastrau', outdoor: true }),
  C('terasa in otopeni', { near: 'otopeni', outdoor: true }),
  C('pub', { kinds: ['pub'] }),
  C('berarie', { kinds: ['pub', 'biergarten', 'bar'] }),
  C('cocktailuri', { kinds: ['bar'] }),
  C('club', { kinds: ['nightclub'] }),
  C('club vineri noaptea', { kinds: ['nightclub'], notClosed: true }),
  C('cluburi in centrul vechi', { kinds: ['nightclub'], near: 'centru' }),
  C('party sambata noaptea', { kinds: ['nightclub', 'bar', 'pub'], notClosed: true }),
  C('ceva deschis dupa 2 noaptea', { open: true, n: 3 }),
  C('ce e deschis non stop', { open: true }),
  C('shisha', { food: 'shisha', n: 1 }),
  C('jazz', { first: /jazz/i }),
  C('karaoke', { kinds: ['bar', 'pub', 'nightclub'], note: true }),
  // culture
  C('teatru diseara', { kinds: ['theatre', 'arts_centre'], notClosed: true }),
  C('teatrul national', { first: /^Teatrul Național$/ }),
  C('tnb', { first: /^Teatrul Național$/ }),
  C('opera', { first: /^Opera Națională$/ }),
  C('ateneu', { first: /^Ateneul Român$/ }),
  C('muzeu', { kinds: ['museum'] }),
  C('muzee ieftine', { kinds: ['museum', 'gallery'], maxPrice: 50 }),
  C('cinema', { kinds: ['cinema'] }),
  C('film diseara', { kinds: ['cinema'], notClosed: true }),
  C('cinema afi', { kinds: ['cinema'], near: 'afi', within: 0.5, n: 1 }),
  C('galerie de arta', { kinds: ['gallery', 'arts_centre', 'museum'] }),
  // things to do
  C('bowlng', { cats: ['activitate'], note: true }),
  C('bowling sector 4', { cats: ['activitate'], note: true }),
  C('escape room pt 4', { kinds: ['escape_game'], people: 4 }),
  C('escape', { kinds: ['escape_game'] }),
  C('patinoar', { kinds: ['ice_rink'], n: 2 }), // outdoor rinks open in winter (closed for now)
  C('aquapark', { kinds: ['water_park', 'beach_resort'] }),
  C('zoo', { kinds: ['zoo'], n: 1 }),
  C('ceva cu copiii', { notKinds: ['bar', 'pub', 'nightclub', 'biergarten'] }),
  // people, budget, mood
  C('unde ies cu gasca de 6', { people: 6, notKinds: ['cafe'] }),
  C('ceva ieftin in centru', { near: 'centru', maxPrice: 50, noChain: true }),
  C('sub 50 lei', { maxPrice: 50, noChain: true }),
  C('cina romantica', { cats: ['mancare', 'bar', 'cafea'], notKinds: ['fast_food'], noChain: true }),
  C('in doi diseara floreasca', { near: 'floreasca', notClosed: true, notKinds: ['fast_food'] }),
  // names: joined or split, typos. Chains are not among the chosen places (decision Cornel, 05.10): nothing pretends
  // to be one, and with a place in the search the good places there come instead
  C('mc donalds', { absent: /McDonald/, n: 0 }),
  C('mcdonalds', { absent: /McDonald/, n: 0 }),
  C('kfc unirii', { absent: /KFC/, near: 'unirii', n: 1 }),
  C('starbucks', { absent: /Starbucks/, n: 0 }),
  C('beraria h', { first: /Berăria H/ }),
  C('kultur haus', { first: /Kulturhaus/ }),
  C('teos tonics', { first: /Teo's Tonics/ }),
  C('caru cu bere', { first: /Caru' cu Bere/ }),
  C('carucubere', { first: /Caru' cu Bere/ }),
  C('hanu berarilor', { first: /Hanu/ }),
  C('green hours', { first: /Green Hours/ }),
  C('biliard', { kinds: ['billiards'], n: 2 }),
];
