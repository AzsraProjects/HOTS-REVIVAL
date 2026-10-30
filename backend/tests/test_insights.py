"""Avantages convertis ou perdus, objectif personnel suivi, marque-pages, guide vocal sobre."""
import time
from datetime import timedelta
from pathlib import Path
from types import SimpleNamespace as NS

import pytest
from fastapi.testclient import TestClient

from app.analytics.advantages import advantage_timeline
from app.analytics.hero_diagnosis import rework_suggestion
from app.bookmarks import attach_pending
from app.config import Settings
from app.live.session import SCREEN_STALE_S, LiveSession
from app.main import create_app
from app.models import Bookmark, Goal, Match
from app.replay import importer
from app.replay.extractor import extract_match
from app.replay.parser import read_replay
from tests.factories import make_raw_replay

FIXTURES = Path(__file__).parent / "fixtures"
TOD = {"first_objective_s": 150, "objective_interval_s": 105, "source": "estimation", "samples": 0}


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


def _imported(client) -> int:
    assert client.post("/api/replays/import", json={}).json()["imported"] == 1
    return client.get("/api/matches").json()[0]["id"]


def _as_match(parsed):
    return NS(duration_s=parsed.duration_s, events=[NS(**e.__dict__) for e in parsed.events],
              players=[NS(slot=p.slot, team=p.team, hero_name=p.hero_name) for p in parsed.players])


# ---- extraction ---------------------------------------------------------------------------------
def test_structures_have_owner_and_deaths_have_real_respawns():
    m = extract_match(read_replay(FIXTURES / "hanamura_storm_league.StormReplay"))
    structures = [e for e in m.events if e.kind == "structure"]
    assert structures and all(e.team in (0, 1) for e in structures)
    core = [e for e in structures if e.payload["structure"] == "core"]
    assert len(core) == 1 and core[0].team == m.winner_team  # le cœur est gagné par le vainqueur
    deaths = [e for e in m.events if e.kind == "death"]
    respawns = [e.payload["respawn_s"] - e.t_s for e in deaths if "respawn_s" in e.payload]
    assert len(respawns) >= 35 and all(10 <= r <= 70 for r in respawns)
    assert all("x" in e.payload for e in deaths)


# ---- avantages convertis ou perdus --------------------------------------------------------------
def test_advantages_on_real_replay():
    m = extract_match(read_replay(FIXTURES / "hanamura_storm_league.StormReplay"))
    match = _as_match(m)
    me = next(p for p in match.players if p.team != m.winner_team)
    tl = advantage_timeline(match, me)
    assert tl["allies"]["advantages"] == 0 and tl["enemies"]["advantages"] >= 4
    last = tl["moments"][-1]
    assert last["side"] == "enemies" and last["converted"] and "Cœur" in last["fact"]
    assert all(m["limits"] and m["evidence"]["deaths"] for m in tl["moments"])


def _death(t, team, slot, respawn=None):
    payload = {"killers": []}
    if respawn:
        payload["respawn_s"] = respawn
    return NS(t_s=t, kind="death", team=team, slot=slot, payload=payload)


def test_advantage_converted_or_not():
    players = [NS(slot=i, team=0 if i < 5 else 1, hero_name=f"H{i}") for i in range(10)]
    events = [
        _death(100, 1, 5, 125), _death(104, 1, 6, 129),  # 2 adversaires à terre…
        NS(t_s=115, kind="structure", team=0, slot=None, payload={"structure": "tower", "owner": 1}),  # …tour prise
        _death(300, 1, 7, 330), _death(305, 1, 8, 335),  # 2 adversaires à terre, rien obtenu
        NS(t_s=320, kind="camp", team=1, slot=None, payload={"camp": "Siege Camp"}),  # l'adversaire prend un camp
        _death(500, 0, 1, 520),  # mort isolée : pas d'avantage
    ]
    tl = advantage_timeline(NS(duration_s=900, events=events, players=players), players[0])
    first, second = tl["moments"]
    assert first["converted"] and first["window_s"] == 21 and "Tour" in first["fact"]
    assert not second["converted"] and second["alternative"] and "pas forcément une erreur" in second["interpretation"]
    assert "l'adversaire obtient : 5:20 Camp de siège" in second["fact"]
    assert tl["allies"] == {"advantages": 2, "converted": 1}


