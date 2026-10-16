import { t } from "../lib/i18n";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DataSource, HeroLink, HeroPortrait, Loading, Notice, RoleIcon, Segmented, TierBadge, WinBar } from "../components/ui";
import { modeQuery, useApi, type HeroRow, type Overview } from "../lib/api";
import { hero, MAPS, MODES, role, ROLES, type Role } from "../lib/game";
import { adjusted, MIN_GAMES, num, pct, ratio, tierMap, winrate, wrTone, type Tier } from "../lib/stats";

type Sort = "tier" | "popularity";

export function Heroes() {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode");
  const map = params.get("map");
  const roleFilter = params.get("role") as Role | null;
  const sort = (params.get("tri") as Sort) ?? "tier";
  const [search, setSearch] = useState("");
  const [showLow, setShowLow] = useState(false);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  };
  const set = (key: string, value: string | null) => update({ [key]: value });

  const api = useApi<{ total_matches: number; heroes: HeroRow[] }>(`/v1/stats/heroes${modeQuery(mode, { map })}`);
  const { error, loading } = api;
  const overview = useApi<Overview>("/v1/stats/overview");
  const data = api.data ?? api.previous;

  const { ranked, low } = useMemo(() => {
    const term = search.trim().toLowerCase();
    const rows = (data?.heroes ?? []).filter((r) => {
      const h = hero(r.hero_id);
      return (!roleFilter || h.role === roleFilter) && (!term || h.name.toLowerCase().includes(term));
    });
    const by = sort === "tier"
      ? (a: HeroRow, b: HeroRow) => adjusted(b.wins, b.games) - adjusted(a.wins, a.games)
      : (a: HeroRow, b: HeroRow) => b.games - a.games;
    return {
      ranked: rows.filter((r) => r.games >= MIN_GAMES).sort(by),
      low: rows.filter((r) => r.games < MIN_GAMES).sort(by),
    };
  }, [data, roleFilter, search, sort]);

  const total = data?.total_matches ?? 0;
  const tiers = useMemo(() => tierMap(data?.heroes ?? []), [data]);
  const maps = MAPS.filter((m) => (mode === "ARAM" ? m.aram : !m.aram));

  return (
    <div className="space-y-6">
      <header>
        <div className="eyebrow mb-1">{t("Tier list communautaire")}</div>
        <h1 className="title text-3xl sm:text-4xl">{t("Héros")}</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          {t("Classement par taux de victoire, pondéré par le nombre de parties : un héros peu joué reste proche de 50 % tant que l'échantillon ne permet pas de conclure.")}
        </p>
      </header>

      {/* Filtres */}
      <div className="panel space-y-4 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented value={mode} options={MODES} onChange={(v) => update({ mode: v, map: null })} />
          <select value={map ?? ""} onChange={(e) => set("map", e.target.value || null)} aria-label={t("Carte")} className="w-full sm:w-auto sm:min-w-48">
            <option value="">{t("Toutes les cartes")}</option>
            {maps.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("Rechercher un héros…")}
            className="w-full sm:w-auto sm:min-w-0 sm:max-w-56 sm:flex-1" aria-label={t("Rechercher un héros")} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className={`chip ${!roleFilter ? "chip-active" : ""}`} onClick={() => set("role", null)}>{t("Tous les rôles")}</button>
          {ROLES.map((r) => (
            <button key={r.id} className={`chip ${roleFilter === r.id ? "chip-active" : ""}`}
              onClick={() => set("role", roleFilter === r.id ? null : r.id)}>
              <RoleIcon role={r.id} size={13} /> {r.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 text-xs text-slate-400">
            {t("Trier par")}
            <Segmented<Sort> value={sort} onChange={(v) => set("tri", v === "tier" ? null : v)}
              options={[{ id: "tier", label: t("Tier") }, { id: "popularity", label: t("Popularité") }]} />
          </div>
        </div>
      </div>

      <DataSource overview={overview.data} variant="banner" />
      {loading && !data && <Loading />}
      {error && <Notice title={t("Statistiques indisponibles")} tone="error">{error.message}</Notice>}
      {data && !data.heroes.length && (
        <Notice title={t("Pas encore de parties ici")}>{t("Aucune partie partagée pour ce filtre. Essayez un autre mode ou une autre carte.")}</Notice>
      )}

      {data && data.heroes.length > 0 && (
        <>
          <div className="text-xs text-slate-400">
            {t("{n} parties · {h} héros classés", { n: num(Math.round(total)), h: ranked.length })}{loading && t(" · mise à jour…")}
          </div>
          <div className={`space-y-6 transition-opacity ${loading ? "opacity-50" : ""}`}>
          <HeroTable rows={ranked} total={total} tiers={tiers} />
          {low.length > 0 && (
            <div>
              <button className="chip" onClick={() => setShowLow((v) => !v)}>
                {t(showLow ? "Masquer les {n} héros à confirmer (moins de {min} parties)" : "Afficher les {n} héros à confirmer (moins de {min} parties)", { n: low.length, min: MIN_GAMES })}
              </button>
              {showLow && <div className="mt-3 opacity-70"><HeroTable rows={low} total={total} tiers={tiers} /></div>}
            </div>
          )}
          {!ranked.length && !low.length && <Notice title={t("Aucun héros ne correspond")}>{t("Modifiez les filtres.")}</Notice>}
          </div>
          <DataSource overview={overview.data} matches={total} />
        </>
      )}
    </div>
  );
}

function HeroTable({ rows, total, tiers }: { rows: HeroRow[]; total: number; tiers: Map<string, Tier> }) {
  if (!rows.length) return null;
  return (
    <div className="panel overflow-hidden">
      <div className="hidden grid-cols-[48px_1fr_180px_90px_90px_90px] gap-4 border-b border-white/[0.06] px-4 py-2.5 text-[11px] font-semibold uppercase tracking-widest text-slate-400 md:grid">
        <span>{t("Tier")}</span><span>{t("Héros")}</span><span>{t("Taux de victoire")}</span><span className="text-right">{t("Parties")}</span>
        <span className="text-right">{t("Popularité")}</span><span className="text-right">KDA</span>
      </div>
      <div className="divide-y divide-white/[0.04]">
        {rows.map((r) => {
          const h = hero(r.hero_id);
          const wr = winrate(r.wins, r.games);
          const kda = (r.kills + r.assists) / Math.max(1, r.deaths);
          return (
            <HeroLink key={r.hero_id} id={r.hero_id}
              className="grid grid-cols-[40px_1fr_auto] items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.03] md:grid-cols-[48px_1fr_180px_90px_90px_90px] md:gap-4">
              <TierBadge tier={tiers.get(r.hero_id)} />
              <div className="flex min-w-0 items-center gap-3">
                <HeroPortrait id={r.hero_id} size={40} />
                <div className="min-w-0">
                  <div className="truncate font-semibold text-white">{h.name}</div>
                  <div className="flex items-center gap-1 text-xs text-slate-400"><RoleIcon role={h.role} size={11} />{role(h.role).label}</div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`w-14 text-right text-sm font-bold md:text-left ${wrTone(wr)}`}>{pct(wr)}</span>
                <div className="hidden flex-1 md:block"><WinBar value={wr} /></div>
              </div>
              <span className="hidden text-right text-sm text-slate-300 md:block">{num(r.games)}</span>
              <span className="hidden text-right text-sm text-slate-400 md:block">{pct(r.games / Math.max(1, total))}</span>
              <span className="hidden text-right text-sm text-slate-400 md:block">{ratio(kda)}</span>
            </HeroLink>
          );
        })}
      </div>
    </div>
  );
}
