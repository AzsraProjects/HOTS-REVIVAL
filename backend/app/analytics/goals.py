"""Objectif personnel : un seul chantier à la fois, mesuré sur chaque partie jouée depuis qu'il a été choisi.

Chaque objectif est une mesure déterministe du replay avec un seuil (« au plus » ou « au moins ») et
renvoie les situations à revoir (heures de jeu). Une partie où la mesure n'a pas de sens (carte sans
cycle d'objectif connu, aucun avantage numérique…) est « non mesurable » plutôt que réussie ou ratée.
Le bilan distingue la tendance observée d'une preuve de progression et signale les échantillons faibles.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.analytics.advantages import advantage_timeline, fmt_clock
from app.analytics.heros_score import CATEGORIES
from app.analytics.profile_stats import build_profile, my_match_lines
from app.analytics.report import CATEGORY_LABELS
from app.i18n import tr
from app.models import Goal, Match, MatchPlayer, Replay, Report
from app.reference import registry

ISOLATED_WINDOW_S = 10  # aucune autre mort (des deux équipes) à moins de 10 s : mort isolée
BEFORE_OBJECTIVE_S = 30
MIN_SAMPLE = 5  # en dessous : pas de conclusion
TREND_MIN = 6
RECENT_GAMES = 10
RECURRING_MIN = 3  # suggestion « récurrente » : présente dans au moins 3 des dernières parties


@dataclass
class Measure:
    value: float | None  # None : non mesurable sur cette partie
    situations: list[str]
    note: str | None = None


@dataclass
class GoalDef:
    key: str
    direction: str  # "max" (au plus) | "min" (au moins)
    unit: str  # "" | "%" | "/10 min"
    measure: Callable[[Match, MatchPlayer, dict | None], Measure]

    def label(self, target: float, hero_id: str | None = None) -> str:
        """hero_id : objectif limité aux parties sur ce héros."""
        n = int(target) if float(target).is_integer() else target
        if self.key == "hero":
            return tr("Sur {hero} : HEROS SCORE d'au moins {n}.", hero=hero_name(hero_id), n=n)
        text = self._label(n)
        return tr("Avec {hero} : {goal}", hero=hero_name(hero_id), goal=text[0].lower() + text[1:]) if hero_id else text

    def _label(self, n: float) -> str:
        if self.key == "isolated_deaths" and n <= 1:
            return tr("Aucune mort isolée dans la partie.") if n == 0 else tr("Une mort isolée au maximum par partie.")
        if self.key == "deaths_before_objective" and n == 0:
            return tr("Ne jamais mourir dans les 30 s qui précèdent un objectif.")
        return {
            "deaths": tr("Mourir {n} fois au maximum.", n=n),
            "isolated_deaths": tr("Pas plus de {n} morts isolées par partie.", n=n),
            "deaths_before_objective": tr("Au plus {n} mort(s) dans les 30 s qui précèdent un objectif.", n=n),
            "kill_participation": tr("Participer à au moins {n} % des éliminations.", n=n),
            "camps": tr("Votre équipe prend au moins {n} camps par tranche de 10 minutes.", n=n),
            "conversions": tr("Convertir au moins {n} % des avantages numériques de votre équipe.", n=n),
        }[self.key]

    def reminder(self, hero_id: str | None = None) -> str:
        if self.key == "hero":
            return tr("Sur {hero}, jouez propre : survie, combats groupés, objectifs.", hero=hero_name(hero_id))
        text = self._reminder()
        return tr("Avec {hero} : {goal}", hero=hero_name(hero_id), goal=text[0].lower() + text[1:]) if hero_id else text

    def _reminder(self) -> str:
        return {
            "deaths": tr("Jouez la survie : reculez dès que vous êtes ciblé."),
            "isolated_deaths": tr("Ne vous éloignez pas seul sans vision."),
            "deaths_before_objective": tr("Avant chaque objectif, restez en vie et groupé."),
            "kill_participation": tr("Restez à portée de votre équipe dans les combats."),
            "camps": tr("Pendant les temps morts, pensez aux camps."),
            "conversions": tr("Combat gagné : prenez une tour, un camp ou l'objectif avant leur retour."),
        }[self.key]

    def success(self, value: float, target: float) -> bool:
        return value <= target if self.direction == "max" else value >= target


def hero_name(hero_id: str | None) -> str:
    hero = registry().heroes.get(hero_id or "")
    return hero.name if hero else (hero_id or "?")


def _my_deaths(match: Match, me: MatchPlayer) -> list:
    return [e for e in match.events if e.kind == "death" and e.slot == me.slot]


def _deaths(match: Match, me: MatchPlayer, _facts: dict | None) -> Measure:
    deaths = _my_deaths(match, me)
    return Measure(float(me.deaths), [tr("Mort à {clock}.", clock=fmt_clock(e.t_s)) for e in deaths])


def _isolated(match: Match, me: MatchPlayer, _facts: dict | None) -> Measure:
    others = [e.t_s for e in match.events if e.kind == "death" and e.slot != me.slot]
    isolated = [e for e in _my_deaths(match, me) if not any(abs(t - e.t_s) <= ISOLATED_WINDOW_S for t in others)]
    return Measure(float(len(isolated)),
                   [tr("Mort isolée à {clock} : aucun autre héros mort à moins de 10 s.", clock=fmt_clock(e.t_s))
                    for e in isolated])


def _before_objective(match: Match, me: MatchPlayer, _facts: dict | None) -> Measure:
    starts = [e.t_s for e in match.events if e.kind == "objective_cycle" and e.payload.get("phase") == "start"]
    if not starts:
        return Measure(None, [], tr("Heures des objectifs inconnues sur cette carte."))
    bad = []
    for e in _my_deaths(match, me):
        start = next((s for s in starts if 0 < s - e.t_s <= BEFORE_OBJECTIVE_S), None)
        if start is not None:
            bad.append(tr("Mort à {clock}, {s} s avant l'objectif de {objective}.",
                          clock=fmt_clock(e.t_s), s=round(start - e.t_s), objective=fmt_clock(start)))
    return Measure(float(len(bad)), bad)


def _kill_participation(match: Match, me: MatchPlayer, _facts: dict | None) -> Measure:
    team_kills = sum(p.kills for p in match.players if p.team == me.team)
    if not team_kills:
        return Measure(None, [], tr("Aucune élimination de votre équipe."))
    missed = [e for e in match.events if e.kind == "death" and e.team != me.team
              and me.slot not in (e.payload.get("killers") or [])]
    return Measure(round(100 * me.takedowns / team_kills),
                   [tr("Élimination sans vous à {clock}.", clock=fmt_clock(e.t_s)) for e in missed[:6]])


def _camps(match: Match, me: MatchPlayer, _facts: dict | None) -> Measure:
    if match.duration_s < 300:
        return Measure(None, [], tr("Partie trop courte."))
    camps = [e for e in match.events if e.kind == "camp" and e.team == me.team]
    return Measure(round(len(camps) / (match.duration_s / 600), 1),
                   [tr("Camp pris à {clock}.", clock=fmt_clock(e.t_s)) for e in camps])


def _conversions(match: Match, me: MatchPlayer, facts: dict | None) -> Measure:
    timeline = (facts or {}).get("advantages") or advantage_timeline(match, me)
    ours = [m for m in timeline["moments"] if m["side"] == "allies"]
    if not ours:
        return Measure(None, [], tr("Aucun avantage numérique dans cette partie."))
    return Measure(round(100 * sum(m["converted"] for m in ours) / len(ours)),
                   [tr("Avantage non converti à {clock}.", clock=m["clock"]) for m in ours if not m["converted"]])


def _hero_score(match: Match, me: MatchPlayer, _facts: dict | None) -> Measure:
    if not me.score:
        return Measure(None, [], tr("HEROS SCORE indisponible pour cette partie."))
    s = me.score
    weakest = min((c for c in CATEGORIES if c != "draft"), key=lambda c: getattr(s, c))
    return Measure(float(s.overall), [tr("Catégorie la plus faible : {cat} ({n}/100).",
                                         cat=tr(CATEGORY_LABELS[weakest]), n=round(getattr(s, weakest)))])


GOALS: dict[str, GoalDef] = {g.key: g for g in (
    GoalDef("deaths", "max", "", _deaths),
    GoalDef("isolated_deaths", "max", "", _isolated),
    GoalDef("deaths_before_objective", "max", "", _before_objective),
    GoalDef("kill_participation", "min", "%", _kill_participation),
    GoalDef("camps", "min", "/10 min", _camps),
    GoalDef("conversions", "min", "%", _conversions),
    GoalDef("hero", "min", "", _hero_score),
)}
DEFAULT_TARGETS = {"deaths": 4, "isolated_deaths": 1, "deaths_before_objective": 0, "kill_participation": 60,
                   "camps": 2, "conversions": 50}


def evaluate(goal: GoalDef, target: float, match: Match, me: MatchPlayer, facts: dict | None,
             hero_id: str | None = None) -> dict:
    if hero_id and me.hero_id != hero_id:
        m = Measure(None, [], tr("Partie jouée avec un autre héros."))
    else:
        m = goal.measure(match, me, facts)
    return {"value": m.value, "target": target, "unit": goal.unit,
            "success": None if m.value is None else goal.success(m.value, target),
            "situations": m.situations[:8], "note": m.note}


def suggestions(match: Match, me: MatchPlayer, facts: dict | None) -> list[dict]:
    """Objectifs proposés après un débrief : les plus pertinents pour cette partie d'abord."""
    score = me.score
    weakest = None
    if score:
        cats = {c: getattr(score, c) for c in ("placement", "macro", "teamfight", "objectives", "survival")}
        weakest = min(cats, key=cats.get)
    out: list[dict] = []

    def suggest(key: str, target: float, reason: str) -> None:
        if all(s["key"] != key for s in out):
            out.append({"key": key, "target": target, "label": GOALS[key].label(target), "reason": reason,
                        "suggested": True})

    isolated = _isolated(match, me, facts).value or 0
    before = _before_objective(match, me, facts).value or 0
    conv = _conversions(match, me, facts)
    if isolated >= 2:
        suggest("isolated_deaths", 1, tr("{n} morts isolées dans cette partie.", n=int(isolated)))
    if before >= 1:
        suggest("deaths_before_objective", 0, tr("{n} mort(s) juste avant un objectif.", n=int(before)))
    if weakest == "survival" or me.deaths >= 5:
        suggest("deaths", max(2, me.deaths - 2), tr("{n} morts dans cette partie.", n=me.deaths))
    if conv.value is not None and conv.value < 50:
        suggest("conversions", 50, tr("{pct} % des avantages numériques convertis.", pct=int(conv.value)))
    if weakest == "teamfight":
        kp = _kill_participation(match, me, facts).value or 0
        suggest("kill_participation", min(70, max(50, kp + 10)), tr("Participation aux éliminations : {pct} %.", pct=int(kp)))
    if weakest == "macro" and me.role != "Healer":
        suggest("camps", 2, tr("Catégorie macro la plus faible du HEROS SCORE."))
    for key, target in DEFAULT_TARGETS.items():
        if all(s["key"] != key for s in out):
            out.append({"key": key, "target": target, "label": GOALS[key].label(target), "reason": None,
                        "suggested": False})
    return out