def test_report_has_advantages_and_basis(client):
    match_id = _imported(client)
    facts = client.get(f"/api/matches/{match_id}/report").json()["facts"]
    adv = facts["advantages"]
    assert adv["enemies"]["advantages"] == 1 and adv["moments"][0]["side"] == "enemies"
    assert "replay" in adv["rule"]
    assert facts["basis"]["5 morts."].startswith("Règle : 5 morts ou plus.")
    assert all(text in facts["basis"] for text in facts["improvement_plan"])


# ---- objectif personnel -------------------------------------------------------------------------
def test_goal_lifecycle(client, db):
    match_id = _imported(client)
    suggestions = client.get(f"/api/goals/suggestions?match_id={match_id}").json()
    assert suggestions[0]["suggested"] and {s["key"] for s in suggestions} >= {"deaths", "conversions"}

    active = client.post("/api/goals", json={"key": "deaths", "target": 3, "match_id": match_id}).json()["active"]
    assert active["goal"]["label"] == "Mourir 3 fois au maximum."
    assert active["games"] == [] and "Échantillon trop faible" in active["note"]  # partie jouée avant l'objectif

    bilan = client.get(f"/api/goals/match/{match_id}").json()
    assert bilan["in_period"] is False and bilan["result"]["value"] == 5 and bilan["result"]["success"] is False
    assert len(bilan["result"]["situations"]) == 1  # une seule mort horodatée dans le replay synthétique

    # objectif choisi avant la partie : elle compte
    goal = db.query(Goal).one()
    goal.created_at = goal.created_at - timedelta(days=3650)
    db.commit()
    active = client.get("/api/goals").json()["active"]
    assert active["measured"] == 1 and active["successes"] == 0 and active["trend"] is None

    # un seul objectif actif à la fois, rappelé à l'écran de chargement
    client.post("/api/goals", json={"key": "isolated_deaths", "target": 1})
    assert db.query(Goal).filter(Goal.ended_at.is_(None)).count() == 1
    assert client.get("/api/live/state").json()["goal"]["label"] == "Une mort isolée au maximum par partie."
    assert client.delete("/api/goals/active").json() == {"active": None}
    assert client.get("/api/live/state").json()["goal"] is None


def test_unmeasurable_goal_is_not_a_failure(client):
    match_id = _imported(client)
    client.post("/api/goals", json={"key": "conversions", "target": 50})
    result = client.get(f"/api/goals/match/{match_id}").json()["result"]
    assert result["value"] is None and result["success"] is None and result["note"]


def _games(client, tmp_path, monkeypatch, specs: list[tuple[str, bool, int]]) -> list[int]:
    """Importe une partie par (héros joué, victoire, morts) ; renvoie les identifiants, la plus récente d'abord."""
    replays = {}
    for path in tmp_path.glob("*.StormReplay"):
        path.unlink()
    for i, (hero, win, deaths) in enumerate(specs):
        raw = make_raw_replay(me_wins=win, me_deaths=deaths)
        players = raw.details["m_playerList"]
        if hero != "Valla":  # le joueur (emplacement 2) prend ce héros, son allié prend Valla
            other = next(p for p in players if p["m_hero"] == hero.encode())
            other["m_hero"], players[1]["m_hero"] = b"Valla", hero.encode()
        name = f"2026-10-{i + 1:02d} 21.14.02 Tours du Destin.StormReplay"
        (tmp_path / name).write_bytes(f"partie-{i}".encode())
        replays[name] = raw
    monkeypatch.setattr(importer, "read_replay", lambda path: replays[Path(path).name])
    assert client.post("/api/replays/import", json={}).json()["imported"] == len(specs)
    return [m["id"] for m in client.get("/api/matches").json()]


VALLA_LOSSES_JAINA_WINS = [("Valla", False, 5)] * 4 + [("Jaina", True, 1)] * 3


def test_heroes_to_rework_and_recurring_suggestions(client, tmp_path, monkeypatch):
    _games(client, tmp_path, monkeypatch, VALLA_LOSSES_JAINA_WINS)
    profile = client.get("/api/profile").json()
    valla = profile["heroes_to_rework"][0]
    assert (valla["hero"], valla["games"], valla["wins"]) == ("Valla", 4, 0) and valla["kind"] in ("level", "results")
    assert profile["trend"]["last_10_wins"] == 3 and profile["trend"]["last_10_games"] == 7

    recent = client.get("/api/goals/suggestions").json()  # tableau de bord : sans partie
    deaths = next(s for s in recent if s["key"] == "deaths" and not s.get("hero_id"))
    assert deaths["suggested"] and deaths["reason"] == "Revient dans 4 de vos 7 dernières parties."
    assert any(s.get("hero_id") == valla["hero_id"] and s["suggested"] for s in recent)


