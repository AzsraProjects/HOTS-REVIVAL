// Validation des résumés de partie envoyés par l'application. Le serveur ne reçoit jamais
// le replay : il contrôle la cohérence de chaque résumé (structure, bornes, équipes) et
// compte les envois concordants d'une même partie (voir index.ts).

export const SUMMARY_VERSION = 1;

/** Modes comptés dans les statistiques publiques (parties contre de vrais joueurs). */
export const MODES = ["Quick Match", "Storm League", "Unranked Draft", "ARAM", "Hero League", "Team League"] as const;

/** Identifiants canoniques des cartes (backend/app/data/maps.json : maps + aram_maps). */
export const MAPS = [
  "alterac_pass", "battlefield_of_eternity", "blackhearts_bay", "braxis_holdout", "cursed_hollow", "dragon_shire", "garden_of_terror", "hanamura_temple", "infernal_shrines", "sky_temple", "tomb_of_the_spider_queen", "towers_of_doom", "volskaya_foundry", "warhead_junction", "haunted_mines", "braxis_outpost", "lost_cavern", "industrial_district", "silver_city", "checkpoint_hanamura", "pull_party",
];

export const TALENT_TIERS = 7;
const ID_RE = /^[a-z0-9_]{1,48}$/;
const TOON_RE = /^\d{1,3}-Hero-\d{1,3}-\d{1,12}$/;
const VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,7}$/;
const ROLES = ["Tank", "Bruiser", "Healer", "Support", "Ranged Assassin", "Melee Assassin"];

const STAT_LIMITS: Record<string, number> = {
  kills: 200, deaths: 200, assists: 300, takedowns: 300,
  hero_damage: 2_000_000, siege_damage: 3_000_000, healing: 2_000_000, self_healing: 1_000_000,
  damage_taken: 2_000_000, xp: 500_000, mercs: 100, time_dead_s: 3600,
};
export const STAT_FIELDS = Object.keys(STAT_LIMITS);

export interface PlayerSummary {
  slot: number;
  toon_handle: string;
  team: number;
  hero_id: string;
  role: string | null;
  win: boolean;
  heros_score: number | null;
  talents: string[];
  stats: Record<string, number>;
}

export interface ObjectiveTimings {
  first_start: number | null;
  durations: number[];
  respawns: number[];
  periods: number[];
}

export interface MatchSummary {
  me_slot: number | null;
  objectives: ObjectiveTimings | null;
  map_id: string;
  mode: string;
  version: string;
  played_at: number;
  duration_s: number;
  winner_team: number;
  levels: [number, number];
  players: PlayerSummary[];
}

export class Invalid extends Error {}

function int(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    throw new Invalid(`${field} invalide`);
  }
  return value;
}

function str(value: unknown, field: string, re: RegExp): string {
  if (typeof value !== "string" || !re.test(value)) throw new Invalid(`${field} invalide`);
  return value;
}

function talents(value: unknown): string[] {
  if (!Array.isArray(value) || value.length !== TALENT_TIERS) throw new Invalid("talents invalides");
  return value.map((t) => {
    if (typeof t !== "string" || t.length > 80) throw new Invalid("talent invalide");
    return t;
  });
}

const MAX_OBJECTIVE_VALUES = 40;

/** Horaires d'objectifs (facultatifs) : listes bornées de secondes entières. */
function objectiveTimings(raw: unknown, duration_s: number): ObjectiveTimings | null {
  if (raw == null) return null;
  if (typeof raw !== "object") throw new Invalid("objectives invalides");
  const o = raw as Record<string, unknown>;
  const list = (v: unknown, field: string): number[] => {
    if (v == null) return [];
    if (!Array.isArray(v) || v.length > MAX_OBJECTIVE_VALUES) throw new Invalid(`${field} invalides`);
    return v.map((x) => int(x, field, 1, duration_s));
  };
  return {
    first_start: o.first_start == null ? null : int(o.first_start, "first_start", 0, Math.min(duration_s, 900)),
    durations: list(o.durations, "durations"),
    respawns: list(o.respawns, "respawns"),
    periods: list(o.periods, "periods"),
  };
}

