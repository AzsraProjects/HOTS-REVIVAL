"""Avantages numériques convertis ou perdus : « où avons-nous laissé filer la partie ? »

Faits déterministes du replay uniquement. Un combat est une suite de morts espacées de moins de
FIGHT_GAP_S ; une équipe a l'avantage quand l'adversaire perd au moins ADVANTAGE_MIN héros de plus.
L'avantage dure jusqu'à ce que l'écart retombe sous ce seuil (réapparitions lues dans le replay).
On relève ensuite ce que l'équipe a obtenu : tour, fort, donjon, cœur, camp ou objectif de carte.

Une absence de conversion n'est pas une erreur certaine : vie, mana, positions et temps de recharge
ne sont pas dans le replay. Chaque moment sépare donc le fait observé, la lecture proposée,
l'alternative à examiner et les limites, avec les données sources (« Sur quoi tu te bases ? »).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from app.i18n import tr

FIGHT_GAP_S = 12  # deux morts plus proches que ça appartiennent au même combat
ADVANTAGE_MIN = 2  # écart de morts qui crée un avantage numérique
WINDOW_MAX_S = 90  # au-delà, ce n'est plus la conséquence du combat
GRACE_S = 10  # un bâtiment qui tombe juste après le retour adverse compte encore
SHORT_WINDOW_S = 10


@dataclass
class Death:
    t_s: float
    team: int
    slot: int | None
    respawn_s: float
    measured: bool  # réapparition lue dans le replay (sinon estimée)
    killers: list[int]


def fmt_clock(seconds: float) -> str:
    seconds = int(seconds)
    return f"{seconds // 60}:{seconds % 60:02d}"


def _gain_label(kind: str, payload: dict) -> str:
    if kind == "structure":
        return {"tower": tr("Tour"), "fort": tr("Fort"), "keep": tr("Donjon"),
                "core": tr("Cœur (fin de partie)")}.get(payload.get("structure"), tr("Bâtiment"))
    if kind == "camp":
        camp = str(payload.get("camp", "")).lower()
        if "siege" in camp:
            return tr("Camp de siège")
        if "bruiser" in camp:
            return tr("Camp de mercenaires")
        if "boss" in camp:
            return tr("Boss")
        if "support" in camp:
            return tr("Camp de soutien")
        return tr("Camp")
    return tr("Objectif de carte")


def _deaths(events: list, duration_s: float) -> list[Death]:
    raw = sorted((e for e in events if e.kind == "death" and e.team in (0, 1)), key=lambda e: e.t_s)
    measured = [(e.t_s, e.payload["respawn_s"] - e.t_s) for e in raw if e.payload.get("respawn_s")]
    out = []
    for e in raw:
        respawn = e.payload.get("respawn_s")
        if respawn:
            out.append(Death(e.t_s, e.team, e.slot, float(respawn), True, e.payload.get("killers") or []))
            continue
        # sans réapparition dans le replay : durée mesurée la plus proche dans le temps, sinon approximation
        if measured:
            wait = min(measured, key=lambda m: abs(m[0] - e.t_s))[1]
        else:
            wait = 15 + e.t_s / 30
        out.append(Death(e.t_s, e.team, e.slot, min(duration_s, e.t_s + wait), False, e.payload.get("killers") or []))
    return out


def _fights(deaths: list[Death]) -> list[list[Death]]:
    fights: list[list[Death]] = []
    for d in deaths:
        if fights and d.t_s - fights[-1][-1].t_s <= FIGHT_GAP_S:
            fights[-1].append(d)
        else:
            fights.append([d])
    return fights


def _dead_at(deaths: list[Death], team: int, t: float) -> int:
    return sum(1 for d in deaths if d.team == team and d.t_s <= t < d.respawn_s)


def _window_end(deaths: list[Death], team: int, start: float, duration_s: float) -> float:
    """Instant où l'écart de héros morts retombe sous ADVANTAGE_MIN (au plus WINDOW_MAX_S après le combat)."""
    limit = min(duration_s, start + WINDOW_MAX_S)
    instants = sorted({start} | {d.respawn_s for d in deaths if start < d.respawn_s <= limit}
                      | {d.t_s for d in deaths if start < d.t_s <= limit})
    for t in instants:
        if _dead_at(deaths, 1 - team, t) - _dead_at(deaths, team, t) < ADVANTAGE_MIN:
            return t
    return limit


def _hero(players: dict[int, Any], slot: int | None) -> str:
    p = players.get(slot) if slot is not None else None
    return p.hero_name if p else "?"


