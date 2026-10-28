"""Traduction FR / EN des textes générés par le moteur (rapports, draft, conseils en jeu…).

Le français est la langue source : tr("Texte français") renvoie la traduction anglaise
(dictionnaires de app/locales/) quand l'anglais est choisi dans les Paramètres.
Application locale mono-utilisateur : la langue courante est un réglage global.
"""
from __future__ import annotations

import importlib
from functools import lru_cache

LANGUAGES = ("fr", "en")
# Dictionnaires de app/locales/ (liste explicite : fiable une fois empaqueté par PyInstaller).
LOCALE_MODULES = ("en_common", "en_report", "en_draft", "en_live", "en_coach", "en_data", "en_insights")
_current = "fr"


def set_language(lang: str | None) -> None:
    global _current
    _current = lang if lang in LANGUAGES else "fr"


def language() -> str:
    return _current


@lru_cache
def _english() -> dict[str, str]:
    """Fusion des dictionnaires app/locales/en_*.py (un fichier par domaine)."""
    merged: dict[str, str] = {}
    for name in LOCALE_MODULES:
        try:
            merged.update(importlib.import_module(f"app.locales.{name}").EN)
        except ModuleNotFoundError:
            continue
    return merged


def tr(fr: str, **values: object) -> str:
    """tr("Partie perdue à {clock}", clock="13:45")"""
    text = _english().get(fr, fr) if _current == "en" else fr
    return text.format(**values) if values else text
