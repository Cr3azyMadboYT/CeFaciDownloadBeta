// The app's season (decision Cornel, 06.10): spring, summer (as it was), autumn and winter change Bilu's clothes,
// what falls over Acasă and the app's icon; from 1 December to 7 January Bilu wears Santa's hat, the rest of the
// winter a knitted one. New moments (Mărțișor, Halloween, Paște…) go in MOMENTS: they win over the season while
// they last. The look always follows the date (decision Cornel, 06.10: it comes on by itself); `lookFor` takes a
// fixed look only for previews and tests.

export type Season = "primavara" | "vara" | "toamna" | "iarna";
/** What the app looks like: a season, or a moment inside one. */
export type Look = Season | "craciun";
export type Fall = "petals" | "sun" | "leaves" | "snow";

export interface LookInfo {
  name: string;
  /** What falls over the top of Acasă. */
  fall: Fall;
  /** Bilu's clothes. */
  hat?: "santa" | "beanie" | "flowers" | "leaf";
  scarf?: string;
  mittens?: string;
  shades?: boolean;
  cone?: boolean;
  /** The detail on the "Creează plan" button. */
  cta: "flowers" | "sun" | "leaf" | "snow";
  /** The Android icon (activity-alias Icon_<icon>, plugins/withSeasonIcons.js). */
  icon: Look;
}

export const LOOKS: Record<Look, LookInfo> = {
  primavara: {
    name: "Primăvară",
    fall: "petals",
    hat: "flowers",
    cta: "flowers",
    icon: "primavara",
  },
  vara: {
    name: "Vară",
    fall: "sun",
    shades: true,
    cone: true,
    cta: "sun",
    icon: "vara",
  },
  toamna: {
    name: "Toamnă",
    fall: "leaves",
    hat: "leaf",
    scarf: "#F28C28",
    cta: "leaf",
    icon: "toamna",
  },
  iarna: {
    name: "Iarnă",
    fall: "snow",
    hat: "beanie",
    scarf: "#2F7BD9",
    mittens: "#2F7BD9",
    cta: "snow",
    icon: "iarna",
  },
  craciun: {
    name: "Crăciun",
    fall: "snow",
    hat: "santa",
    scarf: "#E23B3B",
    mittens: "#E23B3B",
    cta: "snow",
    icon: "craciun",
  },
};

/** Moments that win over the season while they last: [from month, from day, to month, to day], inclusive; a range
 *  that ends in an earlier month goes over the new year. */
export const MOMENTS: {
  look: Look;
  from: [number, number];
  to: [number, number];
}[] = [{ look: "craciun", from: [12, 1], to: [1, 7] }];

/** The season by the calendar in Romania: spring March–May, summer June–August, autumn September–November. */
export function seasonOf(d: Date): Season {
  const m = d.getMonth() + 1;
  return m >= 3 && m <= 5
    ? "primavara"
    : m >= 6 && m <= 8
      ? "vara"
      : m >= 9 && m <= 11
        ? "toamna"
        : "iarna";
}

function inside(d: Date, from: [number, number], to: [number, number]) {
  const v = (d.getMonth() + 1) * 100 + d.getDate();
  const a = from[0] * 100 + from[1],
    b = to[0] * 100 + to[1];
  return a <= b ? v >= a && v <= b : v >= a || v <= b;
}

/** The look for a day: a moment if one is on, else the season. */
export function lookOf(d: Date): Look {
  return MOMENTS.find((x) => inside(d, x.from, x.to))?.look ?? seasonOf(d);
}

/** The look on screen: the one fixed in Setări, or the day's. */
export function lookFor(
  choice: "auto" | Look | undefined,
  d = new Date(),
): Look {
  return choice && choice !== "auto" && LOOKS[choice] ? choice : lookOf(d);
}
