import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select

from app.community import client as client_module
from app.community.client import CommunityError
from app.community.summary import build_summary
from app.community.uploader import count_pending, upload_batch
from app.config import Settings
from app.main import create_app
from app.models import CommunityUpload, Match
from app.replay import importer
from tests.factories import make_raw_replay


class FakeClient:
    def __init__(self, status="accepted", fail: CommunityError | None = None):
        self.sent: list[list[dict]] = []
        self.status, self.fail = status, fail
        self.profiles: list[tuple] = []

    def upload(self, summaries):
        if self.fail:
            raise self.fail
        self.sent.append(summaries)
        return [{"status": self.status} for _ in summaries]

    def set_profile(self, public, name="", toon_handles=None):
        self.profiles.append((public, name, toon_handles))
        slug = "joueur-abc123" if public else None
        client_module._write_state({"install_id": "0" * 16, "token": "0" * 48, "profile_slug": slug})
        return {"public": public, "slug": slug}


@pytest.fixture()
def imported(db, tmp_path, monkeypatch):
    monkeypatch.setattr(importer, "read_replay", lambda path: make_raw_replay())
    replay = tmp_path / "partie.StormReplay"
    replay.write_bytes(b"fake")
    importer.import_replay_file(db, replay, "2-Hero-1-1234567")
    match = db.scalar(select(Match))
    match.game_mode = "Storm League"
    db.commit()
    return match


def test_summary_has_no_names_and_matches_server_format(imported):
    s = build_summary(imported)
    assert s["v"] == 1 and s["me_slot"] == 1
    assert s["match"]["mode"] == "Storm League" and s["match"]["duration_s"] == 825
    assert isinstance(s["match"]["played_at"], int)
    assert len(s["players"]) == 10
    p = s["players"][1]
    assert p["toon_handle"] == "2-Hero-1-1234567" and p["hero_id"] == "valla"
    assert len(p["talents"]) == 7 and p["kills"] == 6 and p["time_dead_s"] == 158
    assert all(p["win"] == (p["team"] == s["match"]["winner_team"]) for p in s["players"])
    dumped = json.dumps(s)
    assert "Joueur" not in dumped  # aucun pseudo ne quitte le PC


def test_upload_batch_sends_each_match_once(db, imported):
    fake = FakeClient()
    assert count_pending(db) == 1
    assert upload_batch(db, fake) == 1
    assert upload_batch(db, fake) == 0
    assert len(fake.sent) == 1 and count_pending(db) == 0
    assert db.scalar(select(CommunityUpload.status)) == "accepted"


def test_unshared_modes_are_never_sent(db, imported):
    imported.game_mode = "Versus AI"
    db.commit()
    assert upload_batch(db, FakeClient()) == 0


def test_server_errors_keep_matches_pending(db, imported):
    with pytest.raises(CommunityError):
        upload_batch(db, FakeClient(fail=CommunityError("quota", 429, 3600)))
    assert count_pending(db) == 1


@pytest.fixture()
def api(db, tmp_path, monkeypatch):
    monkeypatch.setattr("app.main.init_engine", lambda url: None)
    monkeypatch.setattr("app.config.write_user_settings", lambda values: None)
    monkeypatch.setattr("app.api.community.write_user_settings", lambda values: None)
    fake = FakeClient()
    monkeypatch.setattr("app.api.community.CommunityClient", lambda url: fake)
    monkeypatch.setattr(client_module, "_credentials_path", lambda: tmp_path / "community.json")

    def make(url: str):
        settings = Settings(database_url="sqlite://", replay_dir=str(tmp_path), watch_replays=False, watch_live=False,
                            player_toon_handle="2-Hero-1-1234567", player_battletag="Joueur#1234",
                            community_url=url)
        return TestClient(create_app(settings, start_watchers=False)), fake
    return make


def test_community_disabled_until_deployed(api):
    client, _ = api("")
    with client:
        assert client.get("/api/community").json()["available"] is False
        assert client.put("/api/community", json={"share_matches": True}).status_code == 409


