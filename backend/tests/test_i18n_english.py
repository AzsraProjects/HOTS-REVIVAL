"""Textes générés en anglais quand l'anglais est choisi dans les Paramètres."""
import pytest
from fastapi.testclient import TestClient

from app.analytics.report import CATEGORY_LABELS
from app.coach.prompts import coach_system, summary_instructions
from app.coach.roles import ROLE_ADVICE, ROLE_PLAYBOOK, role_context
from app.config import Settings
from app.draft.engine import NAMED_COMBOS, analyze_draft
from app.i18n import _english, set_language
from app.live.compliance import ALLOWED_SOURCES, FORBIDDEN_CAPABILITIES, STATEMENT, describe
from app.live.session import LiveSession
from app.main import create_app
from app.meta.icyveins import TIER_LISTS
from app.reference import registry
from app.replay import importer
from tests.factories import make_raw_replay

TOD = {"first_objective_s": 150, "objective_interval_s": 105, "source": "estimation", "samples": 0}


@pytest.fixture()
def english():
    set_language("en")
    try:
        yield
    finally:
        set_language("fr")


@pytest.fixture()
def client(db, tmp_path, monkeypatch):
    replay = tmp_path / "2026-10-08 21.14.02 Tours du Destin.StormReplay"
    replay.write_bytes(b"fake-replay-content")
    monkeypatch.setattr(importer, "read_replay", lambda path: make_raw_replay())
    monkeypatch.setattr("app.main.init_engine", lambda url: None)
    settings = Settings(database_url="sqlite://", replay_dir=str(tmp_path), watch_replays=False,
                        watch_live=False, player_toon_handle="2-Hero-1-1234567", anthropic_api_key="")
    with TestClient(create_app(settings, start_watchers=False)) as c:
        yield c
    set_language("fr")


def test_report_switches_language(client):
    assert client.post("/api/replays/import", json={}).json()["imported"] == 1
    match_id = client.get("/api/matches").json()[0]["id"]
    fr = client.get(f"/api/matches/{match_id}/report").json()["facts"]
    assert fr["headline"].startswith("Partie perdue à 13:45 sur Towers of Doom")
    set_language("en")
    try:
        en = client.get(f"/api/matches/{match_id}/report").json()["facts"]
        assert en["lang"] == "en"
        assert en["headline"].startswith("Game lost at 13:45 on Towers of Doom.")  # nom de carte inchangé
        assert "5 deaths." in en["weaknesses"]
        ai = client.post(f"/api/matches/{match_id}/report/ai").json()["ai_summary"]  # rapport sans IA
        assert ai["summary"] == en["headline"]
        assert all(m.startswith("Death at ") for m in ai["major_mistakes"])
    finally:
        set_language("fr")
    assert client.get(f"/api/matches/{match_id}/report").json()["facts"]["headline"].startswith("Partie perdue")


def test_draft_in_english(english):
    res = analyze_draft(["Valla", "Jaina", "Raynor"], ["E.T.C.", "Jaina"], map_id="towers_of_doom")
    assert any("Watch out for the E.T.C. + Jaina combo." in t for t in res.threats)
    assert any("No tank" in w for w in res.weaknesses)
    assert any("is the best pick against this draft." in c for c in res.counters)
    assert "Altars can only be captured with presence: rotate as a full team." in res.win_conditions


def test_live_tips_in_english(english):
    s = LiveSession()
    s.on_lobby(["A#1"], "towers_of_doom", "appris", "abc", TOD)
    s.start(None, "valla", clock_s=120)
    s.set_levels(ally=9, enemy=9)
    s.set_levels(ally=None, enemy=10)
    snap = s.snapshot()
    texts = [a["text"] for a in snap["alerts"]]
    assert "Talent disadvantage: avoid fights." in texts
    assert "The enemy team reaches level 10." in texts
    assert snap["tips"] == ["Stay grouped."]  # plus de conseil « behind in talents »
    assert snap["objective"]["name"] == "Altars" and snap["map_name"] == "Towers of Doom"


def test_coach_prompt_language():
    assert "Réponds en français" in coach_system()
    set_language("en")
    try:
        assert "Always answer in English" in coach_system()
        assert "in English" in summary_instructions()
        assert role_context("Healer")["label"] == "Healer"
        assert describe()["statement"].startswith("Passive overlay")
    finally:
        set_language("fr")
    assert role_context("Healer")["label"] == "Soigneur"


def test_tables_are_translated():
    """Textes traduits via une variable (tableaux, données JSON) : invisibles pour test_i18n.py."""
    keys = _english()
    texts = [*CATEGORY_LABELS.values(), *(why for _, _, why in NAMED_COMBOS), ROLE_ADVICE,
             *ALLOWED_SOURCES.values(), *FORBIDDEN_CAPABILITIES, STATEMENT,
             *(cfg["title"] for cfg in TIER_LISTS.values() if cfg["title"] != "ARAM"),
             "début de partie", "milieu de partie", "fin de partie"]
    for entry in ROLE_PLAYBOOK.values():
        texts += [entry["label"], *entry["focus"], entry["normal"], *entry["habits"]]
    for m in registry().maps.values():
        if m.objective:
            texts += [m.objective, *m.tips]
    missing = [t for t in texts if t not in keys and t not in ("macro", "teamfight", "draft", "Tank", "XP")]
    assert not missing, missing
