"""Coach IA : Claude (SDK officiel Anthropic) ou tout fournisseur compatible OpenAI (voir providers.py)."""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator

import anthropic
from anthropic.types.beta import BetaMessageParam
from pydantic import BaseModel, Field, ValidationError

from app.coach import providers
from app.coach.prompts import coach_system, json_only, summary_instructions
from app.coach.providers import CoachError
from app.coach.roles import role_context
from app.config import Settings
from app.i18n import tr

log = logging.getLogger(__name__)

# Repli serveur automatique si un classifieur de sécurité refuse la requête.
FALLBACK_BETA = "server-side-fallback-2026-07-01"


class GameSummary(BaseModel):
    summary: str = Field(description="Résumé général en 2-3 phrases")
    strengths: list[str]
    weaknesses: list[str]
    key_moments: list[str]
    major_mistakes: list[str]
    excellent_actions: list[str]
    improvement_plan: list[str]
    role_advice: list[str] = Field(
        default_factory=list,
        description="2 à 4 conseils propres au rôle et au héros joués (ex. comment mieux soigner avec ce héros)",
    )


class CoachUnavailable(CoachError):
    pass


def coach_available(settings: Settings) -> bool:
    return providers.is_ready(settings)


def model_label(settings: Settings) -> str:
    """Fournisseur et modèle utilisés, tels qu'affichés au joueur (« Gemini (Google) · gemini-… »)."""
    p = providers.current(settings)
    return f"{tr(p.label)} · {providers.model(settings, p)}"


def _uses_claude(settings: Settings) -> bool:
    return providers.current(settings).id == "anthropic"


def _client(settings: Settings) -> anthropic.AsyncAnthropic:
    key = providers.api_key(settings, providers.PROVIDERS["anthropic"])
    if not key:
        raise CoachUnavailable(tr("ANTHROPIC_API_KEY n'est pas configurée."))
    return anthropic.AsyncAnthropic(api_key=key)


def _claude_error(exc: anthropic.APIError) -> CoachError:
    if isinstance(exc, anthropic.RateLimitError):
        return CoachError(tr("Limite de requêtes atteinte, réessayez dans un instant."))
    if isinstance(exc, anthropic.APIStatusError):
        return CoachError(tr("Erreur de l'API Claude ({code}).", code=exc.status_code))
    return CoachError(tr("Impossible de joindre l'API Claude."))


def _system(context: str) -> list[dict]:
    # bloc stable mis en cache, puis contexte joueur (variable)
    return [
        {"type": "text", "text": coach_system(), "cache_control": {"type": "ephemeral"}},
        {"type": "text", "text": context},
    ]


async def stream_coach_reply(
    settings: Settings, context: str, messages: list[BetaMessageParam]
) -> AsyncIterator[str]:
    if not _uses_claude(settings):
        async for text in providers.stream_chat(settings, f"{coach_system()}\n\n{context}", messages):
            yield text
        return
    try:
        async for text in _stream_claude(settings, context, messages):
            yield text
    except anthropic.APIError as exc:
        raise _claude_error(exc) from exc


async def _stream_claude(settings: Settings, context: str, messages: list[BetaMessageParam]) -> AsyncIterator[str]:
    async with _client(settings).beta.messages.stream(
        model=providers.model(settings, providers.PROVIDERS["anthropic"]),
        max_tokens=16000,
        thinking={"type": "adaptive"},
        output_config={"effort": settings.claude_effort},
        betas=[FALLBACK_BETA],
        fallbacks="default",
        system=_system(context),
        messages=messages,
    ) as stream:
        async for text in stream.text_stream:
            yield text
        final = await stream.get_final_message()
    if final.stop_reason == "refusal":
        yield "\n\n_" + tr("Le coach n'a pas pu répondre à cette demande. Reformulez votre question.") + "_"
    elif final.stop_reason == "max_tokens":
        yield "\n\n_(" + tr("réponse tronquée") + ")_"


async def generate_game_summary(settings: Settings, facts: dict, context: str) -> GameSummary | None:
    if not _uses_claude(settings):
        return await _summary_compatible(settings, facts, context)
    try:
        return await _summary_claude(settings, facts, context)
    except anthropic.APIError as exc:
        raise _claude_error(exc) from exc


async def _summary_compatible(settings: Settings, facts: dict, context: str) -> GameSummary | None:
    schema = json.dumps(GameSummary.model_json_schema(), ensure_ascii=False)
    prompt = (f"{summary_instructions()}\n\n{json_only()}\n{schema}"
              f"\n\n```json\n{json.dumps(facts, ensure_ascii=False)}\n```")
    text = await providers.complete_json(settings, f"{coach_system()}\n\n{context}", prompt)
    try:
        return GameSummary.model_validate_json(providers.extract_json(text))
    except ValidationError:
        log.warning("Résumé IA illisible (%s)", model_label(settings))
        return None


async def _summary_claude(settings: Settings, facts: dict, context: str) -> GameSummary | None:
    response = await _client(settings).beta.messages.parse(
        model=providers.model(settings, providers.PROVIDERS["anthropic"]),
        max_tokens=16000,
        thinking={"type": "adaptive"},
        output_config={"effort": settings.claude_effort},
        betas=[FALLBACK_BETA],
        fallbacks="default",
        system=_system(context),
        messages=[{
            "role": "user",
            "content": f"{summary_instructions()}\n\n```json\n{json.dumps(facts, ensure_ascii=False)}\n```",
        }],
        output_format=GameSummary,
    )
    if response.stop_reason == "refusal":
        log.warning("Résumé refusé par le modèle")
        return None
    return response.parsed_output


def deterministic_summary(facts: dict) -> GameSummary:
    """Rapport sans IA (clé absente ou indisponibilité de l'API)."""
    return GameSummary(
        summary=facts.get("headline", ""),
        strengths=facts.get("strengths", []),
        weaknesses=facts.get("weaknesses", []),
        key_moments=facts.get("key_moments", [])[:5],
        major_mistakes=[tr("Mort à {clock}", clock=t) for t in facts.get("my_death_times", [])[:3]],
        excellent_actions=[],
        improvement_plan=facts.get("improvement_plan", []),
        role_advice=role_context((facts.get("role_context") or {}).get("role"))["habits"][:3],
    )
