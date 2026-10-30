import { t } from "../lib/i18n";
import { usePageMeta } from "../lib/seo";
import { useMemo } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { HeroLink, HeroPortrait, Loading, Notice, RoleIcon, Segmented, TierBadge, WinBar } from "../components/ui";
import { modeQuery, useApi, type HeroDetail, type HeroRow } from "../lib/api";
import { hero, HEROES, mapName, MODES, role, talentIconUrl, type Talent } from "../lib/game";
import { adjusted, num, pct, tierMap, winrate, wrTone } from "../lib/stats";
import { DataSource } from "../components/ui";
import type { Overview } from "../lib/api";

type Tab = "talents" | "maps" | "synergies";
const TABS: { id: Tab; fr: string }[] = [
  { id: "talents", fr: "Talents" },
  { id: "maps", fr: "Cartes" },
  { id: "synergies", fr: "Synergies" },
];
const LEVELS = [1, 4, 7, 10, 13, 16, 20];
const MIN_PAIR = 3;

export function HeroPage() {
  const { id = "" } = useParams();
  const known = HEROES.some((x) => x.id === id);
  usePageMeta(known ? hero(id).name : t("Héros introuvable"), { noindex: !known });
  if (!known) {
    return (
      <Notice title={t("Héros introuvable")}>
        {t("Ce héros n'existe pas dans le Nexus.")} <Link to="/heros" className="text-storm-300 hover:text-white">{t("Voir tous les héros")}</Link>
      </Notice>
    );
  }
  return <HeroView key={id} id={id} />;
}

function HeroView({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const mode = params.get("mode");
  const tab = (TABS.find((x) => x.id === params.get("onglet"))?.id ?? "talents") as Tab;
  const update = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };
  const h = hero(id);

  const list = useApi<{ total_matches: number; heroes: HeroRow[] }>(`/v1/stats/heroes${modeQuery(mode)}`);
  const detail = useApi<HeroDetail>(`/v1/stats/heroes/${id}${modeQuery(mode)}`);
  const catalog = useApi<Record<string, Talent>>(`/data/talents/${id}.json`);
  const overview = useApi<Overview>("/v1/stats/overview");

  const row = list.data?.heroes.find((r) => r.hero_id === id);
  const total = list.data?.total_matches ?? 0;
  const tier = useMemo(() => tierMap(list.data?.heroes ?? []).get(id), [list.data, id]);
  const setMode = (m: string | null) => update("mode", m);
  const setTab = (t: Tab) => update("onglet", t === "talents" ? null : t);

  return (
    <div className="space-y-8">
      <Link to="/heros" className="text-sm text-slate-400 hover:text-white">{t("← Tous les héros")}</Link>

      {/* En-tête du héros */}
      <header className="panel relative overflow-hidden p-6 sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full opacity-30 blur-3xl"
          style={{ background: role(h.role).color }} />
        <div className="relative flex flex-col gap-6 sm:flex-row sm:items-center">
          <HeroPortrait id={id} size={112} />
          <div className="flex-1">
            <div className="flex items-center gap-2 text-sm" style={{ color: role(h.role).color }}>
              <RoleIcon role={h.role} /> {role(h.role).label}
            </div>
            <h1 className="title-gold mt-1 text-4xl sm:text-5xl">{h.name}</h1>
          </div>
          {row && (
            <div className="grid grid-cols-3 gap-3 sm:w-80">
              <div className="flex flex-col items-center justify-center rounded-xl bg-void-950/50 p-3">
                <TierBadge tier={tier} size="lg" />
                <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">{t("Tier")}</span>
              </div>
              <Kpi label={t("Taux de victoire")} value={pct(winrate(row.wins, row.games))} tone={wrTone(winrate(row.wins, row.games))} />
              <Kpi label={t("Parties")} value={num(row.games)} hint={t("{p} des parties", { p: pct(row.games / Math.max(1, total), 0) })} />
            </div>
          )}
        </div>
      </header>

      <DataSource overview={overview.data} variant="banner" />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented<Tab> value={tab} options={TABS.map((x) => ({ id: x.id, label: t(x.fr) }))} onChange={setTab} />
        <Segmented value={mode} options={MODES} onChange={setMode} />
      </div>

      {detail.error?.status === 404 || (list.data && !row) ? (
        <Notice title={t("Pas encore de données pour ce héros")}>
          {t(mode ? "Personne n'a encore partagé de partie avec {name} dans ce mode. Soyez le premier !" : "Personne n'a encore partagé de partie avec {name}. Soyez le premier !", { name: h.name })}
          {mode && <div className="mt-4"><button className="btn-ghost" onClick={() => setMode(null)}>{t("Voir tous les modes")}</button></div>}
        </Notice>
      ) : detail.error ? (
        <Notice title={t("Statistiques indisponibles")} tone="error">{detail.error.message}</Notice>
      ) : !detail.data || !catalog.data && catalog.loading ? (
        <Loading />
      ) : (
        <>
          {tab === "talents" && <Talents detail={detail.data} catalog={catalog.data ?? {}} />}
          {tab === "maps" && <Maps detail={detail.data} />}
          {tab === "synergies" && <Synergies detail={detail.data} name={h.name} />}
          <DataSource overview={overview.data} matches={total} />
        </>
      )}
    </div>
  );
}

