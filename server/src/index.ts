// API de la plateforme communautaire HOTS REVIVAL (Cloudflare Worker + D1).
//
// Écriture (application, jeton d'installation) :
//   POST   /v1/installs           crée une installation -> { install_id, token }
//   POST   /v1/matches            envoie jusqu'à 25 résumés de parties
//   PUT    /v1/me/profile         active / désactive le profil public
//   DELETE /v1/me                 supprime l'installation et le profil
// Lecture (site web, public) :
//   GET /v1/stats/overview | /v1/stats/heroes | /v1/stats/heroes/:id | /v1/stats/objectives
//   GET /v1/players?q=     | /v1/players/:slug   (sans q : derniers profils publics)

import { aggregate, aggregateObjectives } from "./aggregate";
import { pseudonymize, randomToken, sameHash, sha256 } from "./crypto";
import { canonical, Invalid, MODES, parseSummary } from "./validate";

export interface Env {
  DB: D1Database;
  PID_SECRET: string; // secret Wrangler : `wrangler secret put PID_SECRET`
}

const MAX_BATCH = 25;
// Plan gratuit D1 : 100 000 lignes écrites par jour, index compris (≈ 50 par partie envoyée, plus l'agrégation).
const DAILY_UPLOADS = 200; // par installation : un gros historique s'étale sur plusieurs jours
const GLOBAL_DAILY_UPLOADS = 600; // toutes installations confondues, avant que D1 ne bloque les écritures
const DAILY_INSTALLS_PER_IP = 5;
const MIN_OWNED_GAMES = 3; // parties envoyées en tant que « moi » pour revendiquer un compte
const PROFILE_NAME_RE = /^[\p{L}\p{N}_ .-]{2,24}(#\d{3,7})?$/u;

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS" };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...CORS, ...headers },
  });
}

const error = (status: number, detail: string, headers?: Record<string, string>) => json({ detail }, status, headers);
const today = () => new Date().toISOString().slice(0, 10);
/** Secondes jusqu'à minuit UTC (remise à zéro des quotas), étalées sur 15 min pour que tout le monde ne revienne pas en même temps. */
function untilTomorrow(): string {
  const now = new Date();
  const midnight = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return String(Math.ceil((midnight - now.getTime()) / 1000) + Math.floor(Math.random() * 900));
}
const nowS = () => Math.floor(Date.now() / 1000);

async function readJson(req: Request): Promise<unknown> {
  if (Number(req.headers.get("Content-Length") ?? 0) > 512 * 1024) throw new Invalid("requête trop volumineuse");
  try {
    return await req.json();
  } catch {
    throw new Invalid("JSON invalide");
  }
}

/** Authorization: Bearer <install_id>.<token> */
async function authInstall(req: Request, env: Env): Promise<string | null> {
  const m = /^Bearer ([a-f0-9]{16})\.([a-f0-9]{48})$/.exec(req.headers.get("Authorization") ?? "");
  if (!m) return null;
  const row = await env.DB.prepare("SELECT token_hash FROM installs WHERE id = ?").bind(m[1]).first<{ token_hash: string }>();
  return row && sameHash(row.token_hash, await sha256(m[2])) ? m[1] : null;
}

// ---------------------------------------------------------------- écriture

async function createInstall(req: Request, env: Env): Promise<Response> {
  const ipHash = await sha256(`${env.PID_SECRET}:${req.headers.get("CF-Connecting-IP") ?? "?"}`);
  const day = today();
  const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM installs WHERE ip_hash = ? AND created_day = ?")
    .bind(ipHash, day).first<{ n: number }>();
  if ((used?.n ?? 0) >= DAILY_INSTALLS_PER_IP) return error(429, "Trop d'installations aujourd'hui.", { "Retry-After": "86400" });
  const id = randomToken(8);
  const token = randomToken(24);
  await env.DB.prepare("INSERT INTO installs (id, token_hash, ip_hash, created_day, created_at) VALUES (?, ?, ?, ?, ?)")
    .bind(id, await sha256(token), ipHash, day, nowS()).run();
  return json({ install_id: id, token }, 201);
}

