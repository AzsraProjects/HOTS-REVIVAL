"""Réanalyse de l'historique quand l'analyseur évolue (ex. nouveaux évènements de carte).

Sur place et en arrière-plan : aucune partie n'est effacée, chacune est remplacée par sa nouvelle analyse
(même identifiant), des plus récentes aux plus anciennes. Une mise à jour ne vide donc jamais l'historique.
Les résumés IA déjà générés sont conservés (app/safekeeping.py) : aucun appel à Claude n'est repayé.
"""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy import select

from app.config import data_dir
from app.db import SessionLocal
from app.models import Match, Replay
from app.safekeeping import archive_existing

log = logging.getLogger(__name__)

# À incrémenter quand l'extraction change de manière significative.
ANALYSIS_VERSION = 6  # 6 : bâtiments avec leur équipe, réapparitions réelles (avantages convertis ou perdus)


def _marker() -> Path:
    return data_dir() / "analysis_version.txt"


def needs_reanalysis() -> bool:
    try:
        return int(_marker().read_text().strip()) < ANALYSIS_VERSION
    except (OSError, ValueError):
        return True


def mark_done() -> None:
    _marker().write_text(str(ANALYSIS_VERSION))


def reanalyze_all(importer) -> dict:  # importer: ReplayImporter
    with SessionLocal() as db:
        kept = archive_existing(db)  # filet de sécurité avant toute réécriture
        db.commit()
        ids = list(db.scalars(
            select(Replay.id).outerjoin(Match).order_by(Match.played_at.desc().nulls_last(), Replay.id.desc())
        ))

    importer.scan()  # nouveaux replays d'abord : déjà analysés avec la nouvelle version
    reanalyzed = sum(1 for replay_id in ids if importer.reanalyze(replay_id))

    mark_done()
    log.info("Réanalyse terminée : %s parties", reanalyzed)
    return {"reanalyzed": reanalyzed, "kept_ai_summaries": kept}
