"""Marque-pages de replay : un raccourci propre à l'application (aucune touche envoyée au jeu) note l'instant,
rattaché au replay de la partie dès son import, puis confronté aux évènements observés autour.

Le lecteur de replay du jeu n'est jamais piloté : on affiche l'heure de jeu à rechercher.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.analytics.advantages import fmt_clock
from app.i18n import tr
from app.models import Bookmark, Match

AROUND_S = 30  # évènements affichés autour du moment marqué
LOADING_MARGIN = timedelta(minutes=5)  # écran de chargement et sélection : la partie commence avant 0:00


def _aware(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def add_bookmark(db: Session, clock_s: float | None, map_id: str | None) -> Bookmark:
    bm = Bookmark(clock_s=round(clock_s, 1) if clock_s is not None else None, map_id=map_id)
    db.add(bm)
    db.commit()
    return bm


def attach_pending(db: Session, match: Match) -> int:
    """Rattache au replay les marque-pages posés pendant cette partie (played_at = fin de la partie)."""
    if not match.played_at or not match.replay:
        return 0
    end = _aware(match.played_at)
    start = end - timedelta(seconds=match.duration_s) - LOADING_MARGIN
    attached = 0
    for bm in db.scalars(select(Bookmark).where(Bookmark.file_hash.is_(None))):
        created = _aware(bm.created_at)
        if not start <= created <= end + timedelta(minutes=1):
            continue
        bm.file_hash = match.replay.file_hash
        if bm.clock_s is None:  # horloge non synchronisée : déduite de la fin de la partie
            bm.clock_s = max(0.0, round(match.duration_s - (end - created).total_seconds(), 1))
            bm.clock_estimated = True
        attached += 1
    if attached:
        db.commit()
    return attached


def _label(e, me_team: int, players: dict) -> str | None:
    side = tr("allié") if e.team == me_team else tr("adversaire")
    if e.kind == "death":
        p = players.get(e.slot)
        return tr("Mort de {hero} ({side}).", hero=p.hero_name if p else "?", side=side)
    if e.kind == "structure":
        return tr("Bâtiment détruit par l'équipe {side}.", side=side)
    if e.kind == "camp":
        return tr("Camp pris par l'équipe {side}.", side=side)
    if e.kind == "objective" and e.team in (0, 1):
        return tr("Objectif de carte : équipe {side}.", side=side)
    return None


def bookmark_out(bm: Bookmark, match: Match | None = None, me_team: int | None = None) -> dict:
    out = {"id": bm.id, "clock_s": bm.clock_s, "clock": fmt_clock(bm.clock_s) if bm.clock_s is not None else None,
           "clock_estimated": bm.clock_estimated, "note": bm.note, "created_at": bm.created_at,
           "attached": bm.file_hash is not None, "around": []}
    if match is not None and me_team is not None and bm.clock_s is not None:
        players = {p.slot: p for p in match.players}
        for e in match.events:
            if abs(e.t_s - bm.clock_s) <= AROUND_S:
                text = _label(e, me_team, players)
                if text:
                    out["around"].append({"clock": fmt_clock(e.t_s), "text": text})
    return out


def match_bookmarks(db: Session, match: Match, me_team: int) -> list[dict]:
    if not match.replay:
        return []
    rows = db.scalars(select(Bookmark).where(Bookmark.file_hash == match.replay.file_hash).order_by(Bookmark.clock_s))
    return [bookmark_out(bm, match, me_team) for bm in rows]