type UploadStatus = "accepted" | "confirmed" | "conflict" | "duplicate" | "rejected";

async function uploadMatches(req: Request, env: Env, installId: string): Promise<Response> {
  const body = (await readJson(req)) as { matches?: unknown[] };
  if (!Array.isArray(body?.matches) || body.matches.length === 0 || body.matches.length > MAX_BATCH) {
    throw new Invalid(`1 à ${MAX_BATCH} parties par envoi`);
  }
  const day = today();
  const used = await env.DB.prepare("SELECT COUNT(*) AS n FROM uploads WHERE install_id = ? AND day = ?")
    .bind(installId, day).first<{ n: number }>();
  if ((used?.n ?? 0) + body.matches.length > DAILY_UPLOADS) {
    return error(429, "Quota journalier atteint, la suite partira demain.", { "Retry-After": untilTomorrow() });
  }
  // Compteur global du jour (une ligne, réservée avant le traitement) : la plateforme se met en pause proprement
  // au lieu de laisser D1 refuser toutes les écritures jusqu'à minuit.
  const reserved = await env.DB.prepare(`
    INSERT INTO agg_state (key, value) VALUES (?1, ?2)
    ON CONFLICT DO UPDATE SET value = CAST(value AS INTEGER) + ?2 WHERE CAST(value AS INTEGER) + ?2 <= ?3
    RETURNING value`).bind(`uploads:${day}`, body.matches.length, GLOBAL_DAILY_UPLOADS).first<{ value: string }>();
  if (!reserved) {
    return error(429, "Plateforme communautaire pleine pour aujourd'hui, la suite partira demain.", { "Retry-After": untilTomorrow() });
  }

  const results: { status: UploadStatus; detail?: string }[] = [];
  for (const raw of body.matches) {
    let summary;
    try {
      summary = parseSummary(raw);
    } catch (e) {
      results.push({ status: "rejected", detail: e instanceof Invalid ? e.message : "résumé illisible" });
      continue;
    }
    const pids = await Promise.all(summary.players.map((p) => pseudonymize(env.PID_SECRET, p.toon_handle)));
    // Une partie = ses 10 comptes + sa date (à la minute) : identique quel que soit l'envoyeur.
    const fingerprint = await sha256(`${[...pids].sort().join(",")}|${Math.floor(summary.played_at / 60)}`);
    const summaryHash = await sha256(canonical(summary, pids));
    const mePid = summary.me_slot == null ? null : pids[summary.me_slot];

    const existing = await env.DB.prepare("SELECT id, summary_hash FROM matches WHERE fingerprint = ?")
      .bind(fingerprint).first<{ id: number; summary_hash: string }>();
    const objectivesJson = summary.objectives ? JSON.stringify(summary.objectives) : null;
    if (existing) {
      if (objectivesJson) {
        // partie déjà connue sans horaires d'objectifs (envoyée par une ancienne version) : on complète
        await env.DB.prepare("UPDATE matches SET objectives = ? WHERE id = ? AND objectives IS NULL")
          .bind(objectivesJson, existing.id).run();
      }
      const inserted = await env.DB.prepare(
        "INSERT OR IGNORE INTO uploads (install_id, match_id, me_pid, day) VALUES (?, ?, ?, ?)",
      ).bind(installId, existing.id, mePid, day).run();
      if (!inserted.meta.changes) {
        results.push({ status: "duplicate" });
        continue;
      }
      const agrees = existing.summary_hash === summaryHash;
      await env.DB.prepare(`UPDATE matches SET ${agrees ? "confirmations" : "conflicts"} = ${agrees ? "confirmations" : "conflicts"} + 1 WHERE id = ?`)
        .bind(existing.id).run();
      results.push({ status: agrees ? "confirmed" : "conflict" });
      continue;
    }

    const match = await env.DB.prepare(`
      INSERT INTO matches (fingerprint, summary_hash, map_id, mode, version, played_at, duration_s, winner_team,
                           level_0, level_1, objectives, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`)
      .bind(fingerprint, summaryHash, summary.map_id, summary.mode, summary.version, summary.played_at,
        summary.duration_s, summary.winner_team, summary.levels[0], summary.levels[1], objectivesJson, nowS())
      .first<{ id: number }>();
    const matchId = match!.id;
    const insertPlayer = env.DB.prepare(`
      INSERT INTO match_players (match_id, slot, pid, team, hero_id, role, win, kills, deaths, assists, takedowns,
                                 hero_damage, siege_damage, healing, self_healing, damage_taken, xp, mercs,
                                 time_dead_s, heros_score, talents)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    await env.DB.batch([
      ...summary.players.map((p, i) => insertPlayer.bind(
        matchId, p.slot, pids[i], p.team, p.hero_id, p.role, p.win ? 1 : 0, p.stats.kills, p.stats.deaths,
        p.stats.assists, p.stats.takedowns, p.stats.hero_damage, p.stats.siege_damage, p.stats.healing,
        p.stats.self_healing, p.stats.damage_taken, p.stats.xp, p.stats.mercs, p.stats.time_dead_s,
        p.heros_score, JSON.stringify(p.talents),
      )),
      env.DB.prepare("INSERT INTO uploads (install_id, match_id, me_pid, day) VALUES (?, ?, ?, ?)")
        .bind(installId, matchId, mePid, day),
    ]);
    results.push({ status: "accepted" });
  }
  return json({ results });
}

async function updateProfile(req: Request, env: Env, installId: string): Promise<Response> {
  const body = (await readJson(req)) as { public?: unknown; name?: unknown; toon_handles?: unknown };
  if (typeof body.public !== "boolean") throw new Invalid("public attendu");
  if (!body.public) {
    await env.DB.prepare("UPDATE profiles SET is_public = 0, updated_at = ? WHERE install_id = ?").bind(nowS(), installId).run();
    return json({ public: false, slug: null });
  }
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!PROFILE_NAME_RE.test(name)) throw new Invalid("nom de profil invalide (BattleTag ou pseudo de 2 à 24 caractères)");
  const toons = Array.isArray(body.toon_handles) ? body.toon_handles.filter((t): t is string => typeof t === "string") : [];
  if (!toons.length || toons.length > 8) throw new Invalid("comptes attendus");

  // Preuve de propriété : le compte doit apparaître comme « moi » dans des parties envoyées par cette installation.
  const owned: { pid: string; region: number }[] = [];
  for (const toon of toons) {
    const pid = await pseudonymize(env.PID_SECRET, toon);
    const n = await env.DB.prepare("SELECT COUNT(*) AS n FROM uploads WHERE install_id = ? AND me_pid = ?")
      .bind(installId, pid).first<{ n: number }>();
    const claimed = await env.DB.prepare(
      "SELECT pp.slug FROM profile_pids pp JOIN profiles pr ON pr.slug = pp.slug WHERE pp.pid = ? AND pr.install_id <> ?",
    ).bind(pid, installId).first<{ slug: string }>();
    if ((n?.n ?? 0) >= MIN_OWNED_GAMES && !claimed) owned.push({ pid, region: Number(toon.split("-")[0]) });
  }
  if (!owned.length) {
    return error(409, `Envoyez d'abord au moins ${MIN_OWNED_GAMES} parties pour relier votre compte à un profil.`);
  }

  const current = await env.DB.prepare("SELECT slug FROM profiles WHERE install_id = ?").bind(installId).first<{ slug: string }>();
  const slug = current?.slug ?? `${name.split("#")[0].toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 20)}-${randomToken(3)}`;
  await env.DB.batch([
    env.DB.prepare(`
      INSERT INTO profiles (slug, install_id, name, is_public, created_at, updated_at) VALUES (?1, ?2, ?3, 1, ?4, ?4)
      ON CONFLICT (install_id) DO UPDATE SET name = excluded.name, is_public = 1, updated_at = excluded.updated_at`)
      .bind(slug, installId, name, nowS()),
    ...owned.map((o) => env.DB.prepare("INSERT OR REPLACE INTO profile_pids (pid, slug, region) VALUES (?, ?, ?)")
      .bind(o.pid, slug, o.region)),
  ]);
  return json({ public: true, slug, accounts: owned.length });
}

async function deleteMe(env: Env, installId: string): Promise<Response> {
  // Les parties restent (pseudonymisées) dans les statistiques globales ; tout lien avec la personne disparaît.
  await env.DB.batch([
    env.DB.prepare("DELETE FROM profile_pids WHERE slug IN (SELECT slug FROM profiles WHERE install_id = ?)").bind(installId),
    env.DB.prepare("DELETE FROM profiles WHERE install_id = ?").bind(installId),
    env.DB.prepare("DELETE FROM uploads WHERE install_id = ?").bind(installId),
    env.DB.prepare("DELETE FROM installs WHERE id = ?").bind(installId),
  ]);
  return json({ deleted: true });
}

// ---------------------------------------------------------------- lecture publique

function modeFilter(url: URL): string | null {
  const mode = url.searchParams.get("mode");
  if (mode && !(MODES as readonly string[]).includes(mode)) throw new Invalid("mode inconnu");
  return mode;
}

const cached = (body: unknown) => json(body, 200, { "Cache-Control": "public, max-age=300" });

async function overview(env: Env): Promise<Response> {
  const [totals, state, players, contributors] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS matches, MIN(played_at) AS first, MAX(played_at) AS last FROM matches"),
    env.DB.prepare("SELECT key, value FROM agg_state"),
    env.DB.prepare("SELECT COUNT(*) AS public_profiles FROM profiles WHERE is_public = 1"),
    env.DB.prepare("SELECT COUNT(DISTINCT install_id) AS contributors FROM uploads"),
  ]);
  const st = Object.fromEntries((state.results as { key: string; value: string }[]).map((r) => [r.key, r.value]));
  return cached({
    ...(totals.results[0] as object),
    ...(players.results[0] as object),
    ...(contributors.results[0] as object),
    aggregated_at: st.aggregated_at ? Number(st.aggregated_at) : null,
    modes: MODES,
  });
}