def test_diagnosis_explains_losses_on_a_hero(client, tmp_path, monkeypatch, db):
    _games(client, tmp_path, monkeypatch, VALLA_LOSSES_JAINA_WINS)
    valla = client.get("/api/profile").json()["heroes_to_rework"][0]
    diag = client.get(f"/api/profile/heroes/{valla['hero_id']}/diagnosis").json()
    assert diag["losses"] == 4 and diag["wins_compared"] == 3 and "Peu de défaites" in diag["note"]
    deaths = next(f for f in diag["findings"] if f["key"] == "deaths")
    assert deaths["hero_losses"] == 5 and deaths["wins"] == 1 and not deaths["team"]
    assert deaths["goal"] == {"key": "deaths", "target": 1, "label": "Avec Valla : mourir 1 fois au maximum."}
    assert diag["verdict"].startswith("Ces points décrochent")

    # bon HEROS SCORE mais défaites : l'objectif proposé vient du diagnostic et ne vise que ce héros
    option = rework_suggestion(db, {**valla, "kind": "results"}, suggested=True)
    assert option["hero_id"] == valla["hero_id"] and option["key"] != "hero" and option["reason"]
    active = client.post("/api/goals", json={**{k: option[k] for k in ("key", "target", "hero_id")}}).json()["active"]
    assert active["goal"]["label"].startswith("Avec Valla : ")


def test_hero_goal_only_counts_games_on_that_hero(client, tmp_path, monkeypatch, db):
    match_ids = _games(client, tmp_path, monkeypatch, VALLA_LOSSES_JAINA_WINS)
    assert client.post("/api/goals", json={"key": "hero", "target": 50}).status_code == 422  # héros manquant
    hero_id = client.get("/api/profile").json()["heroes_to_rework"][0]["hero_id"]
    active = client.post("/api/goals", json={"key": "hero", "target": 50, "hero_id": hero_id}).json()["active"]
    assert active["goal"]["label"] == "Sur Valla : HEROS SCORE d'au moins 50." and "Valla" in active["goal"]["reminder"]
    goal = db.query(Goal).one()
    goal.created_at = goal.created_at - timedelta(days=3650)
    db.commit()
    assert client.get("/api/goals").json()["active"]["measured"] == 4  # les 3 parties sur Jaina ne comptent pas
    valla_game = match_ids[-1]
    result = client.get(f"/api/goals/match/{valla_game}").json()["result"]
    assert result["value"] is not None and result["situations"][0].startswith("Catégorie la plus faible")
    assert client.get(f"/api/goals/match/{match_ids[0]}").json()["result"]["success"] is None  # partie sur Jaina


def _game(hero: str, win: bool, map_id: str, allies: list[str], enemies: list[str]):
    team = [NS(hero_id=h, role=None, team=0) for h in allies] + [NS(hero_id=h, role=None, team=1) for h in enemies]
    me = NS(hero_id=hero, is_winner=win, team=0)
    me.match = NS(map_id=map_id, map_name=map_id.title(), players=team + [NS(hero_id=hero, role=None, team=0)])
    return me, {}


def test_diagnosis_maps_and_compositions():
    from app.analytics.hero_diagnosis import _compositions, _maps

    usual = ["muradin", "uther", "jaina", "sonya"]
    losses = [_game("valla", False, "braxis", ["sonya", "jaina", "raynor", "etc"], ["illidan", "genji", "uther", "muradin"])
              for _ in range(3)]
    wins = [_game("jaina", True, "braxis", usual, ["raynor", "etc", "rehgar", "tracer"]) for _ in range(4)]
    texts = _compositions(losses, wins, "Valla")
    assert any(t.startswith("Votre équipe sans soigneur : 3 de vos 3 défaites avec Valla, contre 0 %") for t in texts)
    assert any(t.startswith("Au moins 2 héros de plongée en face") for t in texts)
    maps = _maps(losses + wins, "valla", "Valla")
    assert maps == ["Braxis : 0 V / 3 avec Valla, contre 100 % de victoires avec vos autres héros sur cette carte."]


