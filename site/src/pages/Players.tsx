import { t } from "../lib/i18n";
import { Link } from "react-router-dom";
import { DOWNLOAD_URL } from "../components/links";
import { PlayerSearch } from "../components/PlayerSearch";
import { Loading, Notice } from "../components/ui";
import { useApi, type PlayerSummary } from "../lib/api";
import { num, pct, winrate, wrTone } from "../lib/stats";

export function Players() {
  const { data, error, loading } = useApi<{ players: PlayerSummary[] }>("/v1/players");
  return (
    <div className="space-y-8">
      <header className="max-w-2xl">
        <div className="eyebrow mb-1">{t("Communauté")}</div>
        <h1 className="title text-3xl sm:text-4xl">{t("Joueurs")}</h1>
        <p className="mt-2 text-sm text-slate-400">
          {t("Les profils des joueurs qui ont choisi de les rendre publics depuis l'application. Les autres n'apparaissent jamais par leur nom.")}
        </p>
      </header>

      <div className="max-w-xl"><PlayerSearch autoFocus /></div>

      <section>
        <h2 className="eyebrow mb-3">{t("Derniers profils publics")}</h2>
        {loading && <Loading />}
        {error && <Notice title={t("Profils indisponibles")} tone="error">{error.message}</Notice>}
        {data && !data.players.length && (
          <Notice title={t("Aucun profil public pour l'instant.")}>
            {t("Activez « Profil public » dans les Paramètres de l'application pour apparaître ici.")}
          </Notice>
        )}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data?.players.map((p) => {
            const [name, tag] = p.name.split("#");
            const wr = winrate(p.wins ?? 0, p.games ?? 0);
            return (
              <Link key={p.slug} to={`/joueurs/${p.slug}`} className="panel panel-hover flex items-center gap-4 p-4">
                <span className="hex flex h-12 w-11 items-center justify-center bg-gradient-to-br from-nexus-500 to-storm-600 font-display text-lg font-bold text-white">
                  {name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-white">{name}{tag && <span className="font-normal text-slate-400">#{tag}</span>}</div>
                  {!!p.games && <div className="text-xs text-slate-400">{t("{n} parties", { n: num(p.games) })} · <span className={wrTone(wr)}>{pct(wr, 0)}</span></div>}
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="panel flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="title text-lg">{t("Votre profil ici")}</div>
          <p className="text-sm text-slate-400">{t("Installez HOTS REVIVAL puis cochez « Profil public » dans les Paramètres.")}</p>
        </div>
        <a href={DOWNLOAD_URL} target="_blank" rel="noreferrer" className="btn-primary">{t("Télécharger l'appli")}</a>
      </div>
    </div>
  );
}
