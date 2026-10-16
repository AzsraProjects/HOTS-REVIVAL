// Client de l'API communautaire (server/src/index.ts).
import { useEffect, useState } from "react";
import { t } from "./i18n";

export const API_BASE = import.meta.env.VITE_API_BASE ?? "https://hots-revival-community.hots-revival.workers.dev";

export interface Overview {
  matches: number;
  contributors: number;
  public_profiles: number;
  first: number | null;
  last: number | null;
  aggregated_at: number | null;
}

export interface HeroRow {
  hero_id: string;
  games: number;
  wins: number;
  kills: number;
  deaths: number;
  assists: number;
  hero_damage: number;
  siege_damage: number;
  healing: number;
  damage_taken: number;
  xp: number;
}

export interface HeroDetail {
  hero_id: string;
  maps: { map_id: string; games: number; wins: number }[];
  pairs: { other_id: string; relation: "with" | "vs"; games: number; wins: number }[];
  talents: { tier: number; talent: string; games: number; wins: number }[];
}

export interface PlayerSummary {
  slug: string;
  name: string;
  games?: number;
  wins?: number;
}

export interface RecentMatch {
  id: number;
  map_id: string;
  mode: string;
  played_at: number;
  duration_s: number;
  hero_id: string;
  win: number;
  kills: number;
  deaths: number;
  assists: number;
  heros_score: number | null;
  team: number;
  others: { hero_id: string; team: number }[];
}

export interface Player {
  slug: string;
  name: string;
  created_at: number;
  regions: number[];
  modes: { mode: string; games: number; wins: number }[];
  heroes: { hero_id: string; games: number; wins: number; heros_score: number | null; kills: number; deaths: number; assists: number }[];
  recent: RecentMatch[];
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const TTL_MS = 5 * 60_000; // comme le cache HTTP de l'API
const cache = new Map<string, { at: number; promise: Promise<unknown> }>();

export function get<T>(path: string): Promise<T> {
  const url = path.startsWith("/data/") ? path : `${API_BASE}${path}`;
  const hit = cache.get(url);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.promise as Promise<T>;
  const promise = fetch(url).then(async (r) => {
    if (!r.ok) {
      const detail = await r.json().then((b) => b.detail).catch(() => r.statusText);
      throw new ApiError(r.status, detail || "Erreur");
    }
    try {
      return await r.json();
    } catch {
      throw new ApiError(r.status, t("Réponse illisible."));
    }
  }, () => {
    throw new ApiError(0, t("Le serveur communautaire est injoignable."));
  });
  promise.catch(() => cache.delete(url));
  cache.set(url, { at: Date.now(), promise });
  return promise as Promise<T>;
}

/** Données d'un chemin d'API. Quand le chemin change, `data` est vidée tout de suite (jamais les
 * données d'une autre page) ; `previous` garde les anciennes pour un affichage atténué. */
export function useApi<T>(path: string | null): { data?: T; previous?: T; error?: ApiError; loading: boolean } {
  const [state, setState] = useState<{ path: string | null; data?: T; error?: ApiError }>({ path: null });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    get<T>(path).then(
      (data) => alive && setState({ path, data }),
      (error: ApiError) => alive && setState({ path, error }),
    );
    return () => {
      alive = false;
    };
  }, [path]);
  if (!path) return { loading: false };
  if (state.path !== path) return { loading: true, previous: state.data };
  return { data: state.data, error: state.error, loading: false };
}

export const modeQuery = (mode: string | null, extra: Record<string, string | null> = {}) => {
  const q = new URLSearchParams();
  if (mode) q.set("mode", mode);
  for (const [k, v] of Object.entries(extra)) if (v) q.set(k, v);
  const s = q.toString();
  return s ? `?${s}` : "";
};
