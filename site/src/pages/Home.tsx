import { t } from "../lib/i18n";
import { Link } from "react-router-dom";
import { DOWNLOAD_URL } from "../components/Layout";
import { HeroLink, HeroPortrait, Section, TierBadge, WinBar } from "../components/ui";
import { PlayerSearch } from "../components/PlayerSearch";
import { useApi, type HeroRow, type Overview, type PlayerSummary } from "../lib/api";
import { hero, HEROES, role } from "../lib/game";
import { adjusted, compact, MIN_GAMES, num, pct, since, tierMap, winrate, wrTone } from "../lib/stats";

export function Home() {
  const overview = useApi<Overview>("/v1/stats/overview");
  const heroes = useApi<{ total_matches: number; heroes: HeroRow[] }>("/v1/stats/heroes");
  const players = useApi<{ players: PlayerSummary[] }>("/v1/players");

  const rows = heroes.data?.heroes ?? [];
  const reliable = rows.filter((r) => r.games >= MIN_GAMES);
  const best = [...reliable].sort((a, b) => adjusted(b.wins, b.games) - adjusted(a.wins, a.games)).slice(0, 3);
  const popular = [...rows].sort((a, b) => b.games - a.games).slice(0, 6);
  const tiers = tierMap(rows);
  const o = overview.data;

  return (
    <div className="space-y-16">
      {/* Accroche */}
      <section className="relative pt-4 text-center sm:pt-10">
        <HexWall ids={(popular.length >= 12 ? [...rows].sort((a, b) => b.games - a.games).map((r) => r.hero_id) : []).concat(HEROES.map((h) => h.id))} />
        <div className="eyebrow mb-4">{t("Statistiques communautaires Heroes of the Storm")}</div>
        <h1 className="mx-auto max-w-3xl font-display text-4xl font-extrabold leading-tight text-white sm:text-6xl">
          {t("Le Nexus")} <span className="text-gradient">{t("continue")}</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-slate-400 sm:text-lg">
          {t("Tier list, talents, synergies et profils, calculés à partir des vraies parties des joueurs HOTS REVIVAL.")}
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link to="/heros" className="btn-primary px-6 py-3 text-base">{t("Voir la tier list")}</Link>
          <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn-ghost px-6 py-3 text-base">
            {t("Partager mes parties")}
          </a>
        </div>

        <div className="mx-auto mt-12 grid max-w-3xl grid-cols-3 gap-3">
          {[
            [t("Parties analysées"), o ? compact(o.matches) : "—"],
            [t("Héros joués"), heroes.data ? num(rows.length) : "—"],
            [t("Profils publics"), o ? num(o.public_profiles) : "—"],
          ].map(([label, value]) => (
            <div key={label} className="panel px-3 py-4">
              <div className="font-display text-2xl font-bold text-white sm:text-3xl">{value}</div>
              <div className="mt-1 text-[11px] uppercase tracking-widest text-slate-400">{label}</div>
            </div>
          ))}
        </div>
        {o?.aggregated_at && <p className="mt-3 text-xs text-slate-500">{t("Statistiques mises à jour {when}", { when: since(o.aggregated_at) })}</p>}
      </section>

      {/* Héros du moment */}
      {best.length > 0 && (
        <Section eyebrow={t("Au sommet")} title={t("Les héros du moment")}
          action={<Link to="/heros" className="text-sm text-storm-300 hover:text-white">{t("Tier list complète →")}</Link>}>
          <div className="grid gap-4 sm:grid-cols-3">
            {best.map((r, i) => {
              const h = hero(r.hero_id);
              const wr = winrate(r.wins, r.games);
              return (
                <HeroLink key={r.hero_id} id={r.hero_id}
                  className="panel panel-hover group relative flex items-center gap-4 overflow-hidden p-5 animate-rise"
                >
                  <div className="absolute -right-6 -top-10 font-display text-[120px] font-extrabold leading-none text-white/[0.03]">{i + 1}</div>
                  <HeroPortrait id={r.hero_id} size={64} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate font-display text-lg font-bold text-white">{h.name}</span>
                      <TierBadge tier={tiers.get(r.hero_id)} size="sm" />
                    </div>
                    <div className="text-xs" style={{ color: role(h.role).color }}>{role(h.role).label}</div>
                    <div className={`mt-2 text-sm font-semibold ${wrTone(wr)}`}>{pct(wr)} <span className="font-normal text-slate-400">· {t("{n} parties", { n: num(r.games) })}</span></div>
                  </div>
                </HeroLink>
              );
            })}
          </div>
        </Section>
      )}

      <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr]">
        {/* Les plus joués */}
        <Section eyebrow={t("Popularité")} title={t("Les plus joués")}>
          <div className="panel divide-y divide-white/[0.05]">
            {heroes.loading && !rows.length && <div className="p-6 text-sm text-slate-400">{t("Chargement…")}</div>}
            {heroes.error && <div className="p-6 text-sm text-rose-300">{t("Statistiques indisponibles : {e}", { e: heroes.error.message })}</div>}
            {popular.map((r) => {
              const h = hero(r.hero_id);
              const wr = winrate(r.wins, r.games);
              const total = heroes.data!.total_matches;
              return (
                <HeroLink key={r.hero_id} id={r.hero_id} className="flex items-center gap-3 px-4 py-3 transition hover:bg-white/[0.03]">
                  <HeroPortrait id={r.hero_id} size={36} />
                  <div className="w-32 truncate font-medium text-white">{h.name}</div>
                  <div className="hidden flex-1 sm:block"><WinBar value={wr} /></div>
                  <div className={`w-16 text-right text-sm font-semibold ${wrTone(wr)}`}>{pct(wr, 0)}</div>
                  <div className="w-20 text-right text-xs text-slate-400">{t("{p} joué", { p: pct(r.games / total, 0) })}</div>
                </HeroLink>
              );
            })}
          </div>
        </Section>

        {/* Communauté */}
        <Section eyebrow={t("Communauté")} title={t("Les joueurs")}>
          <div className="panel space-y-4 p-5">
            <PlayerSearch />
            <div className="space-y-1">
              {(players.data?.players ?? []).slice(0, 5).map((p) => (
                <Link key={p.slug} to={`/joueurs/${p.slug}`} className="flex items-center justify-between rounded-lg px-3 py-2 transition hover:bg-white/[0.04]">
                  <span className="font-medium text-white">{p.name.split("#")[0]}{p.name.includes("#") && <span className="text-slate-400">#{p.name.split("#")[1]}</span>}</span>
                  {!!p.games && <span className="text-xs text-slate-400">{t("{n} parties", { n: num(p.games) })} · {pct(winrate(p.wins ?? 0, p.games), 0)}</span>}
                </Link>
              ))}
              {players.data && !players.data.players.length && <p className="text-sm text-slate-400">{t("Aucun profil public pour l'instant.")}</p>}
              {players.error && <p className="text-sm text-rose-300">{t("Profils indisponibles pour le moment.")}</p>}
            </div>
            <Link to="/joueurs" className="block text-sm text-storm-300 hover:text-white">{t("Tous les joueurs →")}</Link>
          </div>
        </Section>
      </div>

      {/* Comment ça marche */}
      <Section eyebrow={t("Rejoindre le mouvement")} title={t("Comment ça marche")}>
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            ["1", t("Installez l'appli"), t("HOTS REVIVAL analyse vos replays sur votre PC : profil, rapport de partie, coach IA.")],
            ["2", t("Partagez vos parties"), t("Une case à cocher. Seul un résumé est envoyé, comptes pseudonymisés : ni replay, ni chat, ni pseudo.")],
            ["3", t("Le Nexus en profite"), t("Chaque partie enrichit la tier list, les talents et les synergies pour toute la communauté.")],
          ].map(([n, title, d]) => (
            <div key={n} className="panel p-5">
              <div className="hex mb-3 flex h-10 w-9 items-center justify-center bg-gradient-to-br from-nexus-500 to-storm-600 font-display font-bold text-white">{n}</div>
              <div className="font-semibold text-white">{title}</div>
              <p className="mt-1 text-sm text-slate-400">{d}</p>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

/** Mosaïque de portraits en fond de l'accroche, façon écran de sélection des héros. */
function HexWall({ ids }: { ids: string[] }) {
  const unique = [...new Set(ids)].filter((id) => hero(id).portrait).slice(0, 64);
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-8 bottom-10 -z-10 overflow-hidden opacity-[0.14]"
      style={{ maskImage: "radial-gradient(50% 55% at 50% 42%, transparent 30%, black 80%), linear-gradient(black 70%, transparent)", maskComposite: "intersect" }}>
      <div className="absolute left-1/2 top-0 flex w-[1000px] -translate-x-1/2 flex-wrap justify-center gap-x-1.5 gap-y-0">
        {unique.map((id, i) => (
          <div key={id} className={Math.floor(i / 16) % 2 ? "translate-x-[30px]" : ""}>
            <HeroPortrait id={id} size={56} className="-mb-3" />
          </div>
        ))}
      </div>
    </div>
  );
}
