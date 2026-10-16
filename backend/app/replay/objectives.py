"""Cycles d'objectifs de carte (préavis → début → fin) extraits des évènements du replay.

Le jeu n'enregistre pas toujours un évènement nommé pour le début et la fin d'un objectif,
mais il enregistre l'apparition, la mort et le changement de propriétaire de chaque unité.
Les règles ci-dessous (noms vérifiés sur replays réels) en déduisent, par carte :
  - warning : le jeu affiche le préavis du prochain objectif (souvent dès la fin du précédent) ;
  - start   : l'objectif est disponible ;
  - end     : l'objectif est terminé (durée variable, elle dépend des joueurs).
Le délai entre une fin et le début suivant est fixe pour une carte : c'est lui qui permet de
prévoir le prochain objectif une fois le précédent terminé.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any

# Deux marqueurs d'une même phase espacés de moins de BURST_S secondes = un seul évènement
# (ex. 7 convois « Payload » ou plusieurs ogives apparaissent au même moment).
BURST_S = 20.0


@dataclass(frozen=True)
class Marker:
    kind: str  # "born" (apparition d'unité) | "died" (mort d'unité) | "stat" (évènement nommé)
    names: tuple[str, ...]
    prefix: bool = False  # noms comparés par préfixe

    def matches(self, kind: str, name: str) -> bool:
        if kind != self.kind:
            return False
        return name.startswith(self.names) if self.prefix else name in self.names


@dataclass(frozen=True)
class MapRule:
    start: tuple[Marker, ...] = ()
    end: tuple[Marker, ...] = ()
    warning: tuple[Marker, ...] = ()
    last_of_burst_end: bool = False  # fin = dernier marqueur d'une rafale (ex. tirs du temple)


RULES: dict[str, MapRule] = {
    "alterac_pass": MapRule(
        start=(Marker("born", ("CapturedSoldier",)),),
        end=(Marker("born", ("HordeCavalry", "AllianceCavalry")),),
    ),
    "battlefield_of_eternity": MapRule(
        warning=(Marker("born", ("BossDuelBossPreviewUnitHeaven", "BossDuelBossPreviewUnitHell")),),
        start=(Marker("born", ("BossDuelBossHeaven", "BossDuelBossHell")), Marker("stat", ("Boss Duel Started",))),
        end=(Marker("stat", ("Immortal Defeated",)),),
    ),
    "cursed_hollow": MapRule(
        warning=(Marker("born", ("RavenLordTributeWarning",)),),
        start=(Marker("born", ("RavenLordTribute",)),),
        end=(Marker("stat", ("TributeCollected", "Tribute Collected")),),
    ),
    "garden_of_terror": MapRule(
        warning=(Marker("born", ("SeedSpawnPreview",)),),
        start=(Marker("born", ("Seed",)),),
        end=(Marker("died", ("Seed",)),),
    ),
    "hanamura_temple": MapRule(
        warning=(Marker("born", ("Payload_Neutral_Warning",)),),
        start=(Marker("born", ("Payload_Neutral",)),),
        end=(Marker("died", ("Payload_",), prefix=True),),
    ),
    "haunted_mines": MapRule(
        start=(Marker("born", ("UnderworldMineEntranceMinimapIcon",)),),
        end=(Marker("stat", ("HauntedMinesGolemsSpawned",)),),
    ),
    "infernal_shrines": MapRule(
        start=(Marker("born", ("CursedShrineMinion",)), Marker("stat", ("Infernal Shrine Activated",))),
        end=(Marker("stat", ("Punisher Killed",)),),
    ),
    "sky_temple": MapRule(
        start=(Marker("stat", ("SkyTempleActivated",)),),
        end=(Marker("stat", ("SkyTempleShotsFired",)),),
        last_of_burst_end=True,
    ),
    "volskaya_foundry": MapRule(
        warning=(Marker("born", ("ControlPointMinimapPreviewIcon",), prefix=True),),
        start=(Marker("born", ("ControlPointMinimapIcon",), prefix=True),),
        end=(Marker("stat", ("VolskayaCapturePointComplete",)),),
    ),
    "warhead_junction": MapRule(
        warning=(Marker("born", ("NukeTargetMinimapPreviewIconUnit",)),),
        start=(Marker("born", ("WarheadSingle",)), Marker("stat", ("WarheadJunctionNukesSpawned",))),
        # le préavis du lot suivant apparaît dès que le lot en cours est épuisé
        end=(Marker("born", ("NukeTargetMinimapPreviewIconUnit",)),),
    ),
    # Cartes dont seule la fin est enregistrée : le délai se mesure de fin à fin.
    "braxis_holdout": MapRule(end=(Marker("stat", ("BraxisHoldoutMapEventComplete",)),)),
    "dragon_shire": MapRule(end=(Marker("stat", ("DragonKnightActivated",)),)),
    "tomb_of_the_spider_queen": MapRule(end=(Marker("stat", ("SoulEatersSpawned",)),)),
    "towers_of_doom": MapRule(end=(Marker("stat", ("Altar Captured", "AltarCaptured")),)),
    "blackhearts_bay": MapRule(end=(Marker("stat", ("GhostShipCaptured",)),)),
}


def _s(value: Any) -> str:
    return value.decode("utf-8", errors="replace") if isinstance(value, bytes) else str(value or "")


def _raw_markers(tracker_events: list[dict[str, Any]], to_seconds) -> list[tuple[float, str, str]]:
    """(horloge, kind, nom) pour chaque apparition / mort d'unité et évènement nommé."""
    tags: dict[tuple[int, int], str] = {}
    out: list[tuple[float, str, str]] = []
    for ev in tracker_events:
        name = ev.get("_event", "")
        t = to_seconds(int(ev.get("_gameloop", 0)))
        if name.endswith("SUnitBornEvent"):
            unit = _s(ev.get("m_unitTypeName"))
            tags[(ev.get("m_unitTagIndex"), ev.get("m_unitTagRecycle"))] = unit
            out.append((t, "born", unit))
        elif name.endswith("SUnitTypeChangeEvent"):
            tags[(ev.get("m_unitTagIndex"), ev.get("m_unitTagRecycle"))] = _s(ev.get("m_unitTypeName"))
        elif name.endswith("SUnitDiedEvent"):
            unit = tags.get((ev.get("m_unitTagIndex"), ev.get("m_unitTagRecycle")))
            if unit:
                out.append((t, "died", unit))
        elif name.endswith("SStatGameEvent"):
            out.append((t, "stat", _s(ev.get("m_eventName"))))
    return out


