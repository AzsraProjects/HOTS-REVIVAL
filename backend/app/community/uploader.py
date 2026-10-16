"""Envoi en arrière-plan des parties partagées (historique compris), par lots,
en respectant les quotas du serveur (Retry-After)."""
from __future__ import annotations

import logging
import threading
from collections.abc import Callable
from datetime import datetime, timezone

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.community.client import CommunityClient, CommunityError, profile_slug
from app.community.summary import SHARED_MODES, build_summary, is_shareable
from app.config import Settings
from app.db import SessionLocal
from app.i18n import tr
from app.community.timings import refresh_if_stale
from app.models import CommunityObjectiveUpload, CommunityUpload, Match, MatchEvent, MatchPlayer, Replay

log = logging.getLogger(__name__)
BATCH = 25
IDLE_S = 300  # vérification périodique même sans nouvelle partie


def pending_matches(db: Session, limit: int = BATCH) -> list[tuple[str, Match]]:
    """Parties partageables pas encore envoyées, des plus récentes aux plus anciennes."""
    sent = select(CommunityUpload.file_hash)
    rows = db.execute(
        select(Replay.file_hash, Match)
        .join(Match, Match.replay_id == Replay.id)
        .where(Replay.status == "parsed", Match.game_mode.in_(SHARED_MODES), Replay.file_hash.not_in(sent))
        .options(selectinload(Match.players).selectinload(MatchPlayer.score), selectinload(Match.events))
        .order_by(Match.played_at.desc().nullslast(), Match.id.desc())
        .limit(limit * 4)
    ).all()
    out: list[tuple[str, Match]] = []
    for file_hash, match in rows:
        if is_shareable(match):
            out.append((file_hash, match))
        else:  # jamais envoyable (données incomplètes) : on ne la reconsidère plus
            db.add(CommunityUpload(file_hash=file_hash, status="skipped", detail="partie incomplète"))
    db.commit()
    return out[:limit]


def count_pending(db: Session) -> int:
    sent = select(CommunityUpload.file_hash)
    return db.scalar(
        select(func.count(Replay.id)).join(Match, Match.replay_id == Replay.id)
        .where(Replay.status == "parsed", Match.game_mode.in_(SHARED_MODES), Replay.file_hash.not_in(sent))
    ) or 0


def upload_batch(db: Session, client: CommunityClient) -> int:
    """Envoie un lot ; renvoie le nombre de parties traitées (0 = plus rien à envoyer)."""
    batch = pending_matches(db)
    if not batch:
        return 0
    summaries = [build_summary(m) for _, m in batch]
    results = client.upload(summaries)
    for (file_hash, _), summary, res in zip(batch, summaries, results):
        db.merge(CommunityUpload(file_hash=file_hash, status=res.get("status", "rejected"), detail=res.get("detail")))
        if summary.get("objectives"):
            db.merge(CommunityObjectiveUpload(file_hash=file_hash))
    db.commit()
    return len(batch)


SENT_STATUSES = ("accepted", "confirmed", "conflict", "duplicate")


def objective_backfill_batch(db: Session, client: CommunityClient) -> int:
    """Renvoie une fois les parties déjà partagées sans horaires d'objectifs : le serveur
    complète la partie existante (aucun doublon). Renvoie le nombre de parties traitées."""
    done = select(CommunityObjectiveUpload.file_hash)
    has_cycles = select(MatchEvent.match_id).where(MatchEvent.kind == "objective_cycle")
    rows = db.execute(
        select(Replay.file_hash, Match)
        .join(Match, Match.replay_id == Replay.id)
        .join(CommunityUpload, CommunityUpload.file_hash == Replay.file_hash)
        .where(CommunityUpload.status.in_(SENT_STATUSES), Replay.file_hash.not_in(done), Match.id.in_(has_cycles))
        .options(selectinload(Match.players).selectinload(MatchPlayer.score), selectinload(Match.events))
        .limit(BATCH)
    ).all()
    batch = [(h, m) for h, m in rows if is_shareable(m)]
    if batch:
        client.upload([build_summary(m) for _, m in batch])
    for file_hash, _ in rows:
        db.merge(CommunityObjectiveUpload(file_hash=file_hash))
    db.commit()
    return len(rows)


class CommunityUploader:
    def __init__(self, get_settings: Callable[[], Settings]) -> None:
        self._get_settings = get_settings
        self._wake = threading.Event()
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self.last_error: str | None = None
        self.last_sent_at: datetime | None = None
        self.paused_until: datetime | None = None

    def start(self) -> None:
        self._thread = threading.Thread(target=self._run, name="community-uploader", daemon=True)
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()

    def wake(self) -> None:
        self._wake.set()

    def _run(self) -> None:
        while not self._stop.is_set():
            delay = self.run_once()
            self._wake.wait(delay)
            self._wake.clear()

    def run_once(self) -> float:
        """Un cycle d'envoi ; renvoie le délai avant le prochain."""
        settings = self._get_settings()
        if settings.community_url:
            refresh_if_stale(settings.community_url)  # timers communautaires (lecture publique)
        if not (settings.share_matches and settings.community_notice_seen and settings.community_url):
            return IDLE_S  # partage coupé, ou joueur pas encore informé (bandeau de l'application)
        client = CommunityClient(settings.community_url)
        try:
            with SessionLocal() as db:
                sent = upload_batch(db, client) or objective_backfill_batch(db, client)
        except CommunityError as exc:
            self.last_error = str(exc)
            wait = exc.retry_after or 600
            self.paused_until = datetime.fromtimestamp(datetime.now(timezone.utc).timestamp() + wait, timezone.utc)
            log.warning("Partage communautaire en pause %ss : %s", wait, exc)
            return wait
        except Exception:
            log.exception("Partage communautaire")
            self.last_error = tr("Erreur inattendue (voir le journal)")
            return 600
        self.last_error = self.paused_until = None
        if settings.public_profile and not profile_slug():
            self._publish_profile(client, settings)
        if sent:
            self.last_sent_at = datetime.now(timezone.utc)
            return 2  # historique : lot suivant rapidement
        return IDLE_S

    def _publish_profile(self, client: CommunityClient, settings: Settings) -> None:
        """Profil demandé avant que les parties soient envoyées : on le publie dès que possible."""
        from app.api.community import profile_name

        try:
            with SessionLocal() as db:
                client.set_profile(True, profile_name(db, settings), settings.resolved_toon_handles())
        except CommunityError as exc:
            if exc.status != 409:
                log.warning("Profil public : %s", exc)
