import type { Cat, Vibe, Zone } from './types';
import zonesJson from '../data/zones.json';

// Starting points. Coordinates are approximate centres, used only to measure distance.
export const ZONES: Zone[] = zonesJson as Zone[];

export const VIBES: Vibe[] = ['Mâncare bună', 'Chill', 'Party', 'Fun', 'Competitiv', 'Cultură', 'Aer liber'];

export const CAT_LABEL: Record<Cat, string> = {
  mancare: 'Mâncare', cafea: 'Cafea', desert: 'Desert', bar: 'Bar', club: 'Club',
  film: 'Film', teatru: 'Teatru', cultura: 'Cultură', activitate: 'Activitate',
};

/** Per-kind facts the map does not hold. Prices are estimates per person, in lei. */
export interface KindInfo { label: string; cat: Cat; vibes: Vibe[]; price: number; hours: number; min: number; max: number; night: number; }
const K = (label: string, cat: Cat, vibes: Vibe[], price: number, hours: number, min: number, max: number, night: number): KindInfo => ({ label, cat, vibes, price, hours, min, max, night });

// night: 0 = daytime thing, 1 = evening, 2 = late night
export const KINDS: Record<string, KindInfo> = {
  restaurant: K('Restaurant', 'mancare', ['Mâncare bună'], 90, 1.5, 1, 12, 1),
  fast_food: K('Fast food', 'mancare', ['Mâncare bună'], 40, 0.75, 1, 8, 1),
  cafe: K('Cafenea', 'cafea', ['Chill'], 30, 1, 1, 6, 0),
  ice_cream: K('Gelaterie', 'desert', ['Chill'], 25, 0.75, 1, 6, 0),
  bar: K('Bar', 'bar', ['Chill', 'Party'], 70, 2, 1, 12, 1),
  pub: K('Pub', 'bar', ['Chill', 'Fun'], 65, 2, 1, 12, 1),
  biergarten: K('Grădină de bere', 'bar', ['Chill', 'Aer liber'], 65, 2.5, 2, 20, 1),
  nightclub: K('Club', 'club', ['Party'], 90, 4, 1, 12, 2),
  cinema: K('Cinema', 'film', ['Chill', 'Cultură'], 40, 2.5, 1, 20, 1),
  theatre: K('Teatru', 'teatru', ['Cultură'], 80, 2.5, 1, 12, 1),
  arts_centre: K('Centru cultural', 'cultura', ['Cultură'], 30, 2, 1, 12, 1),
  museum: K('Muzeu', 'cultura', ['Cultură'], 25, 1.5, 1, 12, 0),
  gallery: K('Galerie', 'cultura', ['Cultură', 'Chill'], 10, 1, 1, 8, 0),
  bowling_alley: K('Bowling', 'activitate', ['Fun', 'Competitiv'], 55, 2, 2, 12, 1),
  escape_game: K('Escape room', 'activitate', ['Fun', 'Competitiv'], 80, 1.5, 2, 6, 1),
  amusement_arcade: K('Jocuri arcade', 'activitate', ['Fun', 'Competitiv'], 50, 1.5, 1, 10, 1),
  trampoline_park: K('Trambuline', 'activitate', ['Fun'], 60, 1.5, 1, 12, 0),
  miniature_golf: K('Minigolf', 'activitate', ['Fun', 'Competitiv', 'Aer liber'], 40, 1.5, 2, 8, 0),
  ice_rink: K('Patinoar', 'activitate', ['Fun'], 40, 1.5, 1, 12, 1),
  water_park: K('Parc acvatic', 'activitate', ['Fun', 'Aer liber'], 130, 5, 1, 12, 0),
  theme_park: K('Parc de distracții', 'activitate', ['Fun', 'Aer liber'], 100, 4, 1, 12, 0),
  zoo: K('Grădină zoologică', 'activitate', ['Aer liber'], 20, 2.5, 1, 20, 0),
};

/** Cuisine keys we show, with the Romanian label. Other cuisine values are kept but not labelled. */
export const CUISINES: Record<string, string> = {
  pizza: 'Pizza', burger: 'Burgeri', sushi: 'Sushi', japanese: 'Japonez', italian: 'Italian',
  romanian: 'Românesc', regional: 'Românesc', greek: 'Grecesc', turkish: 'Turcesc', lebanese: 'Libanez',
  asian: 'Asiatic', chinese: 'Chinezesc', thai: 'Thailandez', indian: 'Indian', mexican: 'Mexican',
  american: 'American', steak_house: 'Steakhouse', seafood: 'Pește', kebab: 'Kebab', shawarma: 'Shaorma',
  vegan: 'Vegan', vegetarian: 'Vegetarian', french: 'Franțuzesc', spanish: 'Spaniol', coffee_shop: 'Cafea',
  cake: 'Prăjituri', dessert: 'Desert', ice_cream: 'Înghețată', bbq: 'Grătar', grill: 'Grătar', chicken: 'Pui',
  sandwich: 'Sandvișuri', breakfast: 'Mic dejun', middle_eastern: 'Oriental', korean: 'Coreean', vietnamese: 'Vietnamez',
};

