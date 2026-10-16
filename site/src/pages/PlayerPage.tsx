import { Link, useParams } from "react-router-dom";
import { HeroLink, HeroPortrait, Loading, Notice, Stat, WinBar } from "../components/ui";
import { useApi, type Player, type RecentMatch } from "../lib/api";
import { hero, mapName, modeLabel, REGIONS } from "../lib/game";
import { duration, num, pct, since, winrate, wrTone } from "../lib/stats";

export function PlayerPage() {
  const { slug = "" } = useParams();
  return <PlayerView key={slug} slug={slug} />;
}

function PlayerView({ slug }: { slug: string }) {
  const { data: p, error, loading } = useApi<Player>(`/v1/players/${encodeURIComponent(slug)}`);

  if (loading) return <Loading />;
  if (error) {
    return (
      <Notice title={error.status === 404 ? "Profil introuvable" : "Profil indisponible"} tone={error.status === 404 ? "info" : "error"}>
        {error.status === 404 ? "Ce profil n'existe pas ou son propriétaire l'a rendu privé." : error.message}
        <div className="mt-4"><Link to="/joueurs" className="btn-ghost">Voir les joueurs</Link></div>
      </Notice>
    );
  }
  if (!p) return null;

  const games = p.modes.reduce((s, m) => s + m.games, 0);
  const wins = p.modes.reduce((s, m) => s + m.wins, 0);
  const [name, tag] = p.name.split("#");
  const scores = p.recent.filter((r) => r.heros_score != null);
  const avgScore = scores.length ? Math.round(scores.reduce((s, r) => s + (r.heros_score ?? 0), 0) / scores.length) : null;

  return (
    <div className="space-y-8">
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-nexus-600/30 blur-3xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          {p.heroes[0] ? <HeroPortrait id={p.heroes[0].hero_id} size={96} /> : null}
          <div className="flex-1">
            <div className="eyebrow">Profil public</div>
            <h1 className="title-gold mt-1 text-4xl">{name}{tag && <span className="text-2xl text-slate-400">#{tag}</span>}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              {p.regions.map((r) => <span key={r} className="chip">{REGIONS[r] ?? `Région ${r}`}</span>)}
              {p.modes.sort((a, b) => b.games - a.games).map((m) => (
                <span key={m.mode} className="chip">{modeLabel(m.mode)} · {num(m.games)} · <span className={wrTone(winrate(m.wins, m.games))}>{pct(winrate(m.wins, m.games), 0)}</span></span>
              ))}
            </div>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Parties" value={num(games)} />
        <Stat label="Taux de victoire" value={<span className={wrTone(winrate(wins, games))}>{pct(winrate(wins, games))}</span>} />
        <Stat label="Héros joués" value={num(p.heroes.length)} />
        <Stat label="HEROS SCORE moyen" value={avgScore ?? "—"} hint="sur les dernières parties notées" />
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_1.3fr]">
        <section>
          <h2 className="title mb-4 text-xl">Héros favoris</h2>
          <div className="panel divide-y divide-white/[0.05]">
            {p.heroes.slice(0, 10).map((hRow) => {
              const wr = winrate(hRow.wins, hRow.games);
              const kda = (hRow.kills + hRow.assists) / Math.max(1, hRow.deaths);
              return (
                <HeroLink key={hRow.hero_id} id={hRow.hero_id} className="flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03]">
                  <HeroPortrait id={hRow.hero_id} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold text-white">{hero(hRow.hero_id).name}</div>
                    <div className="text-xs text-slate-400">{num(hRow.games)} parties · KDA {kda.toFixed(1).replace(".", ",")}</div>
                  </div>
                  <div className="w-24"><WinBar value={wr} /></div>
                  <span className={`w-12 text-right text-sm font-bold ${wrTone(wr)}`}>{pct(wr, 0)}</span>
                </HeroLink>
              );
            })}
          </div>
        </section>

        <section>
          <h2 className="title mb-4 text-xl">Dernières parties</h2>
          <div className="space-y-2">
            {p.recent.map((m) => <MatchRow key={m.id} m={m} />)}
          </div>
        </section>
      </div>
    </div>
  );
}

function MatchRow({ m }: { m: RecentMatch }) {
  const allies = m.others.filter((o) => o.team === m.team);
  const enemies = m.others.filter((o) => o.team !== m.team);
  return (
    <div className="panel relative flex items-center gap-3 overflow-hidden py-2.5 pl-4 pr-3">
      <span className={`absolute inset-y-0 left-0 w-1 ${m.win ? "bg-gradient-to-b from-emerald-300 to-emerald-600" : "bg-gradient-to-b from-rose-300 to-rose-600"}`} />
      <HeroLink id={m.hero_id}><HeroPortrait id={m.hero_id} size={40} /></HeroLink>
      <div className="min-w-0 flex-1 sm:w-52 sm:flex-none">
        <div className="flex items-baseline gap-2">
          <span className={`text-sm font-semibold ${m.win ? "text-emerald-300" : "text-rose-300"}`}>{m.win ? "Victoire" : "Défaite"}</span>
          <span className="truncate text-xs text-slate-400">{mapName(m.map_id)}</span>
        </div>
        <div className="truncate text-[11px] text-slate-400">{modeLabel(m.mode)} · {duration(m.duration_s)} · {since(m.played_at)}</div>
      </div>
      <div className="hidden w-20 text-center sm:block">
        <div className="text-sm font-semibold text-white">{m.kills}/{m.deaths}/{m.assists}</div>
        <div className="text-[10px] uppercase tracking-widest text-slate-500">KDA</div>
      </div>
      {m.heros_score != null && (
        <div className="hidden w-14 text-center sm:block">
          <div className="font-display text-sm font-bold text-gold-400">{m.heros_score}</div>
          <div className="text-[10px] uppercase tracking-widest text-slate-500">Score</div>
        </div>
      )}
      <div className="ml-auto hidden flex-col gap-1 md:flex">
        <div className="flex gap-0.5">{allies.map((o, i) => <HeroPortrait key={i} id={o.hero_id} size={20} />)}</div>
        <div className="flex gap-0.5 opacity-60">{enemies.map((o, i) => <HeroPortrait key={i} id={o.hero_id} size={20} />)}</div>
      </div>
    </div>
  );
}
