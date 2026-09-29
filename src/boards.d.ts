declare module '*.view.js' { export const TPL: string; export const CSS: string; export const FONTS: string; }
declare module '*.logic.js' { export function make(D: unknown): unknown; }
