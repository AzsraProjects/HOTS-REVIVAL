"""Garde-fous de conformité Blizzard.

HOTS REVIVAL n'interagit JAMAIS avec le processus du jeu. Toute donnée
utilisée par l'overlay doit provenir d'une des sources déclarées ci-dessous.
Ce module est la référence lue par l'UI (/api/compliance) et par les tests.
"""
from __future__ import annotations

from app.i18n import tr

ALLOWED_SOURCES: dict[str, str] = {
    "game_process": "Présence du processus HeroesOfTheStorm dans la liste des programmes (jeu lancé / fermé), "
                    "comme le fait Discord. Le processus n'est jamais ouvert ni lu.",
    "replay_files": "Fichiers .StormReplay terminés, écrits par le jeu dans Documents (analyse post-partie).",
    "battlelobby_file": "Fichier replay.server.battlelobby écrit par le jeu au chargement : uniquement les "
                        "informations affichées sur l'écran de chargement (joueurs, carte).",
    "user_input": "Saisies volontaires du joueur dans l'overlay (carte, synchronisation d'horloge, niveaux "
                  "d'équipe affichés en haut de l'écran, camps observés).",
    "screen_reading": "Option désactivée par défaut : lecture locale (OCR) de trois zones publiques du HUD "
                      "(horloge, niveau de chaque équipe), jamais la mini-carte ; aucune image conservée.",
    "static_data": "Données publiques : timings de carte, profils de héros, catalogue des talents.",
    "public_websites": "Pages publiques d'Icy Veins (tier lists, guides : builds, synergies, contres), "
                       "téléchargées hors partie et citées avec un lien vers la source.",
    "own_history": "Historique de replays du joueur et statistiques agrégées dérivées.",
}

FORBIDDEN_CAPABILITIES: tuple[str, ...] = (
    "Lecture ou écriture de la mémoire du processus HeroesOfTheStorm",
    "Injection de DLL / hook DirectX / interception réseau",
    "Envoi d'entrées clavier/souris au jeu (macros, scripts, automatisation)",
    "Révélation du brouillard de guerre ou de positions ennemies invisibles",
    "Suivi des cooldowns ennemis non visibles",
    "Décodage des évènements de replay d'une partie en cours",
)

# Jetons interdits dans le code source (vérifiés par tests/test_compliance.py)
FORBIDDEN_CODE_TOKENS: tuple[str, ...] = (
    "ReadProcessMemory", "WriteProcessMemory", "OpenProcess", "CreateRemoteThread",
    "VirtualAllocEx", "SetWindowsHookEx", "SendInput", "keybd_event", "mouse_event",
    "pymem", "pywinauto", "pyautogui", "robotjs", "nut-js", "frida",
)


STATEMENT = ("Overlay passif : aucune lecture mémoire, aucune injection, aucune action automatique. "
             "Seules les informations publiques ou personnelles sont utilisées.")


def describe() -> dict:
    return {
        "allowed_sources": {key: tr(text) for key, text in ALLOWED_SOURCES.items()},
        "forbidden": [tr(text) for text in FORBIDDEN_CAPABILITIES],
        "statement": tr(STATEMENT),
    }
