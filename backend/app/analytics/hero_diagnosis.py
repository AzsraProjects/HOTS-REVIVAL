"""Diagnostic d'un héros : pourquoi tant de défaites alors que le HEROS SCORE est correct ?

On compare vos défaites sur ce héros à vos victoires, tous héros confondus : ce qui manque dans ces défaites
par rapport à une partie que vous gagnez d'habitude. Les écarts sont exprimés en écarts types de vos propres
parties, pour comparer des morts, des pourcentages et des notes. Ce sont des pistes à vérifier dans les
replays, pas des preuves : alliés, adversaires et cartes changent d'une partie à l'autre.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from statistics import fmean, pstdev
from typing import Callable

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.goals import GOALS, hero_name
from app.analytics.profile_stats import hero_goal_target, my_match_lines, smoothed_winrate
from app.i18n import tr
from app.models import Match, MatchPlayer, Report
from app.reference import registry

MAX_GAMES = 200
MIN_LOSSES = 3  # en dessous : pas de diagnostic
FEW_LOSSES = 6  # en dessous : pistes à confirmer
MIN_EFFECT = 0.4  # écart minimal (en écarts types) pour retenir une piste
MAX_FINDINGS = 4
DURATION_GAP_S = 180
MAP_MIN_GAMES = 3  # parties avec le héros sur une carte pour la juger
MAP_GAP = 0.25  # winrate avec le héros sous celui de vos autres héros sur la carte
SITUATION_MIN = 2  # défaites concernées
SITUATION_GAP = 0.25  # part dans vos défaites avec le héros, au-dessus de la part dans vos victoires


@dataclass
class Metric:
    key: str
    label: str
    unit: str
    higher_is_better: bool
    team: bool  # dépend surtout de l'équipe (et pas seulement de vous)
    value: Callable[[Match, MatchPlayer, dict | None], float | None]
    goal: str | None = None  # objectif personnel correspondant (app/analytics/goals.py)


def _category(name: str) -> Callable[[Match, MatchPlayer, dict | None], float | None]:
    return lambda _m, me, _f: float(getattr(me.score, name)) if me.score else None


def _goal_measure(key: str) -> Callable[[Match, MatchPlayer, dict | None], float | None]:
    return lambda m, me, f: GOALS[key].measure(m, me, f).value


METRICS = (
    Metric("survival", "HEROS SCORE survie", "/100", True, False, _category("survival")),
    Metric("teamfight", "HEROS SCORE combats d'équipe", "/100", True, False, _category("teamfight")),
    Metric("placement", "HEROS SCORE placement", "/100", True, False, _category("placement")),
    Metric("macro", "HEROS SCORE macro", "/100", True, False, _category("macro")),
    Metric("objectives", "HEROS SCORE objectifs", "/100", True, False, _category("objectives")),
    Metric("deaths", "Morts par partie", "", False, False, _goal_measure("deaths"), "deaths"),
    Metric("isolated_deaths", "Morts isolées par partie", "", False, False, _goal_measure("isolated_deaths"),
           "isolated_deaths"),
    Metric("deaths_before_objective", "Morts juste avant un objectif", "", False, False,
           _goal_measure("deaths_before_objective"), "deaths_before_objective"),
    Metric("kill_participation", "Participation aux éliminations", "%", True, False,
           _goal_measure("kill_participation"), "kill_participation"),
    Metric("conversions", "Avantages numériques convertis", "%", True, True, _goal_measure("conversions"),
           "conversions"),
    Metric("camps", "Camps de l'équipe par 10 min", "", True, True, _goal_measure("camps"), "camps"),
    Metric("draft", "HEROS SCORE draft", "/100", True, True, _category("draft")),
)


def _tags(p: MatchPlayer) -> tuple[str, frozenset[str]]:
    hero = registry().heroes.get(p.hero_id)
    return (hero.role, hero.tags) if hero else (p.role or "", frozenset())


# Compositions : situations de draft lues dans le replay (les 10 héros), indépendantes de votre jeu.
def _situations(match: Match, me: MatchPlayer) -> set[str]:
    allies = [_tags(p) for p in match.players if p.team == me.team]
    enemies = [_tags(p) for p in match.players if p.team != me.team]
    frontline = lambda team: sum(role == "Tank" or "frontline" in tags for role, tags in team)  # noqa: E731
    out = set()
    if not any(role == "Healer" for role, _ in allies):
        out.add("no_healer")
    if not any(role == "Tank" for role, _ in allies):
        out.add("no_tank")
    if sum("dive" in tags for _, tags in enemies) >= 2:
        out.add("enemy_dive")
    if frontline(enemies) > frontline(allies):
        out.add("enemy_frontline")
    return out


SITUATIONS = {
    "no_healer": "Votre équipe sans soigneur",
    "no_tank": "Votre équipe sans tank",
    "enemy_dive": "Au moins 2 héros de plongée en face",
    "enemy_frontline": "Plus de frontline en face que dans votre équipe",
}


def _maps(values: list, hero_id: str, hero: str) -> list[str]:
    """Cartes où vous gagnez nettement moins avec ce héros qu'avec vos autres héros."""
    by_map: dict[str, dict] = {}
    for me, _ in values:
        m = by_map.setdefault(me.match.map_id, {"name": me.match.map_name, "g": 0, "w": 0, "og": 0, "ow": 0})
        if me.hero_id == hero_id:
            m["g"] += 1
            m["w"] += int(me.is_winner)
        else:
            m["og"] += 1
            m["ow"] += int(me.is_winner)
    out = []
    for m in sorted(by_map.values(), key=lambda m: m["w"] / max(1, m["g"])):
        if m["g"] < MAP_MIN_GAMES or m["og"] < MAP_MIN_GAMES:
            continue
        others = smoothed_winrate(m["ow"], m["og"])
        if smoothed_winrate(m["w"], m["g"]) <= others - MAP_GAP:
            out.append(tr("{map} : {w} V / {g} avec {hero}, contre {pct} % de victoires avec vos autres héros sur cette carte.", map=m["name"], w=m["w"], g=m["g"], hero=hero, pct=round(100 * m["ow"] / m["og"])))
    return out[:2]


