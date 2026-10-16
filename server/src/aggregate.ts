// Agrégation incrémentale : seules les parties arrivées depuis le dernier passage sont lues,
// et le calcul se fait en SQL côté D1 (le Worker gratuit n'a que quelques ms de CPU).

const BATCH = 2000; // parties traitées par passage (limite de lectures/écritures D1)

/** Horaires d'objectifs : parties non encore comptées (y compris celles complétées après coup). */
export async function aggregateObjectives(db: D1Database): Promise<number> {
  const top = await db.prepare(`SELECT MAX(id) AS id, COUNT(*) AS n FROM (SELECT id FROM matches
    WHERE objectives IS NOT NULL AND objectives_aggregated = 0 ORDER BY id LIMIT ${BATCH})`).first<{ id: number | null; n: number }>();
  if (!top?.id) return 0;
  const pending = "SELECT id, map_id, objectives FROM matches WHERE objectives IS NOT NULL AND objectives_aggregated = 0 AND id <= ?1";
  await db.batch([
    db.prepare(`
      INSERT INTO objective_hist (map_id, metric, bucket, n)
      SELECT m.map_id, k.metric, CAST(j.value AS INTEGER), COUNT(*)
      FROM (${pending}) m
      JOIN (SELECT 'duration' AS metric, '$.durations' AS path UNION ALL SELECT 'respawn', '$.respawns'
            UNION ALL SELECT 'period', '$.periods') k
      JOIN json_each(m.objectives, k.path) j
      GROUP BY 1, 2, 3
      ON CONFLICT DO UPDATE SET n = n + excluded.n`).bind(top.id),
    db.prepare(`
      INSERT INTO objective_hist (map_id, metric, bucket, n)
      SELECT m.map_id, 'first_start', CAST(json_extract(m.objectives, '$.first_start') AS INTEGER), COUNT(*)
      FROM (${pending}) m
      WHERE json_extract(m.objectives, '$.first_start') IS NOT NULL
      GROUP BY 1, 2, 3
      ON CONFLICT DO UPDATE SET n = n + excluded.n`).bind(top.id),
    db.prepare("UPDATE matches SET objectives_aggregated = 1 WHERE objectives IS NOT NULL AND objectives_aggregated = 0 AND id <= ?1")
      .bind(top.id),
  ]);
  return top.n;
}

export async function aggregate(db: D1Database): Promise<{ from: number; to: number }> {
  const state = await db.prepare("SELECT value FROM agg_state WHERE key = 'last_match_id'").first<{ value: string }>();
  const from = Number(state?.value ?? 0);
  const top = await db.prepare("SELECT MAX(id) AS id FROM matches WHERE id <= ?").bind(from + BATCH).first<{ id: number | null }>();
  const to = top?.id ?? from;
  if (to <= from) return { from, to };

  const range = "m.id > ?1 AND m.id <= ?2";
  await db.batch([
    db.prepare(`
      INSERT INTO hero_stats (hero_id, mode, map_id, games, wins, kills, deaths, assists, hero_damage, siege_damage,
                              healing, damage_taken, xp, duration_s)
      SELECT p.hero_id, m.mode, m.map_id, COUNT(*), SUM(p.win), SUM(p.kills), SUM(p.deaths), SUM(p.assists),
             SUM(p.hero_damage), SUM(p.siege_damage), SUM(p.healing), SUM(p.damage_taken), SUM(p.xp), SUM(m.duration_s)
      FROM match_players p JOIN matches m ON m.id = p.match_id
      WHERE ${range}
      GROUP BY p.hero_id, m.mode, m.map_id
      ON CONFLICT DO UPDATE SET
        games = games + excluded.games, wins = wins + excluded.wins, kills = kills + excluded.kills,
        deaths = deaths + excluded.deaths, assists = assists + excluded.assists,
        hero_damage = hero_damage + excluded.hero_damage, siege_damage = siege_damage + excluded.siege_damage,
        healing = healing + excluded.healing, damage_taken = damage_taken + excluded.damage_taken,
        xp = xp + excluded.xp, duration_s = duration_s + excluded.duration_s`).bind(from, to),
    db.prepare(`
      INSERT INTO hero_pairs (hero_id, other_id, relation, mode, games, wins)
      SELECT a.hero_id, b.hero_id, CASE WHEN a.team = b.team THEN 'with' ELSE 'vs' END, m.mode, COUNT(*), SUM(a.win)
      FROM match_players a
      JOIN match_players b ON b.match_id = a.match_id AND b.slot <> a.slot
      JOIN matches m ON m.id = a.match_id
      WHERE ${range}
      GROUP BY 1, 2, 3, 4
      ON CONFLICT DO UPDATE SET games = games + excluded.games, wins = wins + excluded.wins`).bind(from, to),
    db.prepare(`
      INSERT INTO talent_stats (hero_id, mode, tier, talent, games, wins)
      SELECT p.hero_id, m.mode, t.key + 1, t.value, COUNT(*), SUM(p.win)
      FROM match_players p JOIN matches m ON m.id = p.match_id, json_each(p.talents) t
      WHERE ${range} AND t.value <> ''
      GROUP BY 1, 2, 3, 4
      ON CONFLICT DO UPDATE SET games = games + excluded.games, wins = wins + excluded.wins`).bind(from, to),
    db.prepare(`
      INSERT INTO agg_state (key, value) VALUES ('last_match_id', ?1), ('aggregated_at', ?2)
      ON CONFLICT DO UPDATE SET value = excluded.value`).bind(String(to), String(Math.floor(Date.now() / 1000))),
  ]);
  return { from, to };
}