/** Words people type, mapped to what they mean. Keys are already folded (no diacritics, lower case). */
export const SYNONYMS: Record<string, { kind?: string[]; cuisine?: string[]; cat?: Cat[]; vibe?: string; outdoor?: boolean }> = {
  pizza: { cuisine: ['pizza'] }, pizzerie: { cuisine: ['pizza'] }, burger: { cuisine: ['burger'] }, burgeri: { cuisine: ['burger'] },
  sushi: { cuisine: ['sushi', 'japanese'] }, japonez: { cuisine: ['japanese', 'sushi'] }, italian: { cuisine: ['italian', 'pizza'] },
  romanesc: { cuisine: ['romanian', 'regional'] }, traditional: { cuisine: ['romanian', 'regional'] }, grecesc: { cuisine: ['greek'] },
  turcesc: { cuisine: ['turkish'] }, libanez: { cuisine: ['lebanese'] }, asiatic: { cuisine: ['asian', 'chinese', 'thai', 'vietnamese', 'korean'] },
  chinezesc: { cuisine: ['chinese'] }, thai: { cuisine: ['thai'] }, indian: { cuisine: ['indian'] }, mexican: { cuisine: ['mexican'] },
  steak: { cuisine: ['steak_house'] }, peste: { cuisine: ['seafood'] }, kebab: { cuisine: ['kebab', 'shawarma'] }, shaorma: { cuisine: ['shawarma', 'kebab'] },
  vegan: { cuisine: ['vegan'] }, vegetarian: { cuisine: ['vegetarian', 'vegan'] }, gratar: { cuisine: ['bbq', 'grill'] }, grill: { cuisine: ['bbq', 'grill'] },
  mancare: { cat: ['mancare'] }, restaurant: { kind: ['restaurant'] }, restaurante: { kind: ['restaurant'] }, fastfood: { kind: ['fast_food'] },
  cafea: { cat: ['cafea'] }, cafenea: { cat: ['cafea'] }, cafenele: { cat: ['cafea'] }, coffee: { cat: ['cafea'] },
  desert: { cat: ['desert'], cuisine: ['cake', 'dessert', 'ice_cream'] }, inghetata: { kind: ['ice_cream'] }, prajituri: { cuisine: ['cake', 'dessert'] }, cofetarie: { cuisine: ['cake', 'dessert'] },
  bar: { kind: ['bar'] }, baruri: { kind: ['bar'] }, pub: { kind: ['pub'] }, bere: { kind: ['pub', 'biergarten', 'bar'] }, cocktail: { kind: ['bar'] }, cocktailuri: { kind: ['bar'] },
  club: { kind: ['nightclub'] }, cluburi: { kind: ['nightclub'] }, party: { vibe: 'Party' }, dans: { kind: ['nightclub'] },
  film: { kind: ['cinema'] }, cinema: { kind: ['cinema'] }, filme: { kind: ['cinema'] }, teatru: { kind: ['theatre'] }, spectacol: { kind: ['theatre', 'arts_centre'] },
  muzeu: { kind: ['museum'] }, muzee: { kind: ['museum'] }, galerie: { kind: ['gallery'] }, arta: { kind: ['gallery', 'arts_centre', 'museum'] }, cultura: { cat: ['cultura', 'teatru'] },
  bowling: { kind: ['bowling_alley'] }, escape: { kind: ['escape_game'] }, escaperoom: { kind: ['escape_game'] }, arcade: { kind: ['amusement_arcade'] },
  trambuline: { kind: ['trampoline_park'] }, minigolf: { kind: ['miniature_golf'] }, patinoar: { kind: ['ice_rink'] }, patinaj: { kind: ['ice_rink'] },
  aquapark: { kind: ['water_park'] }, zoo: { kind: ['zoo'] }, distractie: { cat: ['activitate'] }, activitati: { cat: ['activitate'] },
  terasa: { outdoor: true }, afara: { outdoor: true }, gradina: { outdoor: true },
  chill: { vibe: 'Chill' }, linistit: { vibe: 'Chill' }, romantic: { vibe: 'Chill' },
};
