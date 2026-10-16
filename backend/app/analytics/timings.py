"""« Vrais » timers de carte, mesurés sur les replays importés du joueur.

Chaque replay contient l'horloge exacte des évènements de carte (noms vérifiés sur
replays réels). On en déduit, par carte, l'heure médiane du premier objectif et le
délai médian entre deux objectifs, qui remplacent les valeurs par défaut de maps.json.
"""
from __future__ import annotations

from collections import defaultdict
from statistics import median, quantiles

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.community.timings import community_timings
from app.models import Match, MatchEvent
from app.reference import registry

MIN_SAMPLES = 3
MIN_OWN_SAMPLES = 8  # parties du joueur sur la carte pour préférer ses timers à ceux de la communauté
MIN_COMMUNITY_SAMPLES = 20
MIN_LEVEL_SAMPLES = 5
CLASSIC_MODES = ("Storm League", "Quick Match", "Unranked Draft", "Hero League", "Team League", "Versus AI", "Custom")

# Horloge médiane (s) à laquelle une équipe atteint chaque niveau, mesurée sur des replays
# réels (Storm League / QM / IA). Remplacée par la courbe du joueur dès 5 parties importées.
DEFAULT_LEVEL_CURVE: dict[int, int] = {
    2: 63, 3: 98, 4: 132, 5: 169, 6: 202, 7: 259, 8: 311, 9: 361, 10: 396, 11: 452, 12: 525,
    13: 591, 14: 650, 15: 721, 16: 770, 17: 848, 18: 894, 19: 929, 20: 980, 21: 1051,
    22: 1147, 23: 1250, 24: 1356,
}

# Évènements marquant le DÉBUT d'un objectif (ou, à défaut, sa fin) par carte.
# Les noms en commentaire « vérifié » ont été observés dans des replays réels.
OBJECTIVE_START_EVENTS: dict[str, tuple[str, ...]] = {
    "battlefield_of_eternity": ("Boss Duel Started",),  # vérifié
    "warhead_junction": ("WarheadJunctionNukesSpawned",),  # vérifié
    "sky_temple": ("SkyTempleActivated",),
    "infernal_shrines": ("Infernal Shrine Activated",),
}
OBJECTIVE_END_EVENTS: dict[str, tuple[str, ...]] = {
    "battlefield_of_eternity": ("Immortal Defeated",),  # vérifié
    "dragon_shire": ("DragonKnightActivated",),  # vérifié
    "braxis_holdout": ("BraxisHoldoutMapEventComplete",),  # vérifié
    "volskaya_foundry": ("VolskayaCapturePointComplete",),  # vérifié
    "blackhearts_bay": ("GhostShipCaptured",),  # vérifié
    "towers_of_doom": ("Altar Captured", "AltarCaptured"),
    "infernal_shrines": ("Infernal Shrine Captured", "Punisher Killed"),
    "cursed_hollow": ("TributeCollected", "Tribute Collected", "RavenCurseActivated"),
    "sky_temple": ("SkyTempleCaptured",),
    "garden_of_terror": ("GardenTerrorActivated", "Garden Terror Activated"),
    "tomb_of_the_spider_queen": ("SpiderQueenSpawned", "Webweavers Spawned"),
}


def _events_by_match(db: Session, map_id: str) -> dict[int, list[tuple[float, str]]]:
    rows = db.execute(
        select(MatchEvent.match_id, MatchEvent.t_s, MatchEvent.payload)
        .join(Match)
        .where(Match.map_id == map_id, MatchEvent.kind == "objective")
        .order_by(MatchEvent.match_id, MatchEvent.t_s)
    )
    out: dict[int, list[tuple[float, str]]] = defaultdict(list)
    for match_id, t_s, payload in rows:
        out[match_id].append((t_s, (payload or {}).get("name", "")))
    return out


