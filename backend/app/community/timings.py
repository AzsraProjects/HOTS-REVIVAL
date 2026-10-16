"""Timers d'objectif mis en commun par la communauté (GET /v1/stats/objectives).

Lecture publique, sans compte ni partage : même un joueur qui ne partage pas ses parties profite
des timers mesurés sur celles des autres. Copie locale rafraîchie toutes les 12 h, lue sans réseau
(l'overlay ne doit jamais attendre internet).
"""
from __future__ import annotations

import json
import logging
import time

import httpx

from app.config import data_dir

log = logging.getLogger(__name__)
REFRESH_S = 12 * 3600
_cache: dict = {"mtime": None, "maps": {}}


def _path():
    return data_dir() / "community_timings.json"


def _read() -> dict:
    path = _path()
    try:
        mtime = path.stat().st_mtime
    except OSError:
        return {}
    if _cache["mtime"] != mtime:
        try:
            _cache.update(mtime=mtime, maps=json.loads(path.read_text(encoding="utf-8")).get("maps", {}))
        except (OSError, ValueError):
            _cache.update(mtime=mtime, maps={})
    return _cache["maps"]


def community_timings(map_id: str) -> dict | None:
    """Timers communautaires d'une carte (copie locale), ou None."""
    return _read().get(map_id)


def refresh_if_stale(base_url: str) -> bool:
    """Télécharge les timers communautaires si la copie locale a plus de 12 h. Jamais bloquant
    pour l'overlay : appelé depuis le fil d'envoi en arrière-plan."""
    path = _path()
    try:
        if time.time() - path.stat().st_mtime < REFRESH_S:
            return False
    except OSError:
        pass
    try:
        r = httpx.get(f"{base_url.rstrip('/')}/v1/stats/objectives", timeout=15)
        r.raise_for_status()
        maps = r.json().get("maps", {})
    except (httpx.HTTPError, ValueError) as exc:
        log.info("Timers communautaires indisponibles : %s", exc)
        return False
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps({"fetched_at": int(time.time()), "maps": maps}), encoding="utf-8")
    tmp.replace(path)
    return True
