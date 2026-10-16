"""Réglages modifiables depuis l'interface (aucun fichier à éditer)."""
from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Literal

from pydantic import BaseModel, Field

from app.coach import providers
from app.config import Settings, app_settings, data_dir, get_settings, write_user_settings
from app.i18n import set_language

router = APIRouter(prefix="/settings", tags=["paramètres"])


class SettingsOut(BaseModel):
    replay_dir: str
    replay_dir_detected: str | None
    replay_dir_exists: bool
    player_battletag: str
    player_toon_handle: str | None
    ai_provider: str
    ai_model: str  # modèle choisi par le joueur pour ce fournisseur ("" = modèle par défaut)
    ai_models: dict[str, str]  # modèles choisis, par fournisseur
    ai_base_url: str
    ai_ready: bool
    has_api_key: bool  # clé enregistrée pour le fournisseur choisi
    ai_keys_set: list[str]  # fournisseurs ayant une clé (jamais la clé elle-même)
    providers: list[dict]
    data_dir: str
    language: str


class SettingsUpdate(BaseModel):
    replay_dir: str | None = None
    language: Literal["fr", "en"] | None = None
    player_battletag: str | None = Field(None, max_length=80)
    ai_provider: str | None = Field(None, max_length=32)
    ai_api_key: str | None = Field(None, max_length=300)  # clé du fournisseur choisi
    ai_model: str | None = Field(None, max_length=120)
    ai_base_url: str | None = Field(None, max_length=300)
    # anciens champs (Claude uniquement), toujours acceptés
    anthropic_api_key: str | None = Field(None, max_length=300)
    claude_model: str | None = Field(None, max_length=64)


def _out(s: Settings) -> SettingsOut:
    folder = s.resolved_replay_dir()
    return SettingsOut(
        replay_dir=s.replay_dir,
        replay_dir_detected=str(folder) if folder else None,
        replay_dir_exists=bool(folder and folder.is_dir()),
        player_battletag=s.player_battletag,
        player_toon_handle=s.resolved_toon_handle(),
        ai_provider=providers.current(s).id,
        ai_model=s.ai_models.get(providers.current(s).id, ""),
        ai_models=s.ai_models,
        ai_base_url=s.ai_base_url,
        ai_ready=providers.is_ready(s),
        has_api_key=bool(providers.api_key(s, providers.current(s))),
        ai_keys_set=[p.id for p in providers.PROVIDERS.values() if providers.api_key(s, p)],
        providers=providers.describe(s),
        data_dir=str(data_dir()),
        language=s.language or "fr",
    )


@router.get("", response_model=SettingsOut)
def read(settings: Settings = Depends(app_settings)) -> SettingsOut:
    return _out(settings)


@router.put("", response_model=SettingsOut)
def update(body: SettingsUpdate, request: Request) -> SettingsOut:
    values = body.model_dump(exclude_none=True)
    if values.get("replay_dir") and not Path(values["replay_dir"]).is_dir():
        raise HTTPException(400, "Ce dossier n'existe pas.")
    values = {k: v.strip() for k, v in values.items()}
    old: Settings = request.app.state.settings
    provider = values.get("ai_provider") or old.ai_provider
    if provider not in providers.PROVIDERS:
        raise HTTPException(400, "Fournisseur d'IA inconnu.")
    # clé et modèle sont rangés par fournisseur : changer d'IA ne fait rien perdre
    if "ai_api_key" in values:
        values["ai_api_keys"] = {**old.ai_api_keys, provider: values.pop("ai_api_key")}
    if "ai_model" in values:
        values["ai_models"] = {**old.ai_models, provider: values.pop("ai_model")}
    write_user_settings(values)
    get_settings.cache_clear()

    new = old.model_copy(update=values)
    request.app.state.settings = new
    set_language(new.language)
    if new.resolved_replay_dirs() != old.resolved_replay_dirs() or new.resolved_toon_handles() != old.resolved_toon_handles():
        from app.main import start_replay_watching

        start_replay_watching(request.app, getattr(request.app.state, "start_watchers", True))
    return _out(new)