function Kpi({ label, value, hint, tone = "text-white" }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl bg-void-950/50 p-3 text-center">
      <span className={`font-display text-xl font-bold ${tone}`}>{value}</span>
      <span className="mt-1 text-[10px] uppercase tracking-widest text-slate-400">{label}</span>
      {hint && <span className="text-[10px] text-slate-500">{hint}</span>}
    </div>
  );
}

// ------------------------------------------------------------------ Talents

function Talents({ detail, catalog }: { detail: HeroDetail; catalog: Record<string, Talent> }) {
  const tiers = useMemo(() => LEVELS.map((level, i) => {
    const stats = detail.talents.filter((x) => x.tier === i + 1);
    const played = stats.reduce((s, x) => s + x.games, 0);
    const ids = new Set([...Object.entries(catalog).filter(([, x]) => x.level === level).map(([tid]) => tid), ...stats.map((x) => x.talent)]);
    const items = [...ids].map((tid) => {
      const s = stats.find((x) => x.talent === tid);
      return { id: tid, info: catalog[tid], games: s?.games ?? 0, wins: s?.wins ?? 0 };
    }).sort((a, b) => (a.info?.sort ?? 99) - (b.info?.sort ?? 99));
    const best = items.filter((x) => x.games > 0).sort((a, b) => adjusted(b.wins, b.games) - adjusted(a.wins, a.games))[0];
    return { level, played, items, best: best?.id };
  }), [detail, catalog]);

  if (!detail.talents.length) return <Notice title={t("Pas encore de talents enregistrés")} />;
  const build = tiers.flatMap((x) => {
    const item = x.items.find((i) => i.id === x.best);
    return item ? [{ ...item, level: x.level }] : [];
  });

  return (
    <div className="space-y-6">
      {build.length > 0 && (
        <div className="panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
          <div className="sm:w-48">
            <div className="eyebrow">{t("Build de la communauté")}</div>
            <p className="mt-1 text-xs text-slate-400">{t("Le talent le plus gagnant de chaque palier.")}</p>
          </div>
          <div className="flex flex-wrap gap-3">
            {build.map((x) => (
              <div key={x.id} className="flex flex-col items-center gap-1">
                <TalentIcon talent={x.info} id={x.id} size={48} highlight />
                <span className="text-[10px] text-slate-400">{t("Niv. {n}", { n: x.level })}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="panel divide-y divide-white/[0.05]">
        {tiers.map((tier) => (
          <div key={tier.level} className="flex flex-col gap-3 p-4 sm:flex-row">
            <div className="flex w-20 shrink-0 items-center gap-2 sm:flex-col sm:items-start">
              <span className="font-display text-2xl font-bold text-gold-400">{tier.level}</span>
              <span className="text-[10px] uppercase tracking-widest text-slate-400">{t("Niveau")}</span>
            </div>
            <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {tier.items.map((x) => {
                const share = tier.played ? x.games / tier.played : 0;
                const wr = winrate(x.wins, x.games);
                return (
                  <div key={x.id} tabIndex={x.info?.description ? 0 : undefined}
                    aria-label={x.info ? `${x.info.name} : ${x.info.description}` : undefined}
                    className={`group relative flex items-center gap-3 rounded-xl border p-2.5 ${
                    x.id === tier.best ? "border-gold-500/50 bg-gold-500/[0.06]" : "border-white/[0.05] bg-void-950/30"} ${x.games ? "" : "opacity-45"}`}>
                    <TalentIcon talent={x.info} id={x.id} size={40} highlight={x.id === tier.best} />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-white">{x.info?.name ?? x.id}</div>
                      <div className="mt-0.5 flex gap-3 text-xs">
                        <span className="text-slate-400">{t("{p} choisi", { p: pct(share, 0) })}</span>
                        {x.games > 0 && <span className={wrTone(wr)}>{t("{p} vict.", { p: pct(wr, 0) })}</span>}
                      </div>
                    </div>
                    {x.info?.description && (
                      <div className="panel pointer-events-none absolute bottom-full left-0 z-20 mb-2 hidden w-72 p-3 text-xs leading-relaxed text-slate-300 group-hover:block group-focus:block">
                        <div className="mb-1 font-semibold text-white">{x.info.name}</div>
                        {x.info.description}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400">{t("Survolez ou touchez un talent pour lire sa description (en anglais). Les talents grisés n'ont pas encore été joués.")}</p>
    </div>
  );
}

function TalentIcon({ talent, id, size, highlight = false }: { talent?: Talent; id: string; size: number; highlight?: boolean }) {
  const url = talent ? talentIconUrl(talent) : null;
  return (
    <span className={`block shrink-0 overflow-hidden rounded-lg border-2 ${highlight ? "border-gold-400 shadow-gold" : "border-void-600"}`}
      style={{ width: size, height: size }} title={talent?.name ?? id}>
      {url ? <img src={url} alt={talent?.name ?? id} loading="lazy" className="h-full w-full object-cover" />
        : <span className="flex h-full w-full items-center justify-center bg-void-700 text-xs text-slate-400">?</span>}
    </span>
  );
}

// ------------------------------------------------------------------ Cartes

function Maps({ detail }: { detail: HeroDetail }) {
  const rows = [...detail.maps].sort((a, b) => adjusted(b.wins, b.games) - adjusted(a.wins, a.games));
  return (
    <div className="panel divide-y divide-white/[0.05]">
      {rows.map((m) => {
        const wr = winrate(m.wins, m.games);
        return (
          <div key={m.map_id} className="flex items-center gap-4 px-5 py-3">
            <span className="w-48 truncate font-medium text-white">{mapName(m.map_id)}</span>
            <div className="flex-1"><WinBar value={wr} /></div>
            <span className={`w-16 text-right text-sm font-bold ${wrTone(wr)}`}>{pct(wr, 0)}</span>
            <span className="w-20 text-right text-xs text-slate-400">{t("{n} parties", { n: num(m.games) })}</span>
          </div>
        );
      })}
    </div>
  );
}

// ------------------------------------------------------------------ Synergies

function Synergies({ detail, name }: { detail: HeroDetail; name: string }) {
  // Colonnes disjointes : au-dessus de 50 % (lissé) pour alliés et proies, en dessous pour les bêtes noires.
  const pick = (relation: "with" | "vs", dir: 1 | -1) => detail.pairs
    .filter((p) => p.relation === relation && p.games >= MIN_PAIR && dir * (adjusted(p.wins, p.games) - 0.5) > 0)
    .sort((a, b) => dir * (adjusted(b.wins, b.games) - adjusted(a.wins, a.games)))
    .slice(0, 6);
  const columns = [
    { title: t("Meilleurs alliés"), hint: t("{name} gagne le plus avec eux", { name }), rows: pick("with", 1) },
    { title: t("Ses proies"), hint: t("{name} gagne le plus contre eux", { name }), rows: pick("vs", 1) },
    { title: t("Ses bêtes noires"), hint: t("{name} perd le plus contre eux", { name }), rows: pick("vs", -1) },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {columns.map((c) => (
        <div key={c.title} className="panel p-5">
          <div className="title text-lg">{c.title}</div>
          <p className="mb-4 text-xs text-slate-400">{c.hint}</p>
          {c.rows.length ? (
            <div className="space-y-2">
              {c.rows.map((p) => {
                const wr = winrate(p.wins, p.games);
                return (
                  <HeroLink key={p.other_id} id={p.other_id} className="flex items-center gap-3 rounded-lg p-1.5 transition hover:bg-white/[0.04]">
                    <HeroPortrait id={p.other_id} size={34} />
                    <span className="flex-1 truncate text-sm text-white">{hero(p.other_id).name}</span>
                    <span className={`text-sm font-semibold ${wrTone(wr)}`}>{pct(wr, 0)}</span>
                    <span className="w-16 text-right text-[11px] text-slate-400">{t("{n} parties", { n: num(p.games) })}</span>
                  </HeroLink>
                );
              })}
            </div>
          ) : <p className="text-sm text-slate-400">{t("Pas encore assez de parties (au moins {n} par duo, avec un écart net à 50 %).", { n: MIN_PAIR })}</p>}
        </div>
      ))}
    </div>
  );
}