function knownMap(value: unknown): string {
  if (typeof value !== "string" || !MAPS.includes(value)) throw new Invalid("carte inconnue");
  return value;
}

export function parseSummary(raw: unknown, now = Date.now() / 1000): MatchSummary {
  if (!raw || typeof raw !== "object") throw new Invalid("résumé absent");
  const r = raw as Record<string, unknown>;
  if (r.v !== SUMMARY_VERSION) throw new Invalid("version de résumé non prise en charge");
  const m = (r.match ?? {}) as Record<string, unknown>;

  const mode = m.mode;
  if (typeof mode !== "string" || !(MODES as readonly string[]).includes(mode)) throw new Invalid("mode non compté");
  const played_at = int(m.played_at, "played_at", 1_388_534_400, Math.floor(now) + 86_400); // depuis 2014
  const duration_s = int(m.duration_s, "duration_s", 60, 3600);
  const winner_team = int(m.winner_team, "winner_team", 0, 1);
  const lv = Array.isArray(m.levels) ? m.levels : [];
  const levels: [number, number] = [int(lv[0], "levels", 1, 30), int(lv[1], "levels", 1, 30)];

  if (!Array.isArray(r.players) || r.players.length !== 10) throw new Invalid("10 joueurs attendus");
  const players = r.players.map((p): PlayerSummary => {
    const q = (p ?? {}) as Record<string, unknown>;
    const team = int(q.team, "team", 0, 1);
    const stats: Record<string, number> = {};
    for (const f of STAT_FIELDS) stats[f] = int(q[f], f, 0, STAT_LIMITS[f]);
    const role = q.role == null ? null : String(q.role);
    if (role !== null && !ROLES.includes(role)) throw new Invalid("role invalide");
    if (typeof q.win !== "boolean") throw new Invalid("win invalide");
    return {
      slot: int(q.slot, "slot", 0, 9),
      toon_handle: str(q.toon_handle, "toon_handle", TOON_RE),
      team,
      hero_id: str(q.hero_id, "hero_id", ID_RE),
      role,
      win: q.win,
      heros_score: q.heros_score == null ? null : int(q.heros_score, "heros_score", 0, 100),
      talents: talents(q.talents),
      stats,
    };
  });

  // Cohérence d'équipe : 5 contre 5, slots uniques, victoire = équipe gagnante.
  if (new Set(players.map((p) => p.slot)).size !== 10) throw new Invalid("slots en double");
  if (new Set(players.map((p) => p.toon_handle)).size !== 10) throw new Invalid("joueurs en double");
  if (players.filter((p) => p.team === 0).length !== 5) throw new Invalid("équipes déséquilibrées");
  if (players.some((p) => p.win !== (p.team === winner_team))) throw new Invalid("résultat incohérent");
  if (players.some((p) => p.stats.time_dead_s > duration_s)) throw new Invalid("temps mort incohérent");

  const me_slot = r.me_slot == null ? null : int(r.me_slot, "me_slot", 0, 9);
  return {
    me_slot,
    objectives: objectiveTimings(r.objectives, duration_s),
    map_id: knownMap(m.map_id),
    mode,
    version: str(m.version, "version", VERSION_RE),
    played_at,
    duration_s,
    winner_team,
    levels,
    players: players.sort((a, b) => a.slot - b.slot),
  };
}

/** Représentation canonique (sans identité de l'envoyeur) pour comparer deux envois. */
export function canonical(m: MatchSummary, pids: string[]): string {
  return JSON.stringify([
    m.map_id, m.mode, m.version, m.duration_s, m.winner_team, m.levels,
    m.players.map((p, i) => [pids[i], p.team, p.hero_id, p.talents, STAT_FIELDS.map((f) => p.stats[f])]),
  ]);
}