async function heroes(env: Env, url: URL): Promise<Response> {
  const mode = modeFilter(url);
  const map = url.searchParams.get("map");
  const rows = await env.DB.prepare(`
    SELECT hero_id, SUM(games) AS games, SUM(wins) AS wins, SUM(kills) AS kills, SUM(deaths) AS deaths,
           SUM(assists) AS assists, SUM(hero_damage) AS hero_damage, SUM(siege_damage) AS siege_damage,
           SUM(healing) AS healing, SUM(damage_taken) AS damage_taken, SUM(xp) AS xp
    FROM hero_stats WHERE (?1 IS NULL OR mode = ?1) AND (?2 IS NULL OR map_id = ?2)
    GROUP BY hero_id ORDER BY games DESC`).bind(mode, map).all();
  const total = (rows.results as { games: number }[]).reduce((s, r) => s + r.games, 0) / 10;
  return cached({ total_matches: total, heroes: rows.results });
}

async function hero(env: Env, url: URL, heroId: string): Promise<Response> {
  const mode = modeFilter(url);
  const where = "hero_id = ?1 AND (?2 IS NULL OR mode = ?2)";
  const [maps, pairs, talents] = await env.DB.batch([
    env.DB.prepare(`SELECT map_id, SUM(games) AS games, SUM(wins) AS wins FROM hero_stats WHERE ${where}
                    GROUP BY map_id ORDER BY games DESC`).bind(heroId, mode),
    env.DB.prepare(`SELECT other_id, relation, SUM(games) AS games, SUM(wins) AS wins FROM hero_pairs WHERE ${where}
                    GROUP BY other_id, relation`).bind(heroId, mode),
    env.DB.prepare(`SELECT tier, talent, SUM(games) AS games, SUM(wins) AS wins FROM talent_stats WHERE ${where}
                    GROUP BY tier, talent ORDER BY tier, games DESC`).bind(heroId, mode),
  ]);
  if (!maps.results.length) return error(404, "Aucune donnée pour ce héros.");
  return cached({ hero_id: heroId, maps: maps.results, pairs: pairs.results, talents: talents.results });
}