def advantage_timeline(match, me) -> dict:
    """Moments où une équipe a pris l'avantage numérique, et ce qu'elle en a tiré."""
    duration = float(match.duration_s or 0)
    deaths = _deaths(match.events, duration)
    players = {p.slot: p for p in match.players}
    gains_pool = [e for e in match.events if e.kind in ("structure", "camp", "objective") and e.team in (0, 1)]
    rule = tr("Combat : morts espacées de moins de {gap} s. Avantage : l'adversaire perd au moins {n} héros de plus. Durée : jusqu'à ce que l'écart retombe sous {n} (réapparitions lues dans le replay). Conversion : tour, fort, donjon, cœur, camp ou objectif obtenu pendant cette durée (+{grace} s).",
              gap=FIGHT_GAP_S, n=ADVANTAGE_MIN, grace=GRACE_S)

    moments = []
    for fight in _fights(deaths):
        lost = {team: sum(1 for d in fight if d.team == team) for team in (0, 1)}
        for team in (0, 1):
            if lost[1 - team] - lost[team] < ADVANTAGE_MIN:
                continue
            start, end = fight[0].t_s, fight[-1].t_s
            until = _window_end(deaths, team, end, duration)
            window = max(0.0, until - end)
            gains = [e for e in gains_pool if start <= e.t_s <= until + GRACE_S and e.team == team]
            counter = [e for e in gains_pool if start <= e.t_s <= until + GRACE_S and e.team != team]
            moments.append(_moment(team == me.team, fight, lost, team, start, end, until, window, gains, counter,
                                   players, me))
    moments.sort(key=lambda m: m["t_s"])

    allies = [m for m in moments if m["side"] == "allies"]
    enemies = [m for m in moments if m["side"] == "enemies"]
    conv_a = sum(1 for m in allies if m["converted"])
    conv_e = sum(1 for m in enemies if m["converted"])
    if allies:
        headline = tr("Votre équipe a pris l'avantage numérique {n} fois et l'a converti {k} fois.",
                      n=len(allies), k=conv_a)
    else:
        headline = tr("Votre équipe n'a jamais pris l'avantage numérique (au moins {n} adversaires de plus à terre).",
                      n=ADVANTAGE_MIN)
    if enemies:
        headline += " " + tr("L'adversaire : {n} fois, converti {k} fois.", n=len(enemies), k=conv_e)
    return {
        "headline": headline,
        "allies": {"advantages": len(allies), "converted": conv_a},
        "enemies": {"advantages": len(enemies), "converted": conv_e},
        "moments": moments,
        "rule": rule,
        "measured_respawns": all(d.measured for d in deaths) if deaths else False,
    }


def _moment(ours: bool, fight: list[Death], lost: dict[int, int], team: int, start: float, end: float,
            until: float, window: float, gains: list, counter: list, players: dict, me) -> dict:
    kills, losses = lost[1 - team], lost[team]
    gain_labels = [f"{fmt_clock(g.t_s)} {_gain_label(g.kind, g.payload)}" for g in gains]
    counter_labels = [f"{fmt_clock(g.t_s)} {_gain_label(g.kind, g.payload)}" for g in counter]
    converted = bool(gains)
    span = fmt_clock(start) if int(start) == int(end) else f"{fmt_clock(start)}–{fmt_clock(end)}"

    s = round(window)
    if ours:
        if losses:
            fact = tr("Combat gagné ({span}) : {kills} adversaires éliminés, {losses} perte(s) de votre côté.",
                      span=span, kills=kills, losses=losses)
        else:
            fact = tr("Combat gagné ({span}) : {kills} adversaires éliminés sans perte de votre côté.",
                      span=span, kills=kills)
        fact += " " + tr("Avantage numérique pendant environ {s} s.", s=s)
        if converted:
            fact += " " + tr("Obtenu ensuite : {list}.", list=", ".join(gain_labels))
            interpretation = tr("Avantage converti.")
            alternative = None
        else:
            fact += " " + tr("Aucun bâtiment, camp ni objectif obtenu avant le retour des adversaires.")
            interpretation = tr("Avantage non converti : une opportunité à revoir, pas forcément une erreur.")
            alternative = tr("À revoir dans le replay à {clock} : une tour, un camp ou l'objectif étaient-ils accessibles en {s} s, avec la vie et le mana qui restaient ?",
                             clock=fmt_clock(end), s=s)
        if counter_labels:
            fact += " " + tr("Pendant ce temps, l'adversaire obtient : {list}.", list=", ".join(counter_labels))
    else:
        # ici l'équipe en avantage est l'adversaire : ses « kills » sont vos pertes
        if losses:
            fact = tr("Combat perdu ({span}) : {lost} alliés éliminés, {taken} adversaire(s) de leur côté.",
                      span=span, lost=kills, taken=losses)
        else:
            fact = tr("Combat perdu ({span}) : {lost} alliés éliminés sans perte adverse.", span=span, lost=kills)
        fact += " " + tr("Infériorité numérique pendant environ {s} s.", s=s)
        if converted:
            fact += " " + tr("L'adversaire obtient ensuite : {list}.", list=", ".join(gain_labels))
            interpretation = tr("Avantage adverse converti : c'est souvent là qu'une partie bascule.")
            alternative = tr("À revoir dans le replay à {clock} : le combat était-il évitable, ou fallait-il reculer plus tôt pour limiter les pertes ?",
                             clock=fmt_clock(start))
        else:
            interpretation = tr("L'adversaire n'en a rien tiré : défense ou retraite réussie.")
            alternative = None
        if counter_labels:
            fact += " " + tr("Pendant ce temps, votre équipe obtient : {list}.", list=", ".join(counter_labels))

    limits = [tr("Positions des héros vivants, vie, mana et temps de recharge : absents du replay.")]
    if not all(d.measured for d in fight):
        limits.append(tr("Réapparition de certains héros estimée (absente du replay)."))
    if window < SHORT_WINDOW_S:
        limits.append(tr("Fenêtre très courte : peu de temps pour agir."))

    evidence = {
        "deaths": [{"clock": fmt_clock(d.t_s), "hero": _hero(players, d.slot),
                    "side": "allies" if d.team == me.team else "enemies", "me": d.slot == me.slot,
                    "killers": [_hero(players, k) for k in d.killers],
                    "respawn": fmt_clock(d.respawn_s), "respawn_measured": d.measured} for d in fight],
        "window": {"from": fmt_clock(end), "to": fmt_clock(until)},
        "gains": gain_labels,
        "counter_gains": counter_labels,
    }
    return {
        "t_s": round(start, 1), "clock": fmt_clock(start), "side": "allies" if ours else "enemies",
        "kills": kills, "losses": losses, "window_s": round(window), "converted": converted,
        "fact": fact, "interpretation": interpretation, "alternative": alternative, "limits": limits,
        "evidence": evidence,
    }
