"""Post Game Report – faits déterministes extraits du replay.

Ces faits servent (1) à afficher le rapport même sans IA et (2) de contexte
factuel à Claude, qui ne doit rien inventer au-delà.
"""
from __future__ import annotations

from app.i18n import language, tr
from app.coach.roles import role_context
from app.models import Match, MatchPlayer

CATEGORY_LABELS = {
    "placement": "placement", "macro": "macro", "teamfight": "teamfight",
    "objectives": "objectifs", "survival": "survie", "draft": "draft",
}


def fmt_clock(seconds: float) -> str:
    seconds = int(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"


def _team_wipes(match: Match) -> list[dict]:
    """≥3 morts d'une même équipe en moins de 15 s."""
    wipes, deaths = [], [e for e in match.events if e.kind == "death"]
    for team in (0, 1):
        ts = [e.t_s for e in deaths if e.team == team]
        i = 0
        while i < len(ts):
            j = i
            while j + 1 < len(ts) and ts[j + 1] - ts[i] <= 15:
                j += 1
            if j - i + 1 >= 3:
                wipes.append({"t_s": ts[i], "team": team, "deaths": j - i + 1})
                i = j + 1
            else:
                i += 1
    return sorted(wipes, key=lambda w: w["t_s"])


def build_facts(match: Match, me: MatchPlayer) -> dict:
    allies = [p for p in match.players if p.team == me.team]
    team_kills = sum(p.kills for p in allies)
    kp = me.takedowns / team_kills if team_kills else 0.0

    def share(attr: str) -> float:
        total = sum(getattr(p, attr) for p in allies)
        return round(getattr(me, attr) / total, 3) if total else 0.0

    level_timings: dict[str, dict[str, str]] = {"allies": {}, "enemies": {}}
    for e in match.events:
        if e.kind == "level" and e.payload.get("level") in (10, 16, 20):
            side = "allies" if e.team == me.team else "enemies"
            level_timings[side][str(e.payload["level"])] = fmt_clock(e.t_s)

    my_deaths = [fmt_clock(e.t_s) for e in match.events if e.kind == "death" and e.slot == me.slot]
    key_moments = []
    for w in _team_wipes(match):
        if w["team"] == me.team:
            text = tr("Votre équipe perd {n} héros en un combat.", n=w["deaths"])
        else:
            text = tr("L'équipe adverse perd {n} héros en un combat.", n=w["deaths"])
        key_moments.append(f"{fmt_clock(w['t_s'])} – {text}")
    for side in ("allies", "enemies"):
        for lvl, clock in level_timings[side].items():
            if side == "allies":
                text = tr("Votre équipe atteint le niveau {lvl}.", lvl=lvl)
            else:
                text = tr("L'équipe adverse atteint le niveau {lvl}.", lvl=lvl)
            key_moments.append(f"{clock} – {text}")
    def _clock_key(text: str) -> int:
        minutes, seconds = text.split(" ", 1)[0].split(":")
        return int(minutes) * 60 + int(seconds)

    key_moments.sort(key=_clock_key)

    score = me.score
    categories = {c: getattr(score, c) for c in CATEGORY_LABELS} if score else {}
    strengths, weaknesses = [], []
    if kp >= 0.7:
        strengths.append(tr("Participation élevée aux éliminations."))
    if share("hero_damage") >= 0.28 and me.role in ("Ranged Assassin", "Melee Assassin"):
        strengths.append(tr("Bons dégâts sur les héros adverses."))
    if me.role == "Healer" and share("healing") >= 0.6:
        strengths.append(tr("Vous assurez {pct} % des soins de l'équipe.", pct=round(share("healing") * 100)))
    if me.role in ("Tank", "Bruiser") and share("damage_taken") >= 0.3:
        strengths.append(tr("Vous encaissez {pct} % des dégâts de l'équipe : bon rôle de ligne de front.",
                            pct=round(share("damage_taken") * 100)))
    if me.deaths <= 2:
        strengths.append(tr("Excellente survie."))
    if share("xp_contribution") >= 0.25:
        strengths.append(tr("Très bonne contribution à l'expérience de l'équipe."))
    if me.deaths >= 5:
        weaknesses.append(tr("{n} morts.", n=me.deaths))
    if me.time_spent_dead_s >= 90:
        weaknesses.append(tr("Temps passé mort : {s} secondes.", s=me.time_spent_dead_s))
    if me.role == "Healer" and share("healing") < 0.4:
        weaknesses.append(tr("Seulement {pct} % des soins de l'équipe : restez à portée de vos alliés.",
                              pct=round(share("healing") * 100)))
    if categories.get("macro", 100) < 45 and me.role != "Healer":
        weaknesses.append(tr("Faible contribution macro (XP, siège, camps)."))
    if categories:
        for c, v in sorted(categories.items(), key=lambda kv: -kv[1])[:2]:
            if v >= 75 and c != "draft":
                strengths.append(tr("Catégorie {cat} solide ({v}/100).", cat=tr(CATEGORY_LABELS[c]), v=v))

    weakest = min((c for c in categories if c != "draft"), key=categories.get, default=None)
    plan = []
    if weakest == "survival" or me.deaths >= 4:
        plan.append(tr("Réduire vos morts à {n} maximum.", n=max(2, me.deaths - 2)))
    if weakest == "macro":
        plan.append(tr("Prendre au moins 2 camps par tranche de 10 minutes et soaker les vagues inactives."))
    if weakest == "teamfight":
        plan.append(tr("Rester à portée de votre équipe avant chaque objectif pour viser 70 % de participation."))
    if weakest == "placement":
        plan.append(tr("Éviter les morts en infériorité numérique : ne pas avancer sans vision ni alliés."))
    if weakest == "objectives":
        plan.append(tr("Être présent 20 s avant chaque objectif plutôt que d'arriver pendant le combat."))

    if me.is_winner:
        headline = tr("Partie gagnée à {clock} sur {map}.", clock=fmt_clock(match.duration_s), map=match.map_name)
    else:
        headline = tr("Partie perdue à {clock} sur {map}.", clock=fmt_clock(match.duration_s), map=match.map_name)
    headline += " " + tr("Vous avez participé à {pct} % des éliminations.", pct=round(kp * 100))
    if weakest:
        headline += " " + tr("Votre principal axe de progression : {cat}.", cat=tr(CATEGORY_LABELS[weakest]))

    role = role_context(me.role)
    return {
        "lang": language(),  # rapport recalculé si la langue de l'interface change (api/matches.py)
        "headline": headline,
        "role_context": {"role": me.role, "label": role["label"], "focus": role["focus"], "normal": role["normal"]},
        "result": "win" if me.is_winner else "loss",
        "map": match.map_name,
        "duration": fmt_clock(match.duration_s),
        "hero": me.hero_name,
        "role": me.role,
        "kda": {"kills": me.kills, "deaths": me.deaths, "assists": me.assists},
        "kill_participation": round(kp, 3),
        "time_spent_dead_s": me.time_spent_dead_s,
        "shares": {
            "hero_damage": share("hero_damage"), "siege_damage": share("siege_damage"),
            "healing": share("healing"), "xp_contribution": share("xp_contribution"),
            "damage_taken": share("damage_taken"),
        },
        "merc_camp_captures": me.merc_camp_captures,
        "my_death_times": my_deaths,
        "level_timings": level_timings,
        "key_moments": key_moments,
        "heros_score": {**categories, "overall": score.overall} if score else None,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "improvement_plan": plan,
        "talents": me.talents,
    }