def _cycles_by_match(db: Session, map_id: str) -> dict[int, list[tuple[float, str]]]:
    rows = db.execute(
        select(MatchEvent.match_id, MatchEvent.t_s, MatchEvent.payload)
        .join(Match)
        .where(Match.map_id == map_id, MatchEvent.kind == "objective_cycle", Match.game_mode.in_(CLASSIC_MODES))
        .order_by(MatchEvent.match_id, MatchEvent.t_s)
    )
    out: dict[int, list[tuple[float, str]]] = defaultdict(list)
    for match_id, t_s, payload in rows:
        out[match_id].append((t_s, (payload or {}).get("phase", "")))
    return out


def _quartiles(values: list[float]) -> tuple[int, int, int]:
    """(bas, médiane, haut) : 1er quartile, médiane, 3e quartile."""
    ordered = sorted(values)
    q = quantiles(ordered, n=4) if len(ordered) >= 4 else [ordered[0], median(ordered), ordered[-1]]
    return round(q[0]), round(median(ordered)), round(q[-1])


def cycle_metrics(phases: list[tuple[float, str]]) -> dict:
    """Mesures d'une partie à partir de ses phases d'objectif [(horloge, phase), …] :
    premier début, durées (début → fin), délais (fin → début suivant) et, pour les cartes
    dont seule la fin est enregistrée, délais de fin à fin."""
    starts = [t for t, p in phases if p == "start"]
    ends = [t for t, p in phases if p == "end"]
    out: dict = {"first_start": round(starts[0]) if starts else None, "durations": [], "respawns": [], "periods": []}
    if starts:
        out["durations"] = [round(e - s) for s in starts if (e := next((e for e in ends if e > s), None)) is not None]
        out["respawns"] = [round(n - e) for e in ends if (n := next((s for s in starts if s > e), None)) is not None]
    else:
        out["periods"] = [round(b - a) for a, b in zip(ends, ends[1:])]
    return out


def calibrate_cycles(db: Session, map_id: str) -> dict | None:
    """Timers mesurés sur les cycles d'objectif des replays (préavis / début / fin).

    - premier objectif : heure fixe (identique d'une partie à l'autre) ;
    - durée : variable, elle dépend des joueurs (médiane + fourchette) ;
    - délai entre la fin d'un objectif et le début du suivant : fixe pour une carte.
    Cartes dont seule la fin est enregistrée : délai de fin à fin.
    """
    matches = _cycles_by_match(db, map_id)
    if len(matches) < MIN_SAMPLES:
        return None
    firsts: list[float] = []
    durations: list[float] = []
    respawns: list[float] = []
    periods: list[float] = []
    for phases in matches.values():
        m = cycle_metrics(phases)
        if m["first_start"] is not None:
            firsts.append(m["first_start"])
        durations += m["durations"]
        respawns += m["respawns"]
        periods += m["periods"]
    return summarize_metrics(len(matches), firsts, durations, respawns, periods)


def summarize_metrics(samples: int, firsts: list[float], durations: list[float], respawns: list[float],
                      periods: list[float]) -> dict | None:
    out: dict = {"samples": samples}
    if len(firsts) >= MIN_SAMPLES:
        out["first_objective_s"] = round(median(firsts))
    if len(durations) >= MIN_SAMPLES:
        low, mid, high = _quartiles(durations)
        out.update(objective_duration_s=mid, duration_low_s=low, duration_high_s=high)
    if len(respawns) >= MIN_SAMPLES:
        out["objective_interval_s"] = round(median(respawns))
    elif len(periods) >= MIN_SAMPLES:
        out["objective_interval_s"] = round(median(periods))
    return out if len(out) > 1 else None


