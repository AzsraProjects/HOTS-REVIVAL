import asyncio
import json

import httpx
import pytest

from app.coach import client as coach_client
from app.coach import providers
from app.config import Settings
from tests.test_api import client  # noqa: F401  (fixture)

FACTS = {"headline": "Victoire", "strengths": ["a"], "weaknesses": ["b"]}
SUMMARY = {"summary": "Bonne partie.", "strengths": ["s"], "weaknesses": ["w"], "key_moments": [],
           "major_mistakes": [], "excellent_actions": [], "improvement_plan": ["p"], "role_advice": []}


def _mock_http(monkeypatch, handler):
    real = httpx.AsyncClient
    monkeypatch.setattr(providers.httpx, "AsyncClient",
                        lambda **kw: real(transport=httpx.MockTransport(handler), **kw))


def test_switch_provider_keeps_keys_per_provider(client):  # noqa: F811
    r = client.put("/api/settings", json={"ai_provider": "gemini", "ai_api_key": "g-key", "ai_model": "gemini-x"})
    body = r.json()
    assert body["ai_provider"] == "gemini" and body["ai_model"] == "gemini-x" and body["ai_ready"] is True
    assert "g-key" not in r.text
    assert client.get("/api/coach/status").json()["model"] == "Gemini (Google) · gemini-x"

    body = client.put("/api/settings", json={"ai_provider": "openai"}).json()
    assert body["has_api_key"] is False and body["ai_ready"] is False and body["ai_keys_set"] == ["gemini"]
    body = client.put("/api/settings", json={"ai_provider": "gemini"}).json()
    assert body["has_api_key"] is True  # la clé Gemini n'a pas été perdue

    assert client.put("/api/settings", json={"ai_provider": "inconnu"}).status_code == 400
    ollama = client.put("/api/settings", json={"ai_provider": "ollama"}).json()
    assert ollama["ai_ready"] is True  # local : aucune clé


def test_custom_provider_needs_url_and_model():
    s = Settings(ai_provider="custom")
    assert providers.is_ready(s) is False
    s = Settings(ai_provider="custom", ai_base_url="http://localhost:1234/v1/", ai_models={"custom": "qwen"})
    assert providers.is_ready(s) and providers.base_url(s, providers.current(s)) == "http://localhost:1234/v1"


def test_compatible_summary_and_stream(monkeypatch):
    seen = []

    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        seen.append((str(request.url), request.headers.get("authorization"), body))
        if body.get("stream"):
            lines = [f"data: {json.dumps({'choices': [{'delta': {'content': t}}]})}" for t in ("Bon", "jour")]
            return httpx.Response(200, text="\n\n".join([*lines, "data: [DONE]"]))
        content = f"Voici :\n```json\n{json.dumps(SUMMARY)}\n```"
        return httpx.Response(200, json={"choices": [{"message": {"content": content}}]})

    _mock_http(monkeypatch, handler)
    s = Settings(ai_provider="mistral", ai_api_keys={"mistral": "m-key"})
    summary = asyncio.run(coach_client.generate_game_summary(s, FACTS, "contexte"))
    assert summary is not None and summary.summary == "Bonne partie."
    url, auth, body = seen[0]
    assert url == "https://api.mistral.ai/v1/chat/completions" and auth == "Bearer m-key"
    assert body["model"] == "mistral-large-latest" and body["messages"][0]["role"] == "system"

    async def collect():
        return [t async for t in coach_client.stream_coach_reply(s, "ctx", [{"role": "user", "content": "?"}])]

    assert asyncio.run(collect()) == ["Bon", "jour"]


def test_compatible_errors_are_readable(monkeypatch):
    _mock_http(monkeypatch, lambda request: httpx.Response(401, json={"error": "bad key"}))
    s = Settings(ai_provider="openai", ai_api_keys={"openai": "x"})
    with pytest.raises(providers.CoachError, match="Clé refusée par ChatGPT"):
        asyncio.run(coach_client.generate_game_summary(s, FACTS, "ctx"))
