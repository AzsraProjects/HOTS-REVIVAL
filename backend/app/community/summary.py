"""Résumé d'une partie pour la plateforme communautaire.

Ne contient aucun pseudo, aucun chat, aucun évènement : seulement ce qui sert aux
statistiques. Les toon_handles sont pseudonymisés par le serveur dès réception.
"""
from __future__ import annotations

from datetime import datetime, timezone

from app.models import Match
from app.reference import registry
from app.replay.extractor import TALENT_TIERS

SUMMARY_VERSION = 1
# Doit rester aligné avec server/src/validate.ts (MODES).
SHARED_MODES = ("Quick Match", "Storm League", "Unranked Draft", "ARAM", "Hero League", "Team League")
STAT_COLUMNS = {
    "kills": "kills", "deaths": "deaths", "assists": "assists", "takedowns": "takedowns",
    "hero_damage": "hero_damage", "siege_damage": "siege_damage", "healing": "healing",
    "self_healing": "self_healing", "damage_taken": "damage_taken", "xp": "xp_contribution",
    "mercs": "merc_camp_captures", "time_dead_s": "time_spent_dead_s",
}


def is_shareable(match: Match) -> bool:
    players = match.players
    return (
        match.game_mode in SHARED_MODES
        and match.played_at is not None
        and match.winner_team in (0, 1)
        and len(players) == 10
        and all(p.toon_handle for p in players)
    )


def _talents(talents: list[dict]) -> list[str]:
    by_tier = {t.get("tier"): str(t.get("name") or "")[:80] for t in talents or []}
    return [by_tier.get(tier, "") for tier in range(1, len(TALENT_TIERS) + 1)]


def _unix(dt: datetime) -> int:
    # SQLite rend des dates sans fuseau : elles sont en UTC (heure du replay).
    return int((dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)).timestamp())


def canonical_map_id(match: Match) -> str:
    """Identifiant de carte indépendant de la langue du jeu (« lapassedalterac » -> « alterac_pass »)."""
    info = registry().resolve_map(match.map_id) or registry().resolve_map(match.map_name or "")
    return info.id if info else match.map_id


def build_summary(match: Match) -> dict:
    me = next((p for p in match.players if p.is_me), None)
    levels = match.team_levels or {}
    return {
        "v": SUMMARY_VERSION,
        "me_slot": me.slot if me else None,
        "match": {
            "map_id": canonical_map_id(match),
            "mode": match.game_mode,
            "version": match.game_version,
            "played_at": _unix(match.played_at),
            "duration_s": match.duration_s,
            "winner_team": match.winner_team,
            "levels": [int(levels.get("0", 1)), int(levels.get("1", 1))],
        },
        "players": [
            {
                "slot": p.slot,
                "toon_handle": p.toon_handle,
                "team": p.team,
                "hero_id": p.hero_id,
                "role": p.role,
                "win": p.is_winner,
                "heros_score": p.score.overall if p.score else None,
                "talents": _talents(p.talents),
                **{key: max(0, int(getattr(p, column) or 0)) for key, column in STAT_COLUMNS.items()},
            }
            for p in match.players
        ],
    }
