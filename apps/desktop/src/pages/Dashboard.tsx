import { Link } from "react-router-dom";
import { Bar, Card, Empty, ErrorBox, List, Loading, Stat } from "../components/ui";
import { GoalProgressCard } from "../components/Insights";
import { ScoreRadar } from "../components/ScoreRadar";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { CATEGORY_FR, pct, ROLE_FR, scoreColor } from "../lib/format";
import { t } from "../lib/i18n";
import type { ProgressionPoint } from "../lib/types";

function Sparkline({ points }: { points: ProgressionPoint[] }) {
  const values = points.map((p) => p.heros_score ?? 0);
  if (values.length < 2) return <p className="text-sm text-slate-500">{t("Jouez quelques parties pour voir votre courbe.")}</p>;
  const w = 560, h = 120;
  const path = values
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i / (values.length - 1)) * w},${h - (v / 100) * h}`)
    .join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-32 w-full" preserveAspectRatio="none">
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="#2a3060" strokeDasharray="4 4" />
      <path d={path} fill="none" stroke="url(#g)" strokeWidth={3} />
      <defs>
        <linearGradient id="g" x1="0" x2="1">
          <stop offset="0" stopColor="#1f8fff" />
          <stop offset="1" stopColor="#a87bff" />
        </linearGradient>
      </defs>
    </svg>
  );
}

export function Dashboard() {
  const profile = useAsync(api.profile);
  const prog = useAsync(api.progression);

  if (profile.loading) return <Loading />;
  if (profile.error) return <ErrorBox message={profile.error} />;
  const p = profile.data!;

  if (!p.total.games)
    return (
      <Empty title={t("Bienvenue dans HOTS REVIVAL")}>
        <p>{t("Jouez une partie : à la fin, elle est analysée automatiquement et votre rapport apparaît ici.")}</p>
        <div className="mt-5 flex justify-center gap-3">
          <Link className="btn-gold" to="/settings">{t("Importer mes anciens replays")}</Link>
          <Link className="btn-ghost" to="/settings?tab=coach">{t("Activer le coach IA")}</Link>
        </div>
      </Empty>
    );

  const heroes = Object.entries(p.by_hero).sort((a, b) => b[1].games - a[1].games);
  const trendIcon = { up: "▲", down: "▼", stable: "■", unknown: "·" }[p.trend.direction];

  return (
    <div className="space-y-6">
      <header className="flex items-end justify-between">
        <div>
          <h1 className="title-display text-3xl">{p.player.battletag ?? p.player.name ?? t("Joueur")}</h1>
          <p className="text-sm text-slate-400">
            {t("Rôle principal :")} <b className="text-white">{ROLE_FR[p.main_role ?? ""] ?? "–"}</b> · {t("secondaire :")}{" "}
            <b className="text-white">{ROLE_FR[p.secondary_role ?? ""] ?? "–"}</b>
            {p.player.rank && <> · {t("Rang :")} <b className="text-gold-400">{p.player.rank}</b></>}
          </p>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-4">
        <Stat label={t("Winrate global")} value={pct(p.total.winrate, 1)} hint={t("{w} V / {l} D", { w: p.total.wins, l: p.total.games - p.total.wins })} tone="text-storm-300" />
        <Stat label={t("Parties analysées")} value={p.total.games} />
        <Stat label={t("HEROS SCORE moyen")} value={p.total.avg_heros_score ?? "–"}
          tone={scoreColor(p.total.avg_heros_score ?? 0)} hint={t("sur 100")} />
        <Stat label={t("Tendance (10 parties)")} value={`${trendIcon} ${pct(p.trend.last_10_winrate)}`}
          hint={t("précédentes : {winrate}", { winrate: pct(p.trend.previous_10_winrate) })}
          tone={p.trend.direction === "down" ? "text-rose-400" : "text-emerald-400"} />
      </div>

      <GoalProgressCard />

      <div className="grid grid-cols-3 gap-4">
        <Card title={t("HEROS SCORE moyen")}>
          <div className="flex justify-center"><ScoreRadar score={p.category_averages} /></div>
        </Card>
        <Card title={t("Winrate par rôle")}>
          <div className="space-y-3">
            {Object.entries(p.by_role).sort((a, b) => b[1].games - a[1].games).map(([role, b]) => (
              <div key={role}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{ROLE_FR[role] ?? role}</span>
                  <span className="text-slate-400">{pct(b.winrate)} · {t("{n} parties", { n: b.games })}</span>
                </div>
                <Bar value={(b.winrate ?? 0) * 100} />
              </div>
            ))}
          </div>
        </Card>
        <Card title={t("Synthèse")}>
          <div className="space-y-3 text-sm">
            <div>{t("Meilleur héros :")} <b className="text-gold-400">{p.best_hero ?? "–"}</b></div>
            <div>{t("Héros le plus difficile :")} <b className="text-rose-300">{p.worst_hero ?? "–"}</b></div>
            <div>
              <div className="mb-1 text-slate-400">{t("Héros à éviter pour l'instant :")}</div>
              <List items={p.heroes_to_avoid} icon="⚠" tone="text-rose-300" empty={t("Aucun — continuez ainsi.")} />
            </div>
            <div className="text-xs text-slate-500">{t("Calculs lissés (min. 3 parties par héros).")}</div>
          </div>
        </Card>
      </div>

      {p.role_balance?.advice && (
        <Card title={t("Équilibre des rôles")} className="border-gold-600/40">
          <p className="text-sm text-gold-300">{p.role_balance.advice}</p>
          <p className="mt-2 text-xs text-slate-400">{t("Demandez au coach « Quel second rôle dois-je développer ? » ou consultez la page Méta.")}</p>
        </Card>
      )}

      <Card title={t("Progression du HEROS SCORE")}>
        {prog.data ? <Sparkline points={prog.data} /> : <Loading />}
      </Card>

      <Card title={t("Héros")}>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wider text-slate-500">
            <tr><th className="py-2">{t("Héros")}</th><th>{t("Parties")}</th><th>Winrate</th><th>HEROS SCORE</th></tr>
          </thead>
          <tbody>
            {heroes.map(([id, h]) => (
              <tr key={id} className="border-t border-void-700">
                <td className="py-2 font-medium text-white">{h.hero}</td>
                <td>{h.games}</td>
                <td className={(h.winrate ?? 0) >= 0.5 ? "text-emerald-400" : "text-rose-300"}>{pct(h.winrate)}</td>
                <td className={scoreColor(h.avg_heros_score ?? 0)}>{h.avg_heros_score ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="text-xs text-slate-500">
        {t("Catégories : {list}. Le placement est estimé par des indicateurs indirects du replay.", { list: Object.values(CATEGORY_FR).join(" · ") })}
      </p>
    </div>
  );
}