/** Quantile d'un histogramme à la seconde [(valeur, effectif)]. */
function histQuantile(rows: { bucket: number; n: number }[], q: number): number {
  const total = rows.reduce((s, r) => s + r.n, 0);
  let seen = 0;
  for (const r of rows) {
    seen += r.n;
    if (seen >= q * total) return r.bucket;
  }
  return rows[rows.length - 1].bucket;
}

const MIN_OBJECTIVE_SAMPLES = 3;

/** Timers d'objectif mis en commun, par carte : premier début, durée (quartiles), délai après la fin. */
async function objectives(env: Env): Promise<Response> {
  const rows = (await env.DB.prepare("SELECT map_id, metric, bucket, n FROM objective_hist ORDER BY map_id, metric, bucket")
    .all<{ map_id: string; metric: string; bucket: number; n: number }>()).results;
  const byMap = new Map<string, Map<string, { bucket: number; n: number }[]>>();
  for (const r of rows) {
    const metrics = byMap.get(r.map_id) ?? new Map<string, { bucket: number; n: number }[]>();
    metrics.set(r.metric, [...(metrics.get(r.metric) ?? []), { bucket: r.bucket, n: r.n }]);
    byMap.set(r.map_id, metrics);
  }
  const maps: Record<string, Record<string, number>> = {};
  for (const [mapId, metrics] of byMap) {
    const get = (m: string) => metrics.get(m) ?? [];
    const count = (m: string) => get(m).reduce((s, r) => s + r.n, 0);
    const out: Record<string, number> = { samples: count("first_start") || count("period") };
    if (count("first_start") >= MIN_OBJECTIVE_SAMPLES) out.first_objective_s = histQuantile(get("first_start"), 0.5);
    if (count("duration") >= MIN_OBJECTIVE_SAMPLES) {
      const d = get("duration");
      out.objective_duration_s = histQuantile(d, 0.5);
      out.duration_low_s = histQuantile(d, 0.25);
      out.duration_high_s = histQuantile(d, 0.75);
    }
    if (count("respawn") >= MIN_OBJECTIVE_SAMPLES) out.objective_interval_s = histQuantile(get("respawn"), 0.5);
    else if (count("period") >= MIN_OBJECTIVE_SAMPLES) out.objective_interval_s = histQuantile(get("period"), 0.5);
    maps[mapId] = out;
  }
  return cached({ maps });
}

