// Lance tout de suite l'agrégation (normalement horaire) sur la base D1 distante.
// Usage : npm run aggregate   (ou `npm run aggregate -- --local` pour la base locale)
// Rejoue les requêtes de src/aggregate.ts via `wrangler d1 execute`.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const target = process.argv.includes("--local") ? "--local" : "--remote";
const BATCH = 2000;

function d1(args) {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "hots-community", target, "-y", "--json", ...args],
    { encoding: "utf8", shell: true, stdio: ["ignore", "pipe", "pipe"] });
  return JSON.parse(out.slice(out.indexOf("[")));
}
const query = (sql) => d1(["--command", JSON.stringify(sql)])[0].results;

const src = readFileSync(new URL("../src/aggregate.ts", import.meta.url), "utf8");
const statements = [...src.matchAll(/db\.prepare\(`([\s\S]*?)`\)/g)].map((m) => m[1])
  .filter((s) => /INSERT INTO (hero_stats|hero_pairs|talent_stats)/.test(s));

let total = 0;
for (;;) {
  const from = Number(query("SELECT value FROM agg_state WHERE key = 'last_match_id'")[0]?.value ?? 0);
  const to = Number(query(`SELECT COALESCE(MAX(id), ${from}) AS id FROM matches WHERE id <= ${from + BATCH}`)[0].id);
  if (to <= from) break;
  const now = Math.floor(Date.now() / 1000);
  const sql = statements.map((s) => s.replace(/\$\{range\}/g, `m.id > ${from} AND m.id <= ${to}`)).join(";\n")
    + `;\nINSERT INTO agg_state (key, value) VALUES ('last_match_id', '${to}'), ('aggregated_at', '${now}')`
    + " ON CONFLICT DO UPDATE SET value = excluded.value;";
  const file = join(mkdtempSync(join(tmpdir(), "hots-agg-")), "aggregate.sql");
  writeFileSync(file, sql);
  d1(["--file", file]);
  const n = Number(query(`SELECT COUNT(*) AS n FROM matches WHERE id > ${from} AND id <= ${to}`)[0].n);
  total += n;
  console.log(`${n} partie(s) agrégée(s)`);
}
console.log(total ? `terminé : ${total} nouvelle(s) partie(s)` : "rien de nouveau à agréger");

// Horaires d'objectifs (aggregateObjectives) : parties pas encore comptées.
const pending = /const pending = "([^"]+)"/.exec(src)[1];
const objectiveSql = [...src.matchAll(/db\.prepare\((`[\s\S]*?`|"[^"]*objectives_aggregated = 1[^"]*")\)/g)]
  .map((m) => m[1].slice(1, -1)).filter((q) => /objective_hist|objectives_aggregated = 1/.test(q));
for (;;) {
  const top = query("SELECT MAX(id) AS id, COUNT(*) AS n FROM (SELECT id FROM matches WHERE objectives IS NOT NULL AND objectives_aggregated = 0 ORDER BY id LIMIT 2000)")[0];
  if (!top.id) break;
  const sql = objectiveSql.map((q) => q.replace("${pending}", pending).replace(/\?1/g, String(top.id))).join(";\n") + ";";
  const file = join(mkdtempSync(join(tmpdir(), "hots-agg-")), "objectives.sql");
  writeFileSync(file, sql);
  d1(["--file", file]);
  console.log(`${top.n} partie(s) : horaires d'objectifs agrégés`);
}