def test_new_nullable_columns_are_added_to_existing_tables():
    from sqlalchemy import create_engine, inspect, text
    from sqlalchemy.pool import StaticPool
    from app import db as db_module

    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    with engine.begin() as conn:  # table « goals » d'une version précédente, sans hero_id
        conn.execute(text("CREATE TABLE goals (id INTEGER PRIMARY KEY, key VARCHAR(32), target FLOAT, "
                          "source_match_id INTEGER, created_at DATETIME, ended_at DATETIME)"))
    previous, db_module._engine = db_module._engine, engine
    try:
        db_module.create_schema()
    finally:
        db_module._engine = previous
    assert "hero_id" in {c["name"] for c in inspect(engine).get_columns("goals")}


# ---- marque-pages -------------------------------------------------------------------------------
def test_bookmark_attached_to_replay_with_estimated_clock(client, db):
    match_id = _imported(client)
    bm = client.post("/api/live/bookmark").json()
    assert bm["attached"] is False and bm["clock"] is None  # horloge non synchronisée

    match = db.get(Match, match_id)
    row = db.get(Bookmark, bm["id"])
    row.created_at = match.played_at - timedelta(seconds=525)  # 5 min 25 avant la fin de la partie
    db.commit()
    assert attach_pending(db, match) == 1

    marks = client.get(f"/api/matches/{match_id}/bookmarks").json()
    assert marks[0]["clock"] == "5:00" and marks[0]["clock_estimated"]
    assert any("Mort de Valla" in e["text"] for e in marks[0]["around"])  # morts de 5:00 à 5:09
    client.put(f"/api/bookmarks/{bm['id']}", json={"note": "  On pouvait finir ici.  "})
    assert client.get(f"/api/matches/{match_id}/bookmarks").json()[0]["note"] == "On pouvait finir ici."
    client.delete(f"/api/bookmarks/{bm['id']}")
    assert client.get(f"/api/matches/{match_id}/bookmarks").json() == []


def test_bookmark_outside_the_game_is_not_attached(client, db):
    match_id = _imported(client)
    match = db.get(Match, match_id)
    db.add(Bookmark(created_at=match.played_at + timedelta(hours=2), clock_s=60))
    db.commit()
    assert attach_pending(db, match) == 0


def test_live_bookmark_is_announced():
    s = LiveSession()
    s.start("towers_of_doom", None, clock_s=754)
    assert round(s.bookmark()) == 754
    assert any(a["text"] == "Moment marqué à 12:34." for a in s.snapshot()["alerts"])


# ---- en jeu : rappel d'objectif, lecture d'écran perdue -----------------------------------------
def test_goal_reminder_at_loading_and_kept_between_games():
    s = LiveSession()
    s.set_goal({"label": "Mourir 3 fois au maximum.", "reminder": "Jouez la survie."})
    s.on_lobby(["A#1"], "towers_of_doom", "appris", "abc", TOD)
    snap = s.snapshot()
    assert snap["goal"]["label"] == "Mourir 3 fois au maximum."
    assert any(a["text"] == "Votre objectif : Mourir 3 fois au maximum." for a in snap["alerts"])
    s.stop()
    assert s.snapshot()["goal"]["reminder"] == "Jouez la survie."


def test_stale_screen_reading_pauses_level_alerts():
    s = LiveSession()
    s.on_lobby(["A#1"], "towers_of_doom", "appris", "abc", TOD)
    s.sync_clock(300, "écran")
    s.set_levels(ally=9, enemy=10, source="écran")
    s.set_levels(ally=9, enemy=10, source="écran")
    s._flashes.clear()
    assert any(a["id"] == "talent-disadvantage" for a in s.snapshot()["alerts"])

    s.screen_seen_at = time.monotonic() - SCREEN_STALE_S - 1
    snap = s.snapshot()
    ids = [a["id"] for a in snap["alerts"]]
    assert "talent-disadvantage" not in ids and "screen-lost" in ids
    assert snap["levels"]["stale"] is True

    s.sync_clock(330, "écran")  # la lecture reprend
    snap = s.snapshot()
    assert snap["levels"]["stale"] is False and any(a["id"] == "talent-disadvantage" for a in snap["alerts"])
