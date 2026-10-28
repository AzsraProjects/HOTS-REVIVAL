"""Réanalyse l'historique si la version d'analyse a changé, sans importer de nouveau replay.

Sert à la version de test locale (scripts/test-local.ps1), où la surveillance des replays — qui déclenche
d'habitude cette réanalyse — est désactivée. Usage : python scripts/reanalyze_history.py (utilise HOTS_DATA_DIR)
"""
from __future__ import annotations

import logging
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import select  # noqa: E402

from app.config import get_settings  # noqa: E402
from app.db import SessionLocal, create_schema, init_engine  # noqa: E402
from app.models import Match, Replay  # noqa: E402
from app.replay.reanalyze import ANALYSIS_VERSION, mark_done, needs_reanalysis  # noqa: E402
from app.replay.watcher import ReplayImporter  # noqa: E402
from app.safekeeping import archive_existing  # noqa: E402


def main() -> None:
    logging.basicConfig(level=logging.WARNING)
    if not needs_reanalysis():
        print(f"Historique déjà analysé (version {ANALYSIS_VERSION}).")
        return
    settings = get_settings()
    init_engine(settings.resolved_database_url())
    create_schema()
    importer = ReplayImporter(settings.resolved_replay_dirs(), settings.resolved_toon_handles(), lambda *_: None)
    with SessionLocal() as db:
        archive_existing(db)  # résumés IA mis à l'abri avant toute réécriture
        db.commit()
        ids = list(db.scalars(select(Replay.id).join(Match)))
    print(f"Réanalyse de {len(ids)} parties (version {ANALYSIS_VERSION})…")
    done = sum(1 for replay_id in ids if importer.reanalyze(replay_id))
    mark_done()
    print(f"{done} parties réanalysées.")


if __name__ == "__main__":
    main()
