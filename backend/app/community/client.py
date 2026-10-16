"""Client HTTP de la plateforme communautaire (server/src/index.ts)."""
from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path

import httpx

from app import __version__
from app.config import data_dir
from app.i18n import tr

log = logging.getLogger(__name__)
TIMEOUT = 20


class CommunityError(Exception):
    def __init__(self, message: str, status: int | None = None, retry_after: int | None = None) -> None:
        super().__init__(message)
        self.status = status
        self.retry_after = retry_after


def _credentials_path() -> Path:
    return data_dir() / "community.json"


@dataclass
class Credentials:
    install_id: str
    token: str

    @property
    def bearer(self) -> str:
        return f"Bearer {self.install_id}.{self.token}"


def load_credentials() -> Credentials | None:
    raw = _read_state()
    if not raw.get("install_id") or not raw.get("token"):
        return None
    return Credentials(raw["install_id"], raw["token"])


def _read_state() -> dict:
    try:
        return json.loads(_credentials_path().read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _write_state(state: dict) -> None:
    path = _credentials_path()
    tmp = path.with_suffix(".tmp")
    tmp.write_text(json.dumps(state), encoding="utf-8")
    tmp.replace(path)


def profile_slug() -> str | None:
    return _read_state().get("profile_slug")


def remember_slug(slug: str | None) -> None:
    state = _read_state()
    if state:
        _write_state({**state, "profile_slug": slug})


def forget_credentials() -> None:
    _credentials_path().unlink(missing_ok=True)


class CommunityClient:
    def __init__(self, base_url: str) -> None:
        self.base_url = base_url.rstrip("/")

    def _request(self, method: str, path: str, creds: Credentials | None = None, body: dict | None = None) -> dict:
        headers = {"User-Agent": f"HOTS-REVIVAL/{__version__}"}
        if creds:
            headers["Authorization"] = creds.bearer
        try:
            r = httpx.request(method, f"{self.base_url}{path}", json=body, headers=headers, timeout=TIMEOUT)
        except httpx.HTTPError as exc:
            raise CommunityError(tr("Plateforme injoignable ({error})", error=type(exc).__name__)) from exc
        if r.status_code >= 400:
            try:
                detail = r.json().get("detail", r.reason_phrase)
            except ValueError:
                detail = r.reason_phrase
            retry = r.headers.get("Retry-After")
            raise CommunityError(str(detail), r.status_code, int(retry) if retry and retry.isdigit() else None)
        return r.json()

    def credentials(self) -> Credentials:
        """Identifiant de cette installation, créé au premier envoi."""
        creds = load_credentials()
        if creds:
            return creds
        raw = self._request("POST", "/v1/installs")
        creds = Credentials(raw["install_id"], raw["token"])
        _write_state({"install_id": creds.install_id, "token": creds.token})
        return creds

    def upload(self, summaries: list[dict]) -> list[dict]:
        return self._request("POST", "/v1/matches", self.credentials(), {"matches": summaries})["results"]

    def set_profile(self, public: bool, name: str = "", toon_handles: list[str] | None = None) -> dict:
        body = {"public": public, "name": name, "toon_handles": toon_handles or []}
        res = self._request("PUT", "/v1/me/profile", self.credentials(), body)
        remember_slug(res.get("slug"))
        return res

    def delete_me(self) -> None:
        creds = load_credentials()
        if creds:
            try:
                self._request("DELETE", "/v1/me", creds)
            except CommunityError as exc:
                if exc.status != 401:  # 401 : déjà supprimée côté serveur
                    raise
        forget_credentials()