def _compositions(losses: list, wins: list, hero: str) -> list[str]:
    """Situations de draft nettement plus fréquentes dans vos défaites avec ce héros que dans vos victoires."""
    lost = [_situations(me.match, me) for me, _ in losses]
    won = [_situations(me.match, me) for me, _ in wins]
    out = []
    for key, label in SITUATIONS.items():
        k = sum(key in s for s in lost)
        share_lost, share_won = k / len(lost), sum(key in s for s in won) / len(won)
        if k >= SITUATION_MIN and share_lost - share_won >= SITUATION_GAP:
            out.append((share_lost - share_won, tr("{label} : {k} de vos {n} défaites avec {hero}, contre {pct} % de vos victoires.", label=tr(label), k=k, n=len(lost), hero=hero, pct=round(100 * share_won))))
    return [text for _, text in sorted(out, key=lambda x: -x[0])]


def _fmt(value: float, unit: str) -> str:
    text = str(round(value)) if unit in ("%", "/100") else f"{value:.1f}".removesuffix(".0")
    return {"%": f"{text} %", "/100": f"{text}/100"}.get(unit, text)


def _goal_target(metric: Metric, wins_mean: float) -> float:
    """Seuil d'objectif : le niveau de vos victoires habituelles."""
    if metric.key == "camps":
        return max(0.5, math.floor(wins_mean * 2) / 2)
    if GOALS[metric.goal].direction == "max":
        return float(max(0, math.ceil(wins_mean - 0.25)))
    return float(min(100, round(wins_mean)))