def calibrate_map(db: Session, map_id: str) -> dict | None:
    """Timer calibré d'une carte, ou None si moins de MIN_SAMPLES parties exploitables."""
    cycles = calibrate_cycles(db, map_id)
    if cycles:
        return cycles
    # Replays importés avant les cycles d'objectif : ancienne méthode (évènements nommés).
    matches = _events_by_match(db, map_id)
    starts = OBJECTIVE_START_EVENTS.get(map_id, ())
    ends = OBJECTIVE_END_EVENTS.get(map_id, ())

    firsts: list[float] = []
    intervals: list[float] = []
    for events in matches.values():
        start_times = [t for t, n in events if n in starts]
        end_times = [t for t, n in events if n in ends]
        if start_times:
            firsts.append(start_times[0])
            # délai entre la fin d'un objectif et le début du suivant
            for end in end_times:
                nxt = next((s for s in start_times if s > end), None)
                if nxt is not None:
                    intervals.append(nxt - end)
            if not end_times:
                intervals += [b - a for a, b in zip(start_times, start_times[1:])]
        elif end_times:
            intervals += [b - a for a, b in zip(end_times, end_times[1:])]
    if len(matches) < MIN_SAMPLES or not (firsts or intervals):
        return None
    return {
        "first_objective_s": round(median(firsts)) if len(firsts) >= MIN_SAMPLES else None,
        "objective_interval_s": round(median(intervals)) if len(intervals) >= MIN_SAMPLES else None,
        "samples": len(matches),
    }


def level_curve(db: Session | None) -> dict[int, int]:
    """Courbe d'XP du joueur : horloge médiane d'arrivée à chaque niveau (parties classiques)."""
    if db is None:
        return dict(DEFAULT_LEVEL_CURVE)
    rows = db.execute(
        select(MatchEvent.match_id, MatchEvent.team, MatchEvent.t_s, MatchEvent.payload)
        .join(Match)
        .where(MatchEvent.kind == "level", Match.game_mode.in_(CLASSIC_MODES))
    )
    by_level: dict[int, list[float]] = defaultdict(list)
    matches: set[int] = set()
    for match_id, _team, t_s, payload in rows:
        level = int((payload or {}).get("level", 0))
        if 2 <= level <= 30:
            by_level[level].append(t_s)
            matches.add(match_id)
    if len(matches) < MIN_LEVEL_SAMPLES:
        return dict(DEFAULT_LEVEL_CURVE)
    curve: dict[int, int] = {}
    last = 0
    for level in sorted(by_level):
        if len(by_level[level]) < MIN_LEVEL_SAMPLES:
            break
        t = max(last + 1, round(median(by_level[level])))  # courbe toujours croissante
        curve[level] = last = t
    return curve or dict(DEFAULT_LEVEL_CURVE)


def map_timings(db: Session | None, map_id: str) -> dict:
    """Timers à utiliser pour l'overlay : calibrés si possible, sinon valeurs de référence.

    objective_interval_s : délai entre la FIN d'un objectif et le début du suivant.
    objective_duration_s : durée habituelle d'un objectif (fourchette duration_low_s / duration_high_s).
    """
    info = registry().maps.get(map_id)
    duration = info.objective_duration_s if info else None
    base = {
        "first_objective_s": info.first_objective_s if info else None,
        "objective_interval_s": info.objective_interval_s if info else None,
        "objective_duration_s": duration,
        "duration_low_s": round(duration * 0.75) if duration else None,
        "duration_high_s": round(duration * 1.4) if duration else None,
        "source": "mesuré" if info and info.verified else "estimation",
        "samples": 0,
        "level_curve": level_curve(db),
    }
    if db is None or info is None:
        return base
    calibrated = calibrate_map(db, map_id)
    community = community_timings(map_id)
    # Vos replays priment dès qu'ils sont assez nombreux ; sinon les timers de la communauté
    # (beaucoup plus de parties) ; à défaut vos quelques replays, puis les valeurs de référence.
    if calibrated and calibrated["samples"] >= MIN_OWN_SAMPLES:
        chosen, source = calibrated, "vos replays"
    elif community and community.get("samples", 0) >= MIN_COMMUNITY_SAMPLES:
        chosen, source = community, "communauté"
    elif calibrated:
        chosen, source = calibrated, "vos replays"
    else:
        return base
    for key in ("first_objective_s", "objective_interval_s", "objective_duration_s", "duration_low_s", "duration_high_s"):
        if chosen.get(key):
            base[key] = chosen[key]
    base["source"] = source
    base["samples"] = chosen["samples"]
    return base