def _bursts(times: list[float], last: bool = False) -> list[float]:
    """Regroupe les marqueurs rapprochés : premier (ou dernier) instant de chaque rafale."""
    groups: list[list[float]] = []
    for t in sorted(times):
        if groups and t - groups[-1][-1] < BURST_S:
            groups[-1].append(t)
        else:
            groups.append([t])
    return [g[-1] if last else g[0] for g in groups]


def extract_cycles(map_id: str, tracker_events: list[dict[str, Any]], to_seconds) -> list[dict[str, Any]]:
    """Phases d'objectif triées : [{"t_s": 180.0, "phase": "start"}, …]."""
    rule = RULES.get(map_id)
    if not rule:
        return []
    markers = _raw_markers(tracker_events, to_seconds)

    def times(ms: tuple[Marker, ...]) -> list[float]:
        return [t for t, kind, name in markers if any(m.matches(kind, name) for m in ms)]

    phases: list[dict[str, Any]] = []
    for phase, ms, last in (("warning", rule.warning, False), ("start", rule.start, False),
                            ("end", rule.end, rule.last_of_burst_end)):
        phases += [{"t_s": round(t, 1), "phase": phase} for t in _bursts(times(ms), last)]
    order = {"end": 0, "warning": 1, "start": 2}  # même seconde : la fin précède le préavis suivant
    return sorted(phases, key=lambda p: (p["t_s"], order[p["phase"]]))
