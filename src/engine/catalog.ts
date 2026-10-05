import type { Cat, Vibe, Zone } from './types';
import zonesJson from '../data/zones.json';

// Starting points. Coordinates are approximate centres, used only to measure distance.
export const ZONES: Zone[] = zonesJson as Zone[];

export const VIBES: Vibe[] = ['Mâncare bună', 'Chill', 'Party', 'Fun', 'Competitiv', 'Cultură', 'Aer liber'];

export const CAT_LABEL: Record<Cat, string> = {
  mancare: 'Mâncare', cafea: 'Cafea', desert: 'Desert', bar: 'Bar', club: 'Club',
  film: 'Film', teatru: 'Teatru', cultura: 'Cultură', activitate: 'Activitate', natura: 'Natură', sport: 'Sport',
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
  aquarium: K('Acvariu', 'activitate', ['Fun'], 40, 1.5, 1, 12, 0),
  karting: K('Karting', 'activitate', ['Fun', 'Competitiv'], 80, 1, 1, 12, 1),
  paintball: K('Paintball', 'activitate', ['Fun', 'Competitiv', 'Aer liber'], 100, 2, 4, 20, 0),
  billiards: K('Biliard', 'activitate', ['Fun', 'Competitiv', 'Chill'], 30, 1.5, 2, 8, 1),
  planetarium: K('Planetariu', 'cultura', ['Cultură'], 30, 1.5, 1, 12, 0),
  castle: K('Castel', 'cultura', ['Cultură', 'Aer liber'], 25, 2, 1, 20, 0),
  palace: K('Palat', 'cultura', ['Cultură'], 30, 1.5, 1, 20, 0),
  manor: K('Conac', 'cultura', ['Cultură', 'Aer liber'], 15, 1.5, 1, 20, 0),
  monastery: K('Mănăstire', 'cultura', ['Cultură', 'Aer liber'], 0, 1.5, 1, 20, 0),
  // outdoors: parks are free; nobody needs a booking for a walk
  park: K('Parc', 'natura', ['Aer liber', 'Chill'], 0, 1.5, 1, 30, 0),
  // where people gather (curated.json, 05.10): squares with events, promenades, food markets
  square: K('Loc de întâlnire', 'natura', ['Aer liber', 'Chill', 'Party'], 0, 1.5, 1, 60, 1),
  promenade: K('Promenadă', 'natura', ['Aer liber', 'Chill'], 0, 1.5, 1, 30, 1),
  food_market: K('Food market', 'mancare', ['Mâncare bună', 'Chill', 'Fun'], 60, 1.5, 1, 20, 1),
  event_space: K('Spațiu de evenimente', 'cultura', ['Cultură', 'Fun', 'Party'], 60, 2.5, 1, 50, 1),
  nature_reserve: K('Rezervație naturală', 'natura', ['Aer liber'], 0, 2.5, 1, 20, 0),
  botanical_garden: K('Grădină botanică', 'natura', ['Aer liber', 'Chill'], 15, 1.5, 1, 20, 0),
  beach_resort: K('Plajă', 'natura', ['Aer liber', 'Chill'], 40, 4, 1, 20, 0),
  // sport: prices are per person for a court shared the usual way (padel 4, football 10)
  padel: K('Padel', 'sport', ['Competitiv', 'Fun'], 60, 1.5, 2, 4, 1),
  tennis: K('Tenis', 'sport', ['Competitiv'], 50, 1.5, 2, 4, 0),
  soccer: K('Fotbal', 'sport', ['Competitiv', 'Fun'], 30, 1.5, 2, 14, 1),
  squash: K('Squash', 'sport', ['Competitiv'], 50, 1, 2, 4, 1),
  swimming: K('Piscină', 'sport', ['Fun'], 50, 2, 1, 12, 0),
  climbing: K('Escaladă', 'sport', ['Competitiv', 'Fun'], 60, 2, 1, 8, 1),
  golf_course: K('Golf', 'sport', ['Competitiv', 'Aer liber'], 150, 3, 1, 4, 0),
  horse_riding: K('Călărie', 'sport', ['Aer liber', 'Fun'], 150, 1.5, 1, 6, 0),
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

/**
 * What people type, grouped by meaning. Every alias is folded (no diacritics, lower case) and may have several words.
 * kinds/cats/cuisines say which venues fit; hint is a pattern for the folded venue name (OSM often lacks the cuisine);
 * related are kinds to offer instead when the city has none (there is no bowling alley mapped yet, for example).
 */
export interface Topic {
  label: string; words: string[];
  kinds?: string[]; cats?: Cat[]; cuisines?: string[]; hint?: string; related?: string[];
  vibe?: Vibe; hour?: number;
}
const T = (label: string, words: string, more: Omit<Topic, 'label' | 'words'>): Topic => ({ label, words: words.split(',').map((w) => w.trim()), ...more });

export const TOPICS: Record<string, Topic> = {
  // food
  pizza: T('Pizza', 'pizza,pizze,pizzerie,pizzerii,pizzeria,piza,pitza,pizzarie', { cuisines: ['pizza', 'italian_pizza'], hint: 'pizz' }),
  burger: T('Burgeri', 'burger,burgeri,burgers,burgerii,hamburger,hamburgeri,burgar,burgari', { cuisines: ['burger'], hint: 'burger' }),
  sushi: T('Sushi', 'sushi', { cuisines: ['sushi', 'japanese'], hint: 'sushi' }),
  japonez: T('Japonez', 'japonez,japoneza,japoneze,japonezesc,ramen', { cuisines: ['japanese', 'sushi', 'noodle'], hint: 'ramen|sushi' }),
  italian: T('Italian', 'italian,italiana,italieneasca,italienesc,paste,pasta,trattoria,osteria', { cuisines: ['italian', 'pasta', 'italian_pizza', 'pizza'], hint: 'trattori|osteri|italian' }),
  romanesc: T('Românesc', 'romanesc,romaneasca,romanesti,traditional,traditionala,traditionale,mici,sarmale,ciorba,ciorbe,mamaliga,crama', { cuisines: ['romanian', 'regional', 'local', 'balkan', 'soup'], hint: '\\bhanu?\\b|crama|ciorb|traditional|romanesc|mici\\b' }),
  grecesc: T('Grecesc', 'grecesc,greceasca,grecesti,grec,greek,gyros', { cuisines: ['greek'], hint: 'gyros|greek|grec' }),
  turcesc: T('Turcesc', 'turcesc,turceasca,turc,turkish', { cuisines: ['turkish'], hint: 'turk|istanbul|taksim' }),
  libanez: T('Libanez', 'libanez,libaneza,libaneze,arab,araba,arabesc,arabeasca,oriental,orientala,falafel,hummus,humus', { cuisines: ['lebanese', 'arab', 'middle_eastern'], hint: 'falafel|leban|liban|beirut' }),
  asiatic: T('Asiatic', 'asiatic,asiatica,asiatice,asian,wok,noodles', { cuisines: ['asian', 'chinese', 'thai', 'vietnamese', 'korean', 'japanese', 'noodle'], hint: 'wok|noodle|asia' }),
  chinezesc: T('Chinezesc', 'chinezesc,chinezeasca,chinezesti,chinez,chinezi,chinese', { cuisines: ['chinese'], hint: 'chin|beijing|shanghai' }),
  thai: T('Thailandez', 'thai,thailandez,thailandeza', { cuisines: ['thai'], hint: '\\bthai\\b' }),
  vietnamez: T('Vietnamez', 'vietnamez,vietnameza,pho', { cuisines: ['vietnamese'], hint: 'pho\\b|viet|saigon|hanoi' }),
  coreean: T('Coreean', 'coreean,coreeana,korean', { cuisines: ['korean'], hint: 'korea|seoul' }),
  indian: T('Indian', 'indian,indiana,indiene,curry', { cuisines: ['indian'], hint: 'india|curry|masala|tandoor' }),
  mexican: T('Mexican', 'mexican,mexicana,mexicane,tacos,taco,burrito,burritos,texmex,tex mex', { cuisines: ['mexican', 'tex-mex'], hint: 'taco|mexic|burrito' }),
  american: T('American', 'american,americana', { cuisines: ['american', 'burger'] }),
  steak: T('Steakhouse', 'steak,steakhouse,friptura,fripturi,vita', { cuisines: ['steak_house', 'grill', 'barbecue'], hint: 'steak' }),
  peste: T('Pește', 'peste,fructe de mare,seafood,pescarie,creveti', { cuisines: ['seafood', 'fish'], hint: '\\bpesc|\\bpeste\\b|fish|crevet|seafood' }),
  kebab: T('Shaorma și kebab', 'kebab,kebap,kebabi,doner,durum,shaorma,saorma,shaworma,shawarma,shaormerie,shaormerii,saormerie', { cuisines: ['kebab', 'shawarma'], hint: 'shaorm|saorm|kebab|kebap|doner|shawarma' }),
  vegan: T('Vegan', 'vegan,vegana,vegane,plant based', { cuisines: ['vegan'], hint: 'vegan' }),
  vegetarian: T('Vegetarian', 'vegetarian,vegetariana,vegetariene,vegetariana', { cuisines: ['vegetarian', 'vegan'], hint: 'vegan|veggie|vegetar' }),
  gratar: T('Grătar', 'gratar,gratare,grill,bbq,barbecue', { cuisines: ['grill', 'barbecue', 'bbq'], hint: 'grill|gratar|bbq' }),
  pui: T('Pui', 'pui,aripioare,chicken,wings', { cuisines: ['chicken'], hint: 'chicken|\\bpui\\b|wings' }),
  salata: T('Salate', 'salata,salate,healthy,sanatos,sanatoasa,poke,bowl,bowls', { cuisines: ['salad', 'poke'], hint: 'salad|poke|healthy|bowl' }),
  sandvis: T('Sandvișuri', 'sandvis,sandvisuri,sandwich,sandwiches,sendvis', { cuisines: ['sandwich'], hint: 'sandwich|sandvis' }),
  frantuzesc: T('Franțuzesc', 'frantuzesc,frantuzeasca,francez,franceza,french', { cuisines: ['french'], hint: 'french|paris|brasserie' }),
  spaniol: T('Spaniol', 'spaniol,spaniola,tapas', { cuisines: ['spanish', 'tapas'], hint: 'tapas|spani' }),
  bistro: T('Bistro', 'bistro,bistrou,bistrouri', { cuisines: ['bistro'], hint: 'bistr' }),
  brunch: T('Brunch', 'brunch,mic dejun,micul dejun,breakfast,oua,eggs', { cuisines: ['brunch', 'breakfast'], hint: 'brunch|breakfast|eggs|\\boua\\b', related: ['cafe', 'restaurant'], hour: 11 }),
  fastfood: T('Fast food', 'fast food,fastfood,fast', { kinds: ['fast_food'] }),
  restaurant: T('Restaurant', 'restaurant,restaurante,restaurantul,resturant', { kinds: ['restaurant'] }),
  mancare: T('Mâncare', 'mancare,mancam,mananc,papa,cina,foame,mancarica', { cats: ['mancare'] }),
  cafe: T('Cafenea', 'cafea,cafele,cafenea,cafenele,cafeneaua,cafeluta,coffee,espresso,cappuccino,latte,coffeeshop,coffee shop', { kinds: ['cafe'], hint: 'coffee|caffe|espresso' }),
  ceai: T('Ceai', 'ceai,ceaiuri,ceainarie,ceainarii,tea,bubble tea', { cuisines: ['tea', 'bubble_tea'], hint: '\\btea\\b|ceai|bubble', related: ['cafe'] }),
  desert: T('Desert', 'desert,deserturi,dulce,dulciuri,prajitura,prajituri,cofetarie,cofetarii,patiserie,tort,torturi,clatite,gogosi,cake,cheesecake,ciocolata', { cats: ['desert'], cuisines: ['cake', 'dessert', 'ice_cream', 'pancake', 'crepe', 'donut', 'chocolate'], hint: 'cofet|patiser|cake|dulce|sweet|clatit|gogos|desert|ciocolat|crep' }),
  inghetata: T('Înghețată', 'inghetata,inghetate,gelato,gelaterie,gelaterii,ice cream', { kinds: ['ice_cream'], cuisines: ['ice_cream'], hint: 'gelat|ice cream|inghet' }),
  // drinks and night
  bar: T('Bar', 'bar,baruri,barul,barulet,lounge', { kinds: ['bar'] }),
  pub: T('Pub', 'pub,puburi,irish pub', { kinds: ['pub'] }),
  bere: T('Bere', 'bere,beri,berarie,berarii,beer,craft,gradina de bere,biergarten', { kinds: ['pub', 'biergarten', 'bar'], hint: 'bere\\b|beer|brew|berar' }),
  cocktail: T('Cocktailuri', 'cocktail,cocktailuri,cocteil,cocteiluri,cocktails,coctail,coctailuri,mixology', { kinds: ['bar'], hint: 'cocktail|mixolog' }),
  vin: T('Vin', 'vin,vinuri,wine,wine bar,vinoteca,enoteca', { kinds: ['bar', 'restaurant'], hint: 'wine|\\bvin|enotec|vinote|crama', related: ['bar'] }),
  shisha: T('Narghilea', 'shisha,narghilea,narghilele,narghile,hookah', { cuisines: ['shisha'], hint: 'shisha|hookah|narghil', related: ['bar'] }),
  club: T('Club', 'club,cluburi,clubul,disco,discoteca,discoteci,dans,dansam,clubbing', { kinds: ['nightclub'] }),
  party: T('Party', 'party,petrecere,chef,distractie de noapte,dansat', { kinds: ['nightclub', 'bar', 'pub'], vibe: 'Party' }),
  karaoke: T('Karaoke', 'karaoke,caraoke', { hint: 'karaoke', related: ['bar', 'pub', 'nightclub'] }),
  jazz: T('Jazz', 'jazz,jazz bar,blues', { hint: 'jazz|blues', related: ['bar', 'pub', 'cafe'] }),
  live: T('Muzică live', 'muzica live,live,concert,concerte,rock', { kinds: ['bar', 'pub', 'nightclub', 'cafe', 'arts_centre'], hint: 'jazz|live|music|muzic|rock|blues' }),
  rooftop: T('Rooftop', 'rooftop,sky bar,skybar,panorama,la inaltime', { kinds: ['bar', 'restaurant', 'cafe'], hint: 'rooftop|sky|panoram|upstairs' }),
  // culture
  film: T('Film', 'film,filme,filmul,cinema,cinematograf,cinematografe,movie,movies,imax', { kinds: ['cinema'] }),
  teatru: T('Teatru', 'teatru,teatre,piesa,piesa de teatru,spectacol,spectacole,balet,filarmonica', { kinds: ['theatre', 'arts_centre'] }),
  opera: T('Operă', 'opera,opere,opereta', { kinds: ['theatre'], hint: '\\bopera' }),
  standup: T('Stand-up', 'stand up,standup,stand-up,comedie,comedy', { kinds: ['theatre', 'bar', 'nightclub', 'arts_centre'], hint: 'comed|stand|comics' }),
  muzeu: T('Muzeu', 'muzeu,muzee,muzeul,muzeele,museum', { kinds: ['museum', 'gallery'] }),
  galerie: T('Artă', 'galerie,galerii,galeria,arta,art,galerie de arta,expozitie,expozitii', { kinds: ['gallery', 'arts_centre', 'museum'] }),
  cultura: T('Cultură', 'cultura,cultural,culturala,culturale', { cats: ['cultura', 'teatru'] }),
  // things to do
  bowling: T('Bowling', 'bowling,popice', { kinds: ['bowling_alley'], hint: 'bowling', related: ['amusement_arcade', 'escape_game', 'ice_rink'] }),
  escape: T('Escape room', 'escape,escape room,escaperoom,escape rooms,camera de evadare', { kinds: ['escape_game'], hint: 'escape' }),
  arcade: T('Jocuri', 'arcade,jocuri,gaming,jocuri video,vr,realitate virtuala,laser tag,lasertag,laser', { kinds: ['amusement_arcade'], hint: 'laser|\\bvr\\b|game|arcade|play' }),
  paintball: T('Paintball', 'paintball,airsoft', { kinds: ['paintball'], hint: 'paintball|airsoft', related: ['amusement_arcade', 'karting'] }),
  biliard: T('Biliard', 'biliard,snooker,darts,ping pong', { kinds: ['billiards'], hint: 'biliard|snooker|darts|\\bpool\\b', related: ['pub', 'bar', 'amusement_arcade'] }),
  trambuline: T('Trambuline', 'trambuline,trambulina,trampoline', { kinds: ['trampoline_park'], hint: 'trambul|trampolin|jump', related: ['amusement_arcade', 'theme_park'] }),
  minigolf: T('Minigolf', 'minigolf,mini golf', { kinds: ['miniature_golf'], hint: 'mini ?golf', related: ['amusement_arcade'] }),
  golf: T('Golf', 'golf,teren de golf', { kinds: ['golf_course', 'miniature_golf'], hint: 'golf' }),
  karting: T('Karting', 'karting,carting,kart', { kinds: ['karting'], hint: 'kart', related: ['amusement_arcade', 'theme_park'] }),
  patinoar: T('Patinoar', 'patinoar,patinoare,patinaj,patine,skating', { kinds: ['ice_rink'] }),
  aquapark: T('Ștrand', 'aquapark,acvapark,aqua park,parc acvatic,strand,stranduri', { kinds: ['water_park', 'beach_resort'], related: ['swimming'] }),
  piscina: T('Piscină', 'piscina,piscine,bazin,inot,inotat,swimming', { kinds: ['swimming', 'water_park'], hint: 'piscin|aqua|swim|inot' }),
  lunapark: T('Parc de distracții', 'parc de distractii,lunapark,luna park,carusel,parc tematic', { kinds: ['theme_park'] }),
  zoo: T('Zoo', 'zoo,gradina zoologica,animale', { kinds: ['zoo'] }),
  acvariu: T('Acvariu', 'acvariu,acvarii,aquarium,pesti', { kinds: ['aquarium'], related: ['zoo', 'museum'] }),
  padel: T('Padel', 'padel,paddle', { kinds: ['padel'], hint: 'padel', related: ['tennis', 'squash'] }),
  tenis: T('Tenis', 'tenis,tennis,teren de tenis', { kinds: ['tennis'], hint: 'tenis|tennis', related: ['padel', 'squash'] }),
  fotbal: T('Fotbal', 'fotbal,minifotbal,fotbal in 5,teren de fotbal,football,soccer', { kinds: ['soccer'], hint: 'fotbal|football|soccer|arena', related: ['padel', 'tennis'] }),
  squash: T('Squash', 'squash', { kinds: ['squash'], hint: 'squash', related: ['padel', 'tennis'] }),
  escalada: T('Escaladă', 'escalada,catarare,climbing,bouldering,perete de escalada', { kinds: ['climbing'], hint: 'climb|bouldering|escalad|catara', related: ['trampoline_park'] }),
  calarie: T('Călărie', 'calarie,calarit,cai,echitatie,manej', { kinds: ['horse_riding'], hint: 'equestr|ecvestr|horse|cai\\b|calari|manej' }),
  sport: T('Sport', 'sport,sporturi,miscare,teren,terenuri', { cats: ['sport'] }),
  // outdoors and sights
  parc: T('Parc', 'parc,parcuri,parcul,plimbare,plimbari,plimbam,promenada,park', { kinds: ['park', 'botanical_garden'] }),
  natura: T('Natură', 'natura,padure,paduri,lac,lacuri,iarba,picnic', { cats: ['natura'] }),
  plaja: T('Plajă', 'plaja,plaje,beach,sezlong', { kinds: ['beach_resort', 'water_park'], hint: 'beach|plaj' }),
  gradinabotanica: T('Grădină botanică', 'gradina botanica,botanica,flori', { kinds: ['botanical_garden', 'park'] }),
  castel: T('Castele și palate', 'castel,castele,palat,palate,palatul,conac,conace,cula,curte domneasca', { kinds: ['castle', 'palace', 'manor'], hint: 'castel|palat|conac|cula\\b' }),
  manastire: T('Mănăstire', 'manastire,manastiri,manastirea,schit,schituri', { kinds: ['monastery'], hint: 'manastir|schit' }),
  planetariu: T('Planetariu', 'planetariu,planetarium,stele,astronomie,observator', { kinds: ['planetarium'], related: ['museum'] }),
  boardgames: T('Jocuri de societate', 'board games,boardgames,jocuri de societate,board game', { hint: 'board|joc', related: ['cafe', 'pub'] }),
  activitate: T('Activitate', 'activitate,activitati,distractie,distractii,ceva activ,joaca', { cats: ['activitate', 'sport'] }),
  // moods
  chill: T('Chill', 'chill,linistit,linistita,liniste,relaxant,relax', { vibe: 'Chill' }),
};

/** Neighbourhoods, sectors, malls and towns people name, with how far around them still counts (km). */
export interface Place { id: string; name: string; words: string[]; lat: number; lon: number; r: number; zone?: string; }
const P = (id: string, name: string, words: string, lat: number, lon: number, r: number, zone?: string): Place => ({ id, name, words: words.split(',').map((w) => w.trim()), lat, lon, r, zone });
export const PLACES: Place[] = [
  P('s1', 'Sectorul 1', 'sector 1,sectorul 1,sect 1,s1,sector unu', 44.47, 26.07, 4.5, 's1'),
  P('s2', 'Sectorul 2', 'sector 2,sectorul 2,sect 2,s2,sector doi', 44.453, 26.138, 4, 's2'),
  P('s3', 'Sectorul 3', 'sector 3,sectorul 3,sect 3,s3,sector trei', 44.42, 26.15, 4, 's3'),
  P('s4', 'Sectorul 4', 'sector 4,sectorul 4,sect 4,s4,sector patru', 44.38, 26.115, 4, 's4'),
  P('s5', 'Sectorul 5', 'sector 5,sectorul 5,sect 5,s5,sector cinci', 44.39, 26.06, 4, 's5'),
  P('s6', 'Sectorul 6', 'sector 6,sectorul 6,sect 6,s6,sector sase', 44.435, 26.025, 4, 's6'),
  P('centru', 'Centrul Vechi', 'centru,centrul,centrul vechi,centru vechi,old town,lipscani,in centru', 44.4312, 26.101, 1.6, 'centru'),
  P('universitate', 'Universitate', 'universitate,universitatii,piata universitatii', 44.4355, 26.1025, 1.2),
  P('unirii', 'Unirii', 'unirii,piata unirii,unirea', 44.4268, 26.104, 1.3),
  P('romana', 'Piața Romană', 'romana,piata romana,magheru', 44.4465, 26.0975, 1.1),
  P('victoriei', 'Piața Victoriei', 'victoriei,piata victoriei,calea victoriei', 44.4485, 26.088, 1.3),
  P('amzei', 'Amzei', 'amzei,piata amzei', 44.4435, 26.0955, 0.8),
  P('cismigiu', 'Cișmigiu', 'cismigiu,parcul cismigiu', 44.437, 26.0905, 1),
  P('cotroceni', 'Cotroceni', 'cotroceni,eroilor', 44.4345, 26.068, 1.5),
  P('afi', 'AFI Cotroceni', 'afi,afi cotroceni,afi mall', 44.4305, 26.0525, 0.7),
  P('floreasca', 'Floreasca', 'floreasca,lacul floreasca', 44.466, 26.102, 1.6),
  P('dorobanti', 'Dorobanți', 'dorobanti,dorobantilor,calea dorobanti', 44.455, 26.095, 1.2),
  P('primaverii', 'Primăverii', 'primaverii,bulevardul primaverii', 44.4665, 26.0885, 1),
  P('aviatorilor', 'Aviatorilor', 'aviatorilor,piata aviatorilor', 44.4605, 26.0855, 1),
  P('herastrau', 'Herăstrău', 'herastrau,parcul herastrau,parcul regele mihai,regele mihai,kiseleff', 44.4715, 26.0815, 1.6),
  P('baneasa', 'Băneasa', 'baneasa,baneasa shopping city', 44.4985, 26.082, 2),
  P('pipera', 'Pipera', 'pipera,barbu vacarescu,globalworth', 44.4865, 26.113, 2.2),
  P('aviatiei', 'Aviației', 'aviatiei,cartierul aviatiei,promenada', 44.4805, 26.1015, 1.2),
  P('tei', 'Tei', 'tei,lacul tei', 44.461, 26.123, 1.3),
  P('colentina', 'Colentina', 'colentina', 44.4615, 26.14, 1.8),
  P('obor', 'Obor', 'obor,piata obor,mosilor,calea mosilor', 44.449, 26.124, 1.3),
  P('stefan', 'Ștefan cel Mare', 'stefan cel mare', 44.4505, 26.1065, 1),
  P('iancului', 'Iancului', 'iancului,muncii,piata muncii,mega mall', 44.4405, 26.143, 1.3),
  P('pantelimon', 'Pantelimon', 'pantelimon', 44.446, 26.165, 2.5, 'pantelimon'),
  P('titan', 'Titan', 'titan,balta alba,parcul titan,liviu rebreanu,park lake,parklake', 44.4195, 26.16, 1.7),
  P('dristor', 'Dristor', 'dristor,mihai bravu', 44.4235, 26.137, 1.2),
  P('vitan', 'Vitan', 'vitan,vitan mall', 44.4155, 26.13, 1.4),
  P('tineretului', 'Tineretului', 'tineretului,parcul tineretului,timpuri noi', 44.4115, 26.108, 1.4),
  P('berceni', 'Berceni', 'berceni,oltenitei,sun plaza', 44.3835, 26.125, 2),
  P('giurgiului', 'Giurgiului', 'giurgiului,soseaua giurgiului', 44.3895, 26.093, 1.5),
  P('rahova', 'Rahova', 'rahova,ferentari', 44.403, 26.068, 1.8),
  P('13sept', '13 Septembrie', '13 septembrie', 44.4205, 26.07, 1.2),
  P('ghencea', 'Ghencea', 'ghencea', 44.413, 26.035, 1.6),
  P('drumul', 'Drumul Taberei', 'drumul taberei,drumu taberei,taberei', 44.4225, 26.035, 1.8),
  P('militari', 'Militari', 'militari,iuliu maniu,gorjului,pacii,lujerului,plaza romania', 44.4335, 26.02, 2.2),
  P('crangasi', 'Crângași', 'crangasi,giulesti', 44.4525, 26.045, 1.4),
  P('grozavesti', 'Grozăvești', 'grozavesti,regie,politehnica', 44.4425, 26.06, 1.2),
  P('bucurestii', 'Bucureștii Noi', 'bucurestii noi,damaroaia,1 mai,parcul bazilescu', 44.48, 26.045, 1.8),
  P('voluntari', 'Voluntari', 'voluntari', 44.49, 26.17, 3, 'voluntari'),
  P('otopeni', 'Otopeni', 'otopeni,aeroport', 44.55, 26.07, 3, 'otopeni'),
  P('buftea', 'Buftea', 'buftea', 44.568, 25.948, 3, 'buftea'),
  P('chitila', 'Chitila', 'chitila', 44.508, 25.982, 2.5, 'chitila'),
  P('mogosoaia', 'Mogoșoaia', 'mogosoaia', 44.529, 25.999, 2.5, 'mogosoaia'),
  P('corbeanca', 'Corbeanca', 'corbeanca,tunari', 44.603, 26.035, 3, 'corbeanca'),
  P('popesti', 'Popești-Leordeni', 'popesti,popesti leordeni', 44.38, 26.17, 3, 'popesti'),
  P('bragadiru', 'Bragadiru', 'bragadiru', 44.37, 25.975, 3, 'bragadiru'),
  P('chiajna', 'Chiajna', 'chiajna,rosu', 44.455, 25.975, 2.5, 'chiajna'),
  P('snagov', 'Snagov', 'snagov,lacul snagov', 44.7, 26.17, 6, 'snagov'),
  P('magurele', 'Măgurele', 'magurele', 44.35, 26.03, 3, 'magurele'),
];

/** Words that carry no meaning for search (Romanian filler, how people phrase a question on the phone). */
export const STOP = new Set(('cu si in la de pe pt pentru din un o niste ceva unde ies iesim iesit iesire merg mergem mergeti vreau vrem as am ai are '
  + 'caut cautam cauta gasesc gaseste bun buna bune buni bunicel fain faina faine misto top cel cea cei cele mai foarte '
  + 'recomanda recomandare recomandari recomanzi ce fac facem sa se e este sunt care ne noi eu tu imi mi ma putem poate '
  + 'acolo aici ok va rog pls please the a al ale lui sau ori frumos frumoasa cool tare place plac zona cartier cartierul langa aproape '
  + 'prin spre loc locuri localuri local localul ora orele nu da hai haide si ar fi bine ceva idei idee pot nou noua noi '
  + 'oras orasul bucuresti buc ilfov').split(/\s+/));

/** Romanian number words up to twenty, for "gașcă de șase". */
export const NUMBERS: Record<string, number> = {
  unu: 1, una: 1, doi: 2, doua: 2, trei: 3, patru: 4, cinci: 5, sase: 6, sapte: 7, opt: 8, noua: 9, zece: 10,
  unsprezece: 11, doisprezece: 12, cincisprezece: 15, douazeci: 20,
};

/** Short forms people use for well-known places: replaced before the name match. */
export const NAME_ALIASES: Record<string, string> = {
  tnb: 'teatrul national', mcd: 'mcdonalds', mec: 'mcdonalds', meki: 'mcdonalds', antipa: 'muzeul grigore antipa',
  'muzeul satului': 'muzeul national al satului', bulandra: 'teatrul bulandra', odeon: 'teatrul odeon', nottara: 'teatrul nottara',
};