def recent_suggestions(db: Session) -> list[dict]:
    """Objectifs proposés sans débrief : les erreurs qui reviennent sur les dernières parties, puis le héros
    le plus difficile. Rien n'est « proposé » tant qu'une erreur n'est pas récurrente."""
    lines = my_match_lines(db, limit=RECENT_GAMES)
    seen: dict[str, list[float]] = {}
    for me in lines:
        report = db.scalar(select(Report).where(Report.match_id == me.match_id))
        for s in suggestions(me.match, me, report.facts if report else None):
            if s["suggested"]:
                seen.setdefault(s["key"], []).append(s["target"])
    out = []
    for key, targets in sorted(seen.items(), key=lambda kv: -len(kv[1])):
        if len(targets) < RECURRING_MIN:
            continue
        target = sorted(targets)[len(targets) // 2]
        out.append({"key": key, "target": target, "label": GOALS[key].label(target),
                    "reason": tr("Revient dans {k} de vos {n} dernières parties.", k=len(targets), n=len(lines)),
                    "suggested": True})
    from app.analytics.hero_diagnosis import rework_suggestion  # import local : le diagnostic utilise GOALS

    rework = build_profile(db).heroes_to_rework
    if rework and (option := rework_suggestion(db, rework[0], suggested=True)):
        out.append(option)
    for key, target in DEFAULT_TARGETS.items():
        if all(s["key"] != key for s in out):
            out.append({"key": key, "target": target, "label": GOALS[key].label(target), "reason": None,
                        "suggested": False})
    return out


def active_goal(db: Session) -> Goal | None:
    return db.scalar(select(Goal).where(Goal.ended_at.is_(None)).order_by(Goal.id.desc()))


def goal_out(goal: Goal) -> dict:
    g = GOALS[goal.key]
    return {"id": goal.id, "key": goal.key, "target": goal.target, "hero_id": goal.hero_id,
            "label": g.label(goal.target, goal.hero_id), "reminder": g.reminder(goal.hero_id),
            "direction": g.direction, "unit": g.unit,
            "created_at": goal.created_at, "source_match_id": goal.source_match_id}


def _aware(dt: datetime | None) -> datetime | None:
    if dt is None:
        return None
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def played_after(match: Match, since: datetime) -> bool:
    """Partie jouée après le choix de l'objectif (fin de partie, sinon date d'import du replay)."""
    when = _aware(match.played_at) or _aware(match.replay.imported_at if match.replay else None)
    return bool(when and when >= _aware(since))


def progress(db: Session, goal: Goal) -> dict:
    g = GOALS[goal.key]
    rows = db.scalars(
        select(MatchPlayer).where(MatchPlayer.is_me.is_(True)).join(Match).join(Replay)
        .options(selectinload(MatchPlayer.match).selectinload(Match.events),
                 selectinload(MatchPlayer.match).selectinload(Match.players),
                 selectinload(MatchPlayer.score))
        .order_by(Match.played_at.desc().nullslast(), Match.id.desc()).limit(200)
    )
    games = []
    for me in rows:
        match = me.match
        if not played_after(match, goal.created_at):
            continue
        if goal.hero_id and me.hero_id != goal.hero_id:
            continue  # parties sur d'autres héros : hors du suivi
        report = db.scalar(select(Report).where(Report.match_id == match.id))
        result = evaluate(g, goal.target, match, me, report.facts if report else None, goal.hero_id)
        games.append({"match_id": match.id, "map": match.map_name, "hero": me.hero_name,
                      "played_at": match.played_at, "win": me.is_winner, **result})
        if len(games) >= RECENT_GAMES * 3:
            break
    measured = [x for x in games if x["success"] is not None]
    successes = sum(1 for x in measured if x["success"])
    trend, note = None, None
    if len(measured) < MIN_SAMPLE:
        note = tr("Échantillon trop faible pour conclure : {n} partie(s) mesurée(s), il en faut au moins {min}.",
                  n=len(measured), min=MIN_SAMPLE)
    if len(measured) >= TREND_MIN:
        chrono = [x["value"] for x in reversed(measured)]
        half = len(chrono) // 2
        before, after = sum(chrono[:half]) / half, sum(chrono[half:]) / (len(chrono) - half)
        better = after < before if g.direction == "max" else after > before
        if abs(after - before) < max(0.25, 0.1 * abs(before)):
            trend = "stable"
        else:
            trend = "up" if better else "down"
        note = tr("Tendance observée sur vos parties, pas une preuve de progression : le héros, la carte et les adversaires changent d'une partie à l'autre.")
    return {"goal": goal_out(goal), "games": games[:RECENT_GAMES], "measured": len(measured),
            "successes": successes, "trend": trend, "note": note}
