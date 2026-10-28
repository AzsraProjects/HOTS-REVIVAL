/**
 * Débrief explicable : avantages convertis ou perdus, « Sur quoi tu te bases ? », objectif personnel
 * suivi et marque-pages posés en jeu. Tout vient des faits du replay calculés par le moteur.
 */
import { useState } from "react";
import { Link } from "react-router-dom";
import { useAsync } from "../hooks/useAsync";
import { api } from "../lib/api";
import { t } from "../lib/i18n";
import type { AdvantageMoment, AdvantageTimeline, Bookmark, GoalProgress, GoalResult, GoalSuggestion } from "../lib/types";
import { Card } from "./ui";

/** Liste du rapport : chaque point produit par une règle peut afficher la règle et les valeurs utilisées. */
export function BasisList({ items, basis, icon = "•", tone = "text-slate-300", empty }: {
  items: string[]; basis?: Record<string, string>; icon?: string; tone?: string; empty?: string;
}) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) return <p className="text-sm text-slate-500">{empty ?? t("Rien à signaler.")}</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className={`text-sm ${tone}`}>
          <div className="flex gap-2">
            <span className="select-none">{icon}</span>
            <span className="flex-1">{it}</span>
            {basis?.[it] && (
              <button className="text-xs text-slate-500 hover:text-white" title={t("Sur quoi tu te bases ?")}
                onClick={() => setOpen(open === i ? null : i)}>?</button>
            )}
          </div>
          {open === i && basis?.[it] && <p className="ml-6 mt-1 text-xs text-slate-400">{basis[it]}</p>}
        </li>
      ))}
    </ul>
  );
}

