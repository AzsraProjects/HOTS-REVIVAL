"""Plateforme communautaire : accord de partage, profil public, suppression."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.community.client import CommunityClient, CommunityError, forget_credentials, load_credentials, profile_slug
from app.community.uploader import count_pending
from app.config import Settings, app_settings, get_settings, write_user_settings
from app.db import get_db
from app.models import CommunityUpload, MatchPlayer

router = APIRouter(prefix="/community", tags=["communauté"])
SENT = ("accepted", "confirmed", "conflict", "duplicate")


class CommunityUpdate(BaseModel):
    share_matches: bool | None = None
    public_profile: bool | None = None


def profile_name(db: Session, settings: Settings) -> str:
    if settings.player_battletag:
        return settings.player_battletag
    return db.scalar(select(MatchPlayer.name).where(MatchPlayer.is_me.is_(True)).order_by(MatchPlayer.id.desc())) or ""


def _status(request: Request, db: Session, settings: Settings) -> dict:
    counts = dict(db.execute(select(CommunityUpload.status, func.count()).group_by(CommunityUpload.status)).all())
    uploader = getattr(request.app.state, "community_uploader", None)
    return {
        "available": bool(settings.community_url),
        "share_matches": settings.share_matches,
        "public_profile": settings.public_profile,
        "profile_slug": profile_slug() if settings.public_profile else None,
        "registered": load_credentials() is not None,
        "sent": sum(counts.get(s, 0) for s in SENT),
        "rejected": counts.get("rejected", 0),
        "pending": count_pending(db) if settings.share_matches else 0,
        "last_error": uploader.last_error if uploader else None,
        "paused_until": uploader.paused_until.isoformat() if uploader and uploader.paused_until else None,
    }


def _save(request: Request, values: dict) -> Settings:
    write_user_settings(values)
    get_settings.cache_clear()
    request.app.state.settings = request.app.state.settings.model_copy(update=values)
    return request.app.state.settings


@router.get("")
def status(request: Request, db: Session = Depends(get_db), settings: Settings = Depends(app_settings)) -> dict:
    return _status(request, db, settings)


@router.put("")
def update(body: CommunityUpdate, request: Request, db: Session = Depends(get_db),
           settings: Settings = Depends(app_settings)) -> dict:
    if not settings.community_url:
        raise HTTPException(409, "La plateforme communautaire n'est pas encore en ligne.")
    values = body.model_dump(exclude_none=True)
    if values.get("public_profile") and not (values.get("share_matches", settings.share_matches)):
        raise HTTPException(400, "Le profil public nécessite le partage des parties.")
    if values.get("share_matches") is False:
        values["public_profile"] = False  # plus de partage = plus de profil public

    notice = None
    if "public_profile" in values and values["public_profile"] != settings.public_profile:
        client = CommunityClient(settings.community_url)
        try:
            if values["public_profile"]:
                client.set_profile(True, profile_name(db, settings), settings.resolved_toon_handles())
            elif load_credentials():
                client.set_profile(False)
        except CommunityError as exc:
            if exc.status == 409:  # pas encore assez de parties envoyées : activé après les premiers envois
                notice = "Votre profil sera publié dès que vos premières parties auront été envoyées."
            else:
                raise HTTPException(400 if exc.status == 400 else 502, str(exc)) from exc

    settings = _save(request, values)
    uploader = getattr(request.app.state, "community_uploader", None)
    if uploader and settings.share_matches:
        uploader.wake()
    return {**_status(request, db, settings), "notice": notice}


@router.delete("/me")
def delete_me(request: Request, db: Session = Depends(get_db), settings: Settings = Depends(app_settings)) -> dict:
    """Retire le profil et tout lien entre ce joueur et ses parties sur la plateforme."""
    if settings.community_url:
        try:
            CommunityClient(settings.community_url).delete_me()
        except CommunityError as exc:
            raise HTTPException(502, str(exc)) from exc
    else:
        forget_credentials()
    db.query(CommunityUpload).delete()
    db.commit()
    return _status(request, db, _save(request, {"share_matches": False, "public_profile": False}))