def test_opt_in_and_public_profile(api):
    client, fake = api("https://example.invalid")
    with client:
        r = client.get("/api/community").json()
        assert r["share_matches"] is False and r["public_profile"] is False  # rien sans accord
        assert client.put("/api/community", json={"public_profile": True}).status_code == 400
        r = client.put("/api/community", json={"share_matches": True, "public_profile": True}).json()
        assert r["share_matches"] and r["public_profile"] and r["profile_slug"] == "joueur-abc123"
        assert fake.profiles == [(True, "Joueur#1234", ["2-Hero-1-1234567"])]
        r = client.put("/api/community", json={"share_matches": False}).json()
        assert r["public_profile"] is False and fake.profiles[-1][0] is False


def test_uploader_cycle_sends_then_idles(db, imported, monkeypatch, tmp_path):
    from app.community import uploader as uploader_module

    fake = FakeClient()
    monkeypatch.setattr(uploader_module, "CommunityClient", lambda url: fake)
    monkeypatch.setattr(client_module, "_credentials_path", lambda: tmp_path / "community.json")
    monkeypatch.setattr(uploader_module, "refresh_if_stale", lambda url: False)
    settings = Settings(share_matches=True, community_url="https://example.invalid")
    u = uploader_module.CommunityUploader(lambda: settings)
    assert u.run_once() == 2 and len(fake.sent) == 1  # lot envoyé : le suivant part vite
    assert u.run_once() == uploader_module.IDLE_S and u.last_error is None
    off = uploader_module.CommunityUploader(lambda: Settings(share_matches=False))
    assert off.run_once() == uploader_module.IDLE_S


def test_map_id_is_language_independent(db, imported):
    imported.map_id, imported.map_name = "lapassedalterac", "La passe d’Alterac"
    db.commit()
    assert build_summary(imported)["match"]["map_id"] == "alterac_pass"


def _with_cycles(db, match, phases):
    from app.models import MatchEvent
    for t, phase in phases:
        db.add(MatchEvent(match_id=match.id, t_s=t, kind="objective_cycle", payload={"phase": phase}))
    db.commit()
    db.refresh(match)


def test_summary_includes_objective_timings(db, imported):
    _with_cycles(db, imported, [(180, "start"), (255, "end"), (376, "start"), (466, "end")])
    o = build_summary(imported)["objectives"]
    assert o == {"first_start": 180, "durations": [75, 90], "respawns": [121], "periods": []}


def test_already_shared_matches_get_their_timings_once(db, imported, monkeypatch):
    from app.community import uploader as up
    fake = FakeClient()
    assert upload_batch(db, fake) == 1 and fake.sent[0][0]["objectives"] is None  # partagée sans horaires
    _with_cycles(db, imported, [(180, "start"), (255, "end")])  # réanalyse : horaires disponibles
    assert up.objective_backfill_batch(db, fake) == 1
    assert fake.sent[1][0]["objectives"]["durations"] == [75]
    assert up.objective_backfill_batch(db, fake) == 0  # une seule fois


def test_timer_source_priority(db, tmp_path, monkeypatch):
    from app.analytics import timings
    from app.community import timings as community
    monkeypatch.setattr(community, "_path", lambda: tmp_path / "community_timings.json")
    (tmp_path / "community_timings.json").write_text(json.dumps({"maps": {"sky_temple": {
        "samples": 250, "first_objective_s": 180, "objective_duration_s": 70, "objective_interval_s": 121}}}))
    t = timings.map_timings(db, "sky_temple")
    assert t["source"] == "communauté" and t["objective_duration_s"] == 70 and t["samples"] == 250
    monkeypatch.setattr(timings, "calibrate_map", lambda db, m: {"samples": 12, "objective_duration_s": 95})
    assert timings.map_timings(db, "sky_temple")["source"] == "vos replays"  # assez de parties : les vôtres
    monkeypatch.setattr(timings, "calibrate_map", lambda db, m: {"samples": 3, "objective_duration_s": 95})
    assert timings.map_timings(db, "sky_temple")["source"] == "communauté"  # trop peu : la communauté