def hero_diagnosis(db: Session, hero_id: str) -> dict:
    lines = my_match_lines(db, limit=MAX_GAMES)
    values: list[tuple[MatchPlayer, dict[str, float | None]]] = []
    for me in lines:
        report = db.scalar(select(Report).where(Report.match_id == me.match_id))
        facts = report.facts if report else None
        values.append((me, {m.key: m.value(me.match, me, facts) for m in METRICS}))
    hero = hero_name(hero_id)
    losses = [(me, v) for me, v in values if me.hero_id == hero_id and not me.is_winner]
    wins = [(me, v) for me, v in values if me.is_winner]
    base = {"hero_id": hero_id, "hero": hero, "losses": len(losses), "wins_compared": len(wins),
            "findings": [], "solid": [], "verdict": None, "context": [], "maps": [], "compositions": [], "note": None}
    if len(losses) < MIN_LOSSES or len(wins) < MIN_LOSSES:
        base["note"] = tr("Pas assez de parties pour comparer : {l} défaite(s) avec {hero}, {w} victoire(s) au total, il en faut au moins {min} de chaque.", l=len(losses), hero=hero, w=len(wins), min=MIN_LOSSES)
        return base

    findings, solid = [], []
    for metric in METRICS:
        everyone = [v[metric.key] for _, v in values if v[metric.key] is not None]
        lost = [v[metric.key] for _, v in losses if v[metric.key] is not None]
        won = [v[metric.key] for _, v in wins if v[metric.key] is not None]
        spread = pstdev(everyone) if len(everyone) > 1 else 0
        if len(lost) < 2 or len(won) < 2 or not spread:
            continue
        lost_mean, won_mean = fmean(lost), fmean(won)
        effect = (won_mean - lost_mean) / spread * (1 if metric.higher_is_better else -1)  # > 0 : défaites en retrait
        entry = {"key": metric.key, "label": tr(metric.label), "unit": metric.unit, "team": metric.team,
                 "hero_losses": round(lost_mean, 1), "wins": round(won_mean, 1), "effect": round(effect, 2),
                 "text": tr("{label} : {lost} dans vos défaites avec {hero}, {won} dans vos victoires.",
                            label=tr(metric.label), lost=_fmt(lost_mean, metric.unit), hero=hero,
                            won=_fmt(won_mean, metric.unit)),
                 "goal": None}
        if metric.goal:
            target = _goal_target(metric, won_mean)
            entry["goal"] = {"key": metric.goal, "target": target, "label": GOALS[metric.goal].label(target, hero_id)}
        if effect >= MIN_EFFECT:
            findings.append(entry)
        elif effect <= 0 and not metric.team and metric.unit == "/100":
            solid.append(tr(metric.label))
    findings.sort(key=lambda f: -f["effect"])
    base["findings"] = findings[:MAX_FINDINGS]
    base["solid"] = solid

    personal = [f for f in base["findings"] if not f["team"]]
    if not base["findings"]:
        base["verdict"] = tr("Aucun écart net entre vos défaites avec {hero} et vos victoires : ces défaites tiennent peut-être davantage aux compositions d'équipe qu'à votre jeu.", hero=hero)
    elif not personal:
        base["verdict"] = tr("Individuellement, vos défaites avec {hero} ressemblent à vos victoires : l'écart se joue surtout sur le jeu d'équipe autour de vous.", hero=hero)
    else:
        base["verdict"] = tr("Ces points décrochent dans vos défaites avec {hero} par rapport à vos victoires habituelles : c'est là que se joue la différence.", hero=hero)

    lost_s = fmean(me.match.duration_s for me, _ in losses)
    won_s = fmean(me.match.duration_s for me, _ in wins)
    if lost_s <= won_s - DURATION_GAP_S:
        base["context"].append(tr("Vos défaites avec {hero} sont courtes ({lost} min contre {won} min pour vos victoires) : elles se décident tôt, souvent dès les premiers niveaux.",
                                  hero=hero, lost=round(lost_s / 60), won=round(won_s / 60)))
    elif lost_s >= won_s + DURATION_GAP_S:
        base["context"].append(tr("Vos défaites avec {hero} sont longues ({lost} min contre {won} min pour vos victoires) : elles se perdent en fin de partie, sur un combat ou un objectif décisif.", hero=hero, lost=round(lost_s / 60), won=round(won_s / 60)))
    base["maps"] = _maps(values, hero_id, hero)
    base["compositions"] = _compositions(losses, wins, hero)
    if not base["findings"] and base["compositions"]:
        base["verdict"] = tr("Aucun écart net dans votre jeu entre vos défaites avec {hero} et vos victoires : regardez plutôt les compositions ci-dessous.", hero=hero)
    note = tr("Comparaison de {l} défaites avec {hero} et de vos {w} victoires (tous héros). Tendance observée, pas une preuve : alliés, adversaires et cartes changent d'une partie à l'autre.",
              l=len(losses), hero=hero, w=len(wins))
    if len(losses) < FEW_LOSSES:
        note += " " + tr("Peu de défaites : pistes à confirmer sur les prochaines parties.")
    base["note"] = note
    return base


def rework_suggestion(db: Session, entry: dict, suggested: bool) -> dict | None:
    """Objectif proposé pour un héros à retravailler : HEROS SCORE si le niveau est en dessous de votre moyenne,
    sinon la principale piste du diagnostic (objectif limité à ce héros)."""
    if entry.get("kind") != "results":
        target = entry.get("goal_target", hero_goal_target(entry.get("avg_heros_score")))
        return {"key": "hero", "hero_id": entry["hero_id"], "target": target,
                "label": GOALS["hero"].label(target, entry["hero_id"]),
                "reason": tr("{w} victoire(s) sur {n} parties avec {hero}.", w=entry["wins"], n=entry["games"],
                             hero=entry["hero"]),
                "suggested": suggested}
    diag = hero_diagnosis(db, entry["hero_id"])
    top = next((f for f in diag["findings"] if f["goal"]), None)
    if not top:
        return None
    return {**top["goal"], "hero_id": entry["hero_id"], "reason": top["text"], "suggested": suggested}

