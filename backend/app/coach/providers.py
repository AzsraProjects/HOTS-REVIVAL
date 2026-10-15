"""Fournisseurs d'IA du coach : Claude (SDK Anthropic) ou toute API compatible OpenAI.

Le format « chat completions » d'OpenAI est accepté par la plupart des fournisseurs
(Google Gemini, OpenAI, Mistral, OpenRouter, Ollama en local…) : un seul client HTTP
suffit pour tous. Clés et modèles sont enregistrés par fournisseur, on peut donc
passer de l'un à l'autre sans tout ressaisir.
"""
from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from dataclasses import asdict, dataclass

import httpx

from app.config import Settings

TIMEOUT = httpx.Timeout(120.0, connect=10.0)


class CoachError(RuntimeError):
    """Erreur lisible par le joueur (clé refusée, modèle inconnu, service injoignable…)."""


@dataclass(frozen=True)
class Provider:
    id: str
    label: str
    base_url: str  # API compatible OpenAI ; vide pour Claude (SDK) et « custom » (saisie du joueur)
    default_model: str
    key_env: str = ""  # variable d'environnement lue si aucune clé n'est enregistrée
    key_url: str = ""  # où créer une clé
    needs_key: bool = True


PROVIDERS: dict[str, Provider] = {p.id: p for p in (
    Provider("anthropic", "Claude (Anthropic)", "", "claude-opus-5-5", "ANTHROPIC_API_KEY",
             "console.anthropic.com"),
    Provider("gemini", "Gemini (Google)", "https://generativelanguage.googleapis.com/v1beta/openai",
             "gemini-flash-latest", "GEMINI_API_KEY", "aistudio.google.com/apikey"),
    Provider("openai", "ChatGPT (OpenAI)", "https://api.openai.com/v1", "gpt-5-mini", "OPENAI_API_KEY",
             "platform.openai.com/api-keys"),
    Provider("mistral", "Mistral", "https://api.mistral.ai/v1", "mistral-large-latest", "MISTRAL_API_KEY",
             "console.mistral.ai/api-keys"),
    Provider("openrouter", "OpenRouter (tous les modèles)", "https://openrouter.ai/api/v1", "openrouter/auto",
             "OPENROUTER_API_KEY", "openrouter.ai/keys"),
    Provider("ollama", "Ollama (local, gratuit)", "http://localhost:11434/v1", "llama3.1",
             key_url="ollama.com", needs_key=False),
    Provider("custom", "Autre (compatible OpenAI)", "", "", needs_key=False),
)}


def current(settings: Settings) -> Provider:
    return PROVIDERS.get(settings.ai_provider, PROVIDERS["anthropic"])


def api_key(settings: Settings, provider: Provider) -> str:
    key = settings.ai_api_keys.get(provider.id, "")
    if not key and provider.id == "anthropic":
        key = settings.anthropic_api_key  # réglage historique
    if not key and provider.key_env:
        key = os.environ.get(provider.key_env, "")
    return key


def model(settings: Settings, provider: Provider) -> str:
    default = settings.claude_model if provider.id == "anthropic" else provider.default_model
    return settings.ai_models.get(provider.id) or default


def base_url(settings: Settings, provider: Provider) -> str:
    return (settings.ai_base_url if provider.id == "custom" else provider.base_url).rstrip("/")


def is_ready(settings: Settings) -> bool:
    p = current(settings)
    if p.id == "custom":
        return bool(base_url(settings, p) and model(settings, p))
    return bool(api_key(settings, p)) or not p.needs_key


def describe(settings: Settings) -> list[dict]:
    """Catalogue pour l'écran Paramètres (sans aucune clé)."""
    return [{**asdict(p), "default_model": settings.claude_model if p.id == "anthropic" else p.default_model}
            for p in PROVIDERS.values()]


# ---- client compatible OpenAI ------------------------------------------------------------
def _request(settings: Settings) -> tuple[Provider, str, dict]:
    p = current(settings)
    url = base_url(settings, p)
    if not url:
        raise CoachError("Adresse de l'API manquante : renseignez-la dans Paramètres.")
    headers = {"Content-Type": "application/json"}
    key = api_key(settings, p)
    if key:
        headers["Authorization"] = f"Bearer {key}"
    return p, f"{url}/chat/completions", headers


def _http_error(p: Provider, settings: Settings, response: httpx.Response) -> CoachError:
    code = response.status_code
    if code in (401, 403):
        return CoachError(f"Clé refusée par {p.label} : vérifiez-la dans Paramètres.")
    if code == 404:
        return CoachError(f"Modèle « {model(settings, p)} » introuvable chez {p.label}.")
    if code == 429:
        return CoachError("Limite de requêtes atteinte, réessayez dans un instant.")
    return CoachError(f"Erreur de l'API {p.label} ({code}).")


def _messages(system: str, messages: list[dict]) -> list[dict]:
    return [{"role": "system", "content": system}, *({"role": m["role"], "content": m["content"]} for m in messages)]


async def stream_chat(settings: Settings, system: str, messages: list[dict]) -> AsyncIterator[str]:
    p, url, headers = _request(settings)
    payload = {"model": model(settings, p), "messages": _messages(system, messages), "stream": True}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            async with client.stream("POST", url, headers=headers, json=payload) as response:
                if response.status_code >= 400:
                    await response.aread()
                    raise _http_error(p, settings, response)
                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[5:].strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                    except ValueError:
                        continue
                    for choice in chunk.get("choices") or []:
                        text = (choice.get("delta") or {}).get("content")
                        if text:
                            yield text
    except httpx.HTTPError as exc:
        raise CoachError(f"Impossible de joindre {p.label}.") from exc


async def complete_json(settings: Settings, system: str, prompt: str) -> str:
    """Réponse complète au format JSON (réessaie sans `response_format` si le fournisseur le refuse)."""
    p, url, headers = _request(settings)
    payload = {"model": model(settings, p), "messages": _messages(system, [{"role": "user", "content": prompt}]),
               "response_format": {"type": "json_object"}}
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            response = await client.post(url, headers=headers, json=payload)
            if response.status_code == 400:
                payload.pop("response_format")
                response = await client.post(url, headers=headers, json=payload)
    except httpx.HTTPError as exc:
        raise CoachError(f"Impossible de joindre {p.label}.") from exc
    if response.status_code >= 400:
        raise _http_error(p, settings, response)
    choices = response.json().get("choices") or [{}]
    return (choices[0].get("message") or {}).get("content") or ""


def extract_json(text: str) -> str:
    """Isole l'objet JSON d'une réponse (certains modèles l'entourent de ``` ou de texte)."""
    start, end = text.find("{"), text.rfind("}")
    return text[start:end + 1] if start != -1 and end > start else text
