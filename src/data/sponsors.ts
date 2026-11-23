/**
 * Tournament sponsors, shown in this order (Live page banner, page footers, match sheet).
 * To add one: save the logo in design/sponsors-raw/<file>.png, run `npm run sponsors`, add a line here.
 * `file`: the name in public/sponsors/ without ".webp". `website`: optional link.
 */
export type Sponsor = { name: string; file: string; order: number; website?: string };

// Veteran tournament: no sponsors confirmed yet, so none are shown. The departmental tournament's
// sponsors' logos are still in public/sponsors/ if they sponsor this one too:
//   { name: "Zimdra Automobiles", file: "zimdra-automobiles", order: 1 },
//   { name: "Coca-Cola", file: "coca-cola", order: 2 },
export const SPONSORS: Sponsor[] = [];
