// Statistiques lisibles malgré les petits échantillons : le classement utilise un winrate
// « lissé » vers 50 % (moyenne bayésienne), affiché brut à côté.

export const MIN_GAMES = 10; // en dessous : affiché mais « à confirmer »
const PRIOR = 20;

export const winrate = (wins: number, games: number) => (games ? wins / games : 0);
export const adjusted = (wins: number, games: number) => (wins + PRIOR / 2) / (games + PRIOR);

export type Tier = "S" | "A" | "B" | "C" | "D";
// Tiers relatifs (rang du winrate lissé parmi les héros assez joués) : la tier list reste
// lisible quel que soit le volume de parties. S = 10 % du haut, A = 20 %, B = 40 %, C = 20 %, D = 10 %.
const TIER_CUTS: [number, Tier][] = [[0.1, "S"], [0.3, "A"], [0.7, "B"], [0.9, "C"], [1, "D"]];

export function tierMap(rows: { hero_id: string; wins: number; games: number }[]): Map<string, Tier> {
  const ranked = rows.filter((r) => r.games >= MIN_GAMES)
    .sort((a, b) => adjusted(b.wins, b.games) - adjusted(a.wins, a.games));
  return new Map(ranked.map((r, i) => [r.hero_id, TIER_CUTS.find(([cut]) => (i + 0.5) / ranked.length <= cut)![1]]));
}

export const TIER_STYLE: Record<Tier | "?", string> = {
  "?": "from-void-600 to-void-700 text-slate-400",
  S: "from-gold-300 to-gold-600 text-void-950",
  A: "from-nexus-300 to-nexus-600 text-white",
  B: "from-storm-300 to-storm-600 text-white",
  C: "from-slate-400 to-slate-600 text-white",
  D: "from-slate-600 to-slate-800 text-slate-200",
};

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits).replace(".", ",")} %`;
export const num = (v: number) => v.toLocaleString("fr-FR");
export const compact = (v: number) =>
  v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1).replace(".", ",")} M` : v >= 10_000 ? `${Math.round(v / 1000)} k` : num(v);

export function since(unix: number): string {
  const s = Math.max(0, Date.now() / 1000 - unix);
  if (s < 3600) return `il y a ${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86_400) return `il y a ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86_400);
  return d < 30 ? `il y a ${d} j` : new Date(unix * 1000).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

export const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

/** Couleur d'un winrate : rouge < 47 %, neutre, vert > 53 %. */
export function wrTone(v: number): string {
  if (v >= 0.53) return "text-emerald-300";
  if (v <= 0.47) return "text-rose-300";
  return "text-slate-200";
}
