// Levels from XP (the design's carnet): Boboc at 100 XP, up to Legenda orașului at 4.000.
export const LEVELS = ['', 'Boboc', 'Scânteie', 'Radar', 'Busolă', 'Motorul găștii', 'Legenda orașului'];
export const LEVEL_XP = [0, 100, 400, 900, 1500, 2500, 4000];
export const levelOf = (xp: number) => LEVEL_XP.reduce((acc, need, i) => (i && xp >= need ? i : acc), 0);
export const levelName = (xp: number) => LEVELS[levelOf(xp)] || 'Abia a început';