async function searchPlayers(env: Env, url: URL): Promise<Response> {
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 24);
  if (!q) {  // sans recherche : derniers profils rendus publics
    const recent = await env.DB.prepare(`
      SELECT pr.slug, pr.name, COUNT(p.match_id) AS games, SUM(p.win) AS wins
      FROM profiles pr JOIN profile_pids pp ON pp.slug = pr.slug LEFT JOIN match_players p ON p.pid = pp.pid
      WHERE pr.is_public = 1 GROUP BY pr.slug ORDER BY pr.updated_at DESC LIMIT 12`).all();
    return cached({ players: recent.results });
  }
  if (q.length < 2) return json({ players: [] });
  const rows = await env.DB.prepare(
    "SELECT slug, name FROM profiles WHERE is_public = 1 AND name LIKE ? ESCAPE '\\' ORDER BY name LIMIT 20",
  ).bind(`${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`).all();
  return json({ players: rows.results });
}

async function player(env: Env, slug: string): Promise<Response> {
  const profile = await env.DB.prepare("SELECT slug, name, created_at FROM profiles WHERE slug = ? AND is_public = 1")
    .bind(slug).first();
  if (!profile) return error(404, "Profil introuvable ou privé.");
  const mine = "SELECT pid FROM profile_pids WHERE slug = ?1";
  const [regions, byHero, byMode, recent] = await env.DB.batch([
    env.DB.prepare("SELECT region FROM profile_pids WHERE slug = ?1").bind(slug),
    env.DB.prepare(`
      SELECT p.hero_id, COUNT(*) AS games, SUM(p.win) AS wins, AVG(p.heros_score) AS heros_score,
             SUM(p.kills) AS kills, SUM(p.deaths) AS deaths, SUM(p.assists) AS assists
      FROM match_players p WHERE p.pid IN (${mine}) GROUP BY p.hero_id ORDER BY games DESC`).bind(slug),
    env.DB.prepare(`
      SELECT m.mode, COUNT(*) AS games, SUM(p.win) AS wins
      FROM match_players p JOIN matches m ON m.id = p.match_id WHERE p.pid IN (${mine}) GROUP BY m.mode`).bind(slug),
    env.DB.prepare(`
      SELECT m.id, m.map_id, m.mode, m.played_at, m.duration_s, p.hero_id, p.win, p.kills, p.deaths, p.assists,
             p.heros_score, p.team,
             (SELECT json_group_array(json_object('hero_id', o.hero_id, 'team', o.team))
              FROM match_players o WHERE o.match_id = m.id AND o.slot <> p.slot) AS others
      FROM match_players p JOIN matches m ON m.id = p.match_id
      WHERE p.pid IN (${mine}) ORDER BY m.played_at DESC LIMIT 20`).bind(slug),
  ]);
  return json({
    ...(profile as object),
    regions: (regions.results as { region: number }[]).map((r) => r.region),
    modes: byMode.results,
    heroes: byHero.results,
    // Coéquipiers et adversaires : héros uniquement, jamais de pseudo.
    recent: (recent.results as { others: string }[]).map((r) => ({ ...r, others: JSON.parse(r.others) })),
  }, 200, { "Cache-Control": "public, max-age=60" });
}

