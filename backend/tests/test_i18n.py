"""Chaque texte passé à tr("…") dans le moteur a sa traduction anglaise (app/locales/)."""
import re
from pathlib import Path

from app.i18n import _english, set_language, tr

APP = Path(__file__).resolve().parents[1] / "app"
CALL = re.compile(r'\btr\(\s*"((?:[^"\\]|\\.)*)"')


def test_every_tr_call_is_translated():
    keys = _english()
    missing = []
    for file in APP.rglob("*.py"):
        if file.name == "i18n.py" or "locales" in file.parts:
            continue
        for text in CALL.findall(file.read_text(encoding="utf-8")):
            if text.encode().decode("unicode_escape") not in keys and text not in keys:
                missing.append(f"{file.name}: {text}")
    assert not missing, "Traductions anglaises manquantes :\n" + "\n".join(missing)


def test_language_switch():
    set_language("en")
    try:
        assert tr("Texte absent du dictionnaire {n}", n=2) == "Texte absent du dictionnaire 2"
    finally:
        set_language("fr")