function Moment({ m }: { m: AdvantageMoment }) {
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState(false);
  const ours = m.side === "allies";
  const badge = ours
    ? m.converted ? ["text-emerald-300 border-emerald-500/50", t("Converti")] : ["text-gold-300 border-gold-500/50", t("À revoir")]
    : m.converted ? ["text-rose-300 border-rose-500/50", t("Avantage adverse")] : ["text-slate-300 border-void-600", t("Repoussé")];
  return (
    <li className="border-t border-void-700 py-2 first:border-t-0">
      <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(!open)}>
        <span className="w-12 shrink-0 font-mono text-sm text-white">{m.clock}</span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] ${badge[0]}`}>{badge[1]}</span>
        <span className="flex-1 text-sm text-slate-300">{m.fact}</span>
        <span className="text-xs text-slate-500">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="ml-[3.75rem] mt-2 space-y-2 text-sm">
          <div><span className="text-xs uppercase tracking-wider text-slate-500">{t("Interprétation")}</span>
            <p className="text-slate-200">{m.interpretation}</p></div>
          {m.alternative && (
            <div><span className="text-xs uppercase tracking-wider text-slate-500">{t("Alternative à examiner")}</span>
              <p className="text-gold-300">{m.alternative}</p></div>
          )}
          <div><span className="text-xs uppercase tracking-wider text-slate-500">{t("Limites")}</span>
            <ul className="text-xs text-slate-400">{m.limits.map((l) => <li key={l}>· {l}</li>)}</ul></div>
          <button className="text-xs text-storm-300 hover:text-white" onClick={() => setProof(!proof)}>
            {proof ? t("Masquer les données") : t("Sur quoi tu te bases ?")}
          </button>
          {proof && (
            <div className="rounded-lg bg-void-900/70 p-2 text-xs text-slate-400">
              <table className="w-full">
                <thead className="text-left text-slate-500">
                  <tr><th>{t("Mort")}</th><th>{t("Héros")}</th><th>{t("Éliminé par")}</th><th>{t("Réapparition")}</th></tr>
                </thead>
                <tbody>
                  {m.evidence.deaths.map((d, i) => (
                    <tr key={i} className={d.side === "allies" ? "text-storm-300" : "text-rose-300"}>
                      <td className="font-mono">{d.clock}</td>
                      <td>{d.hero}{d.me && ` ${t("(vous)")}`}</td>
                      <td>{d.killers.join(", ") || "–"}</td>
                      <td className="font-mono">{d.respawn}{!d.respawn_measured && ` (${t("estimée")})`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2">{t("Fenêtre d'avantage : {from} → {to}.", { from: m.evidence.window.from, to: m.evidence.window.to })}</p>
              {m.evidence.gains.length > 0 && <p>{t("Obtenu : {list}.", { list: m.evidence.gains.join(", ") })}</p>}
            </div>
          )}
        </div>
      )}
    </li>
  );
}

export function AdvantagesCard({ timeline }: { timeline?: AdvantageTimeline }) {
  const [rule, setRule] = useState(false);
  if (!timeline) {
    return (
      <Card title={t("Avantages convertis ou perdus")}>
        <p className="text-sm text-slate-500">{t("Analyse indisponible pour cette partie : elle apparaîtra après la réanalyse de l'historique.")}</p>
      </Card>
    );
  }
  return (
    <Card title={t("Avantages convertis ou perdus")} className="border-storm-600/40"
      action={<button className="text-xs text-slate-500 hover:text-white" onClick={() => setRule(!rule)}>{t("Méthode")}</button>}>
      <p className="text-sm text-white">{timeline.headline}</p>
      {rule && <p className="mt-2 rounded-lg bg-void-900/70 p-2 text-xs text-slate-400">{timeline.rule}</p>}
      {timeline.moments.length ? (
        <ul className="mt-3">{timeline.moments.map((m) => <Moment key={`${m.t_s}-${m.side}`} m={m} />)}</ul>
      ) : (
        <p className="mt-2 text-sm text-slate-500">{t("Aucun combat n'a créé d'écart d'au moins deux héros.")}</p>
      )}
      <p className="mt-3 text-xs text-slate-500">{t("Un avantage non converti est une opportunité à revoir, pas une erreur certaine.")}</p>
    </Card>
  );
}

// ---- objectif personnel -------------------------------------------------------------------------
const formatValue = (value: number | null, unit: string) =>
  value === null ? "–" : unit === "%" ? `${value} %` : unit ? `${value} ${unit}` : String(value);

function ResultBadge({ r }: { r: Pick<GoalResult, "success"> }) {
  if (r.success === null) return <span className="text-slate-500" title={t("Non mesurable sur cette partie")}>–</span>;
  return r.success ? <span className="text-emerald-300">✔</span> : <span className="text-rose-300">✖</span>;
}

function GoalPicker({ matchId, onSet }: { matchId: number; onSet: () => void }) {
  const options = useAsync(() => api.goals.suggestions(matchId), [matchId]);
  const [picked, setPicked] = useState<GoalSuggestion | null>(null);
  const [target, setTarget] = useState(0);
  const [saving, setSaving] = useState(false);
  if (!options.data) return null;
  const suggested = options.data.filter((o) => o.suggested);
  const choose = (o: GoalSuggestion) => { setPicked(o); setTarget(o.target); };
  const save = async () => {
    if (!picked) return;
    setSaving(true);
    try {
      await api.goals.set(picked.key, target, matchId);
      onSet();
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="space-y-2">
      <p className="text-sm text-slate-400">{t("Choisissez un seul chantier pour vos prochaines parties : il sera rappelé au chargement et mesuré à chaque débrief.")}</p>
      <div className="flex flex-wrap gap-2">
        {(suggested.length ? suggested : options.data).map((o) => (
          <button key={o.key} className={`chip ${picked?.key === o.key ? "border-gold-400 text-gold-300" : "hover:text-white"}`}
            onClick={() => choose(o)} title={o.reason ?? undefined}>{o.label}</button>
        ))}
        {suggested.length > 0 && (
          <select className="chip bg-transparent" value="" onChange={(e) => {
            const o = options.data!.find((x) => x.key === e.target.value);
            if (o) choose(o);
          }}>
            <option value="">{t("Autre objectif…")}</option>
            {options.data.filter((o) => !o.suggested).map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        )}
      </div>
      {picked && (
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {picked.reason && <span className="text-xs text-slate-400">{picked.reason}</span>}
          <label className="flex items-center gap-2 text-xs text-slate-400">{t("Seuil")}
            <input type="number" min={0} max={100} step={picked.key === "camps" ? 0.5 : 1} className="w-20"
              value={target} onChange={(e) => setTarget(Number(e.target.value))} />
          </label>
          <button className="btn-gold py-1" onClick={save} disabled={saving}>{t("En faire mon objectif")}</button>
        </div>
      )}
    </div>
  );
}

/** Rapport de partie : bilan de l'objectif actif sur cette partie, ou choix d'un objectif. */
export function GoalReportCard({ matchId }: { matchId: number }) {
  const bilan = useAsync(() => api.goals.forMatch(matchId), [matchId]);
  const [changing, setChanging] = useState(false);
  if (bilan.loading) return null;
  const b = bilan.data;
  const done = () => { setChanging(false); bilan.reload(); };
  return (
    <Card title={t("Mon objectif")} className="border-gold-600/40"
      action={b && !changing ? <button className="text-xs text-slate-500 hover:text-white" onClick={() => setChanging(true)}>{t("Changer")}</button> : undefined}>
      {b && !changing ? (
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            <span className="text-lg"><ResultBadge r={b.result} /></span>
            <span className="flex-1 text-white">{b.goal.label}</span>
            <span className="font-mono text-slate-300">
              {formatValue(b.result.value, b.result.unit)} / {formatValue(b.result.target, b.result.unit)}
            </span>
          </div>
          {!b.in_period && <p className="text-xs text-slate-500">{t("Partie jouée avant le choix de cet objectif : elle ne compte pas dans le suivi.")}</p>}
          {b.result.note && <p className="text-xs text-slate-400">{b.result.note}</p>}
          {b.result.situations.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-500">{t("Situations à revoir")}</div>
              <ul className="text-sm text-slate-300">{b.result.situations.map((s) => <li key={s}>· {s}</li>)}</ul>
            </div>
          )}
        </div>
      ) : (
        <GoalPicker matchId={matchId} onSet={done} />
      )}
    </Card>
  );
}

/** Tableau de bord : suivi de l'objectif sur les parties jouées depuis son choix. */
export function GoalProgressCard() {
  const goal = useAsync(api.goals.active);
  const p: GoalProgress | null | undefined = goal.data?.active;
  if (goal.loading || p === undefined) return null;
  if (!p) {
    return (
      <Card title={t("Mon objectif")}>
        <p className="text-sm text-slate-400">{t("Aucun objectif en cours. Ouvrez le rapport d'une partie pour choisir un chantier à travailler.")}</p>
      </Card>
    );
  }
  const trend = p.trend && { up: ["text-emerald-300", t("en amélioration")], down: ["text-rose-300", t("en recul")], stable: ["text-slate-300", t("stable")] }[p.trend];
  const stop = async () => { await api.goals.end(); goal.reload(); };
  return (
    <Card title={t("Mon objectif")} className="border-gold-600/40"
      action={<button className="text-xs text-slate-500 hover:text-white" onClick={stop}>{t("Arrêter")}</button>}>
      <p className="text-base text-white">{p.goal.label}</p>
      <p className="text-xs text-gold-300">✦ {p.goal.reminder}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
        <span className="chip">{t("{k} réussie(s) sur {n} partie(s) mesurée(s)", { k: p.successes, n: p.measured })}</span>
        {trend && <span className={`chip ${trend[0]}`}>{t("Tendance : {trend}", { trend: trend[1] })}</span>}
      </div>
      {p.note && <p className="mt-2 text-xs text-slate-500">{p.note}</p>}
      {p.games.length > 0 && (
        <table className="mt-3 w-full text-sm">
          <tbody>
            {p.games.map((g) => (
              <tr key={g.match_id} className="border-t border-void-700">
                <td className="py-1.5"><ResultBadge r={g} /></td>
                <td><Link className="hover:text-white" to={`/matches/${g.match_id}`}>{g.map}</Link></td>
                <td className="text-slate-400">{g.hero}</td>
                <td className="text-right font-mono text-slate-300">{formatValue(g.value, g.unit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}

// ---- marque-pages -------------------------------------------------------------------------------
function BookmarkRow({ bm, onChange }: { bm: Bookmark; onChange: () => void }) {
  const [note, setNote] = useState(bm.note);
  const dirty = note.trim() !== bm.note;
  return (
    <li className="border-t border-void-700 py-2 first:border-t-0">
      <div className="flex items-center gap-3">
        <span className="font-mono text-sm text-white">{bm.clock ?? "?"}</span>
        {bm.clock_estimated && <span className="text-xs text-slate-500">{t("(heure estimée)")}</span>}
        <input className="flex-1 text-sm" maxLength={500} value={note} placeholder={t("Ce que vous pensiez à ce moment…")}
          onChange={(e) => setNote(e.target.value)} />
        {dirty && <button className="btn-ghost py-1 text-xs" onClick={() => api.bookmarks.setNote(bm.id, note).then(onChange)}>{t("Enregistrer")}</button>}
        <button className="text-xs text-slate-500 hover:text-rose-300" title={t("Supprimer")}
          onClick={() => api.bookmarks.remove(bm.id).then(onChange)}>✕</button>
      </div>
      <div className="ml-14 mt-1 text-xs text-slate-400">
        {bm.around.length ? (
          <>{t("Observé dans le replay autour de ce moment :")} {bm.around.map((e) => `${e.clock} ${e.text}`).join(" · ")}</>
        ) : t("Aucun évènement enregistré dans le replay à moins de 30 s.")}
      </div>
    </li>
  );
}

export function BookmarksCard({ matchId }: { matchId: number }) {
  const marks = useAsync(() => api.bookmarks.forMatch(matchId), [matchId]);
  if (!marks.data?.length) return null;
  return (
    <Card title={t("Moments marqués en jeu")}>
      <ul>{marks.data.map((bm) => <BookmarkRow key={bm.id} bm={bm} onChange={marks.reload} />)}</ul>
      <p className="mt-2 text-xs text-slate-500">{t("Recherchez ces heures dans le lecteur de replay du jeu (HOTS REVIVAL ne le pilote pas).")}</p>
    </Card>
  );
}