// ---------------------------------------------------------------- routage

async function route(req: Request, env: Env): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname.replace(/\/+$/, "");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  if (req.method === "GET") {
    if (path === "/v1/stats/overview") return overview(env);
    if (path === "/v1/stats/heroes") return heroes(env, url);
    if (path === "/v1/stats/objectives") return objectives(env);
    let m = /^\/v1\/stats\/heroes\/([a-z0-9_]{1,48})$/.exec(path);
    if (m) return hero(env, url, m[1]);
    if (path === "/v1/players") return searchPlayers(env, url);
    m = /^\/v1\/players\/([\p{L}\p{N}-]{1,40})$/u.exec(decodeURIComponent(path));
    if (m) return player(env, m[1]);
    if (path === "" || path === "/v1") return json({ name: "HOTS REVIVAL community API", version: 1 });
    return error(404, "Introuvable.");
  }

  if (req.method === "POST" && path === "/v1/installs") return createInstall(req, env);
  const installId = await authInstall(req, env);
  if (!installId) return error(401, "Installation inconnue.");
  if (req.method === "POST" && path === "/v1/matches") return uploadMatches(req, env, installId);
  if (req.method === "PUT" && path === "/v1/me/profile") return updateProfile(req, env, installId);
  if (req.method === "DELETE" && path === "/v1/me") return deleteMe(env, installId);
  return error(404, "Introuvable.");
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    try {
      return await route(req, env);
    } catch (e) {
      if (e instanceof Invalid) return error(400, e.message);
      console.error(e);
      return error(503, "Service momentanément indisponible.", { "Retry-After": "600" });
    }
  },

  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil((async () => {
      // compteurs d'envoi des jours passés
      await env.DB.prepare("DELETE FROM agg_state WHERE key LIKE 'uploads:%' AND key <> ?").bind(`uploads:${today()}`).run();
      const r = await aggregate(env.DB);
      const n = await aggregateObjectives(env.DB);
      console.log(`agrégation ${r.from} -> ${r.to}, horaires d'objectifs : ${n} partie(s)`);
    })());
  },
} satisfies ExportedHandler<Env>;
